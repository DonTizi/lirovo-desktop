import { stat } from "node:fs/promises";
import path from "node:path";
import type { ArtifactStore, Exec, NormalizeResult, SourceManifest } from "@lirovo/contracts";
import { ARTIFACT_PATHS, LirovoError } from "@lirovo/contracts";
import { probeMedia } from "./probe.js";

export interface NormalizeInput {
  readonly runId: string;
  readonly manifest: SourceManifest;
  readonly mediaPath: string;
  readonly signal: AbortSignal;
}

export interface NormalizeDeps {
  readonly exec: Exec;
  readonly store: ArtifactStore;
  readonly ffmpeg: string;
  /** Used to check that what came out matches what the source claimed. */
  readonly ffprobe: string;
}

/**
 * How far the decoded audio may fall short of the promised duration.
 *
 * Containers round and a final partial frame is normal, so a second of slack
 * absorbs the honest cases. Two percent covers long recordings where a second
 * is unreasonably tight.
 */
export const durationTolerance = (durationS: number): number => Math.max(1, durationS * 0.02);

/**
 * Produce the two files the rest of the pipeline reads.
 *
 * - `normalized/audio.flac` — 16 kHz mono, what transcription consumes.
 * - `normalized/video.mp4`  — a REMUX, not a re-encode. The source is already
 *   H.264 or VP9, scene detection normalises framerate in its own filter chain,
 *   and re-encoding a twelve-minute source cost four to six minutes for no
 *   benefit. `-c:v copy` does the same job in seconds.
 *
 * ffmpeg writes straight into the artifact tree rather than to a scratch file
 * that is then copied in: a transcode of a long recording is large, and moving
 * it twice is the kind of cost that only shows up on a real video.
 */
export const normalize = async (input: NormalizeInput, deps: NormalizeDeps): Promise<NormalizeResult> => {
  const audioPath = deps.store.resolve(input.runId, ARTIFACT_PATHS.audio);
  const videoPath = deps.store.resolve(input.runId, ARTIFACT_PATHS.video);
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(audioPath), { recursive: true });

  if (!input.manifest.has_audio) {
    throw new LirovoError("SOURCE_UNSUPPORTED", "the source has no audio track to normalize", {
      stage: "normalize",
    });
  }

  await deps
    .exec(deps.ffmpeg, ["-y", "-i", input.mediaPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "flac", audioPath], {
      signal: input.signal,
      timeoutMs: 45 * 60 * 1000,
    })
    .catch((error: unknown) => {
      if (error instanceof LirovoError && error.code === "CANCELLED") throw error;
      throw new LirovoError("NORMALIZE_FAILED", `ffmpeg (audio): ${String(error)}`, { stage: "normalize" });
    });

  const audioBytes = (await stat(audioPath)).size;

  // What was decoded, against what the container promised.
  //
  // A download killed halfway leaves a file whose header still describes the
  // whole video, so ffprobe reports the full duration and every guard upstream
  // is satisfied. The only thing that knows the truth is the decoder: it
  // produced 6.5 seconds of audio for a source claiming 19. Without this the
  // run succeeds, transcribes a third of the talk, and says nothing.
  const promised = input.manifest.duration_s;
  if (promised > 0) {
    const decoded = await probeMedia(deps.exec, deps.ffprobe, audioPath).catch(() => null);
    const actual = decoded?.durationS ?? 0;
    if (actual > 0 && promised - actual > durationTolerance(promised)) {
      throw new LirovoError(
        "SOURCE_TRUNCATED",
        `the source claims ${promised.toFixed(1)}s but only ${actual.toFixed(1)}s could be decoded — the download or the file is incomplete`,
        { stage: "normalize", detail: { promisedS: promised, decodedS: actual } },
      );
    }
  }
  let videoBytes: number | null = null;

  if (input.manifest.has_video) {
    await deps
      .exec(deps.ffmpeg, ["-y", "-i", input.mediaPath, "-an", "-c:v", "copy", "-movflags", "+faststart", videoPath], {
        signal: input.signal,
        timeoutMs: 45 * 60 * 1000,
      })
      .catch((error: unknown) => {
        if (error instanceof LirovoError && error.code === "CANCELLED") throw error;
        throw new LirovoError("NORMALIZE_FAILED", `ffmpeg (video): ${String(error)}`, { stage: "normalize" });
      });
    videoBytes = (await stat(videoPath)).size;
  }

  return {
    audio_path: audioPath,
    video_path: videoBytes === null ? null : videoPath,
    duration_s: input.manifest.duration_s,
    audio_bytes: audioBytes,
    video_bytes: videoBytes,
  };
};
