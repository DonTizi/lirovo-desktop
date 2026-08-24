import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import type { ArtifactStore, Exec, FramesManifest, RawFrameEntry } from "@lirovo/contracts";
import { ARTIFACT_PATHS, LirovoError } from "@lirovo/contracts";

export type ShotDetector = "scene" | "scdet";

/** `select='gt(scene,T)'` threshold, 0-1. Hard cuts only. */
export const DEFAULT_SCENE_THRESHOLD = 0.3;

/**
 * `scdet` threshold, 0-100. Calibrated rather than chosen: a known dissolve is
 * caught at 4 and 5 and missed from 8 up, so 5 is the loosest value that still
 * works.
 */
export const DEFAULT_SCDET_THRESHOLD = 5;

/**
 * `scene` is the default, after `scdet` caused a real cost regression upstream.
 *
 * `scdet` catches dissolves that `scene` misses, and shipped as the default on
 * the assumption that pHash dedup would absorb the extra frames before any
 * model call. That assumption was never measured and turned out to be wrong.
 * It stays available; promoting it again means measuring the DEDUPED frame
 * count, not the raw one.
 */
export const DEFAULT_DETECTOR: ShotDetector = "scene";

export const defaultThresholdFor = (detector: ShotDetector): number =>
  detector === "scdet" ? DEFAULT_SCDET_THRESHOLD : DEFAULT_SCENE_THRESHOLD;

/**
 * `fps=30` comes first because normalization ships a remux, so the source
 * framerate is whatever the platform delivered and both detector metrics are
 * framerate-sensitive.
 */
export const buildFilterChain = (detector: ShotDetector, threshold: number): string =>
  detector === "scdet"
    ? `fps=30,scdet=threshold=${threshold}:sc_pass=1,showinfo`
    : `fps=30,select='gt(scene,${threshold})',showinfo`;

/**
 * Pull frame indices and timestamps out of ffmpeg's `showinfo` stderr.
 *
 * Permissive on whitespace and field order because the surrounding fields vary
 * across ffmpeg versions; `n` and `pts_time` have been stable for years.
 */
export const parseShowInfo = (stderr: string): RawFrameEntry[] => {
  const entries: RawFrameEntry[] = [];
  for (const line of stderr.split("\n")) {
    if (!line.includes("Parsed_showinfo")) continue;
    const n = /\bn:\s*(\d+)\b/.exec(line);
    const pts = /\bpts_time:\s*([\d.]+)\b/.exec(line);
    if (n === null || pts === null) continue;
    const idx = Number(n[1]);
    const sourcePts = Number(pts[1]);
    if (!Number.isFinite(idx) || !Number.isFinite(sourcePts)) continue;
    entries.push({ idx, source_pts: sourcePts, t_ms: Math.round(sourcePts * 1000) });
  }
  return entries;
};

/**
 * Reduce an ffmpeg failure to the lines that say what went wrong.
 *
 * ffmpeg prints its version banner, its full build configuration, every library
 * version and a complete stream dump before it gets to the error. Surfacing all
 * of that means the one useful line arrives on screen roughly forty lines after
 * anyone stopped reading.
 */
export const summarizeFfmpegFailure = (message: string): string => {
  const interesting = message
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        /error|failed|invalid|unsupported|no such|permission denied|conversion failed/i.test(line) &&
        // "Error while opening encoder" matters; "--enable-libx264" does not.
        !line.startsWith("configuration:") &&
        !line.startsWith("built with"),
    );
  const unique = [...new Set(interesting)];
  return unique.length === 0 ? message.split("\n")[0]?.trim() ?? message : unique.slice(0, 4).join("; ");
};

/**
 * Did ffmpeg fail because the filter selected nothing?
 *
 * These two lines are how ffmpeg says "your filter matched no frames" — which
 * for a shot detector is an answer, not an error.
 */
export const isEmptySelection = (stderr: string): boolean =>
  /No filtered frames for output stream/i.test(stderr) ||
  /Nothing was written into output file/i.test(stderr);

export interface SceneDetectInput {
  readonly runId: string;
  readonly videoPath: string;
  readonly detector?: ShotDetector;
  readonly threshold?: number;
  /** Refuse rather than spend the next stage's time on an unbounded frame set. */
  readonly frameCap: number;
  readonly signal: AbortSignal;
}

export interface SceneDetectDeps {
  readonly exec: Exec;
  readonly store: ArtifactStore;
  readonly ffmpeg: string;
}

export interface SceneDetectResult {
  readonly rawFrameCount: number;
  readonly params: { detector: ShotDetector; scene_threshold: number };
}

export const sceneDetect = async (
  input: SceneDetectInput,
  deps: SceneDetectDeps,
): Promise<SceneDetectResult> => {
  const detector = input.detector ?? DEFAULT_DETECTOR;
  const threshold = input.threshold ?? defaultThresholdFor(detector);
  const framesDir = path.dirname(deps.store.resolve(input.runId, ARTIFACT_PATHS.rawFrame(0)));
  await mkdir(framesDir, { recursive: true });

  // A non-zero exit is not the verdict here; the directory is.
  //
  // A single-shot recording — a static webcam, a screen capture with no cuts —
  // legitimately produces ZERO frames past the select filter. ffmpeg then
  // reports "No filtered frames for output stream", fails to initialise an
  // encoder it never needed, prints "Conversion failed!" and exits non-zero.
  // Treating that as a stage failure means every uncut video degrades.
  let stderr = "";
  let failure: string | null = null;
  try {
    const result = await deps.exec(
      deps.ffmpeg,
      [
        "-y",
        "-i", input.videoPath,
        "-vf", buildFilterChain(detector, threshold),
        "-vsync", "vfr",
        "-start_number", "0",
        // JPEG wants full-range YUV; AV1 from YouTube arrives tagged limited
        // range and the mjpeg encoder calls that non-standard.
        "-pix_fmt", "yuvj420p",
        "-q:v", "2",
        path.join(framesDir, "%06d.jpg"),
      ],
      { signal: input.signal, timeoutMs: 45 * 60 * 1000 },
    );
    stderr = result.stderr;
  } catch (error) {
    if (error instanceof LirovoError && (error.code === "CANCELLED" || error.code === "TIMED_OUT")) throw error;
    const message = error instanceof Error ? error.message : String(error);
    stderr = message;
    failure = summarizeFfmpegFailure(message);
  }

  const parsed = parseShowInfo(stderr);
  const onDisk = new Set(
    (await readdir(framesDir))
      .filter((f) => f.endsWith(".jpg"))
      .map((f) => Number(f.replace(".jpg", ""))),
  );
  // `showinfo` reports what the filter emitted; the directory reports what
  // actually landed. Intersecting keeps the manifest describing real files.
  const raw = parsed.filter((entry) => onDisk.has(entry.idx));

  // Only now does the exit code get a say: it explains an empty directory, and
  // it only explains a FAILURE when the emptiness was not the expected kind.
  if (raw.length === 0 && failure !== null && !isEmptySelection(stderr)) {
    throw new LirovoError("SCENE_DETECT_FAILED", failure, { stage: "scene-detect" });
  }

  if (raw.length > input.frameCap) {
    throw new LirovoError(
      "FRAME_BUDGET_EXCEEDED",
      `${raw.length} scene changes exceeds the cap of ${input.frameCap} — raise --frame-cap or use a tighter threshold`,
      { stage: "scene-detect", detail: { frames: raw.length, cap: input.frameCap } },
    );
  }

  const manifest: FramesManifest = {
    raw,
    params: { detector, scene_threshold: threshold },
  };
  await deps.store.put(input.runId, ARTIFACT_PATHS.framesManifest, `${JSON.stringify(manifest, null, 2)}\n`);

  // Return the resolved values, not the manifest's: the artifact type keeps
  // `detector` as a plain string so an older manifest with an unknown detector
  // still parses, and narrowing that back here would be a lie.
  return { rawFrameCount: raw.length, params: { detector, scene_threshold: threshold } };
};
