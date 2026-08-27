import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { ArtifactStore, Exec, SourceManifest } from "@lirovo/contracts";
import { ARTIFACT_PATHS, LirovoError } from "@lirovo/contracts";
import { probeMedia } from "./probe.js";
import { explainYtDlpError, summarizeYtDlpFailure } from "../asr/captions.js";

export interface IngestInput {
  readonly runId: string;
  readonly source: string;
  readonly signal: AbortSignal;
}

export interface IngestDeps {
  readonly exec: Exec;
  readonly store: ArtifactStore;
  readonly ffprobe: string;
  readonly ytDlp: string | null;
  readonly workDir: string;
}

export interface IngestResult {
  readonly manifest: SourceManifest;
  /** Absolute path to the media on disk, ready for ffmpeg. */
  readonly mediaPath: string;
}

export const isUrl = (source: string): boolean => /^https?:\/\//i.test(source);

/**
 * Files yt-dlp leaves behind that are NOT playable media.
 *
 * It writes to `<name>.part` and renames on completion, keeps `.ytdl` resume
 * state, and for a separate video+audio download leaves format-tagged
 * fragments like `source.f399.mp4`. All of them begin with the output stem, so
 * a naive "first file starting with source." picks one of them after any
 * interruption — and an mp4 truncated to 40% still probes as the full duration,
 * because the header at the front describes a video the file no longer
 * contains. Nothing downstream would notice.
 */
export const isPartialDownload = (name: string): boolean =>
  /\.(part|ytdl|temp|tmp)$/i.test(name) || /\.f\d+\./i.test(name);

export const sourceTypeOf = (source: string): SourceManifest["source_type"] => {
  if (!isUrl(source)) return "file";
  const host = (() => {
    try {
      return new URL(source).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  if (host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
  if (host.endsWith("vimeo.com")) return "vimeo";
  if (host.endsWith("loom.com")) return "loom";
  return "url";
};

/** Streamed so a multi-gigabyte source is not read into memory to be hashed. */
export const hashFile = (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });

/** yt-dlp prints the title then the path; the last two lines are what we want. */
export const parseYtDlpPrints = (stdout: string): { title: string | null; filePath: string | null } => {
  const lines = stdout.split("\n").map((l) => l.trim()).filter((l) => l !== "");
  const filePath = lines.at(-1) ?? null;
  const rawTitle = lines.at(-2) ?? null;
  return {
    // yt-dlp prints the literal "NA" when a field is absent.
    title: rawTitle === null || rawTitle === "NA" ? null : rawTitle.slice(0, 300),
    filePath,
  };
};

/**
 * Get the media onto disk and describe it.
 *
 * A local file is probed WHERE IT IS. The hosted engine has to pull its source
 * out of object storage and stage it, but here the file is already on the same
 * disk ffmpeg will read from, and copying a two-gigabyte recording to achieve
 * nothing is the single most obvious waste in a straight port.
 */
export const ingest = async (input: IngestInput, deps: IngestDeps): Promise<IngestResult> => {
  const sourceType = sourceTypeOf(input.source);
  let mediaPath: string;
  let title: string | null = null;

  if (sourceType === "file") {
    mediaPath = path.resolve(input.source);
    try {
      await stat(mediaPath);
    } catch {
      throw new LirovoError("SOURCE_NOT_FOUND", `no such file: ${mediaPath}`, { stage: "ingest" });
    }
    title = path.basename(mediaPath);
  } else {
    if (deps.ytDlp === null) {
      throw new LirovoError("DEPENDENCY_MISSING", "yt-dlp is required to ingest a URL", { stage: "ingest" });
    }
    const outTemplate = path.join(deps.workDir, "source.%(ext)s");
    const { stdout } = await deps.exec(
      deps.ytDlp,
      [
        "-f",
        "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]/ba[ext=m4a]/ba/b",
        "--merge-output-format", "mp4",
        // The YouTube extractor needs a JS runtime and degrades loudly without one.
        "--js-runtimes", "node",
        "-N", "4",
        "--socket-timeout", "20",
        "--retries", "3",
        "--fragment-retries", "3",
        "--no-playlist",
        "--no-progress",
        "--no-update",
        "-o", outTemplate,
        "--print", "after_move:title",
        "--print", "after_move:filepath",
        input.source,
      ],
      { cwd: deps.workDir, signal: input.signal, timeoutMs: 30 * 60 * 1000 },
    ).catch((error: unknown) => {
      if (error instanceof LirovoError && (error.code === "CANCELLED" || error.code === "TIMED_OUT")) throw error;
      // The raw failure is forty lines of banner and a server status code.
      // Summarise it, then say what to do about it.
      const raw = error instanceof Error ? error.message : String(error);
      throw new LirovoError("DOWNLOAD_FAILED", explainYtDlpError(summarizeYtDlpFailure(raw)), { stage: "ingest" });
    });

    const printed = parseYtDlpPrints(stdout);
    title = printed.title;
    // yt-dlp's printed path is authoritative when present; scanning the work
    // directory covers the versions and formats where it prints nothing useful.
    if (printed.filePath !== null && printed.filePath.startsWith(deps.workDir)) {
      mediaPath = printed.filePath;
    } else {
      const found = (await readdir(deps.workDir)).find((f) => f.startsWith("source.") && !isPartialDownload(f));
      if (found === undefined) throw new LirovoError("DOWNLOAD_FAILED", "yt-dlp wrote no media", { stage: "ingest" });
      mediaPath = path.join(deps.workDir, found);
    }
  }

  const probe = await probeMedia(deps.exec, deps.ffprobe, mediaPath).catch((error: unknown) => {
    // Only the two that mean "the user stopped this" survive as themselves.
    // Everything else — including the exec wrapper's own INTERNAL for a
    // non-zero exit — is a file ffprobe would not read, and saying INTERNAL
    // about a corrupt download blames the app for the file.
    if (error instanceof LirovoError && (error.code === "CANCELLED" || error.code === "TIMED_OUT")) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new LirovoError("PROBE_FAILED", `ffprobe could not read ${path.basename(mediaPath)}: ${detail}`, {
      stage: "ingest",
    });
  });

  if (!probe.hasAudio && !probe.hasVideo) {
    throw new LirovoError("SOURCE_UNSUPPORTED", "the source has neither an audio nor a video track", {
      stage: "ingest",
    });
  }

  const manifest: SourceManifest = {
    source_type: sourceType,
    duration_s: probe.durationS,
    codec: probe.codec,
    has_audio: probe.hasAudio,
    has_video: probe.hasVideo,
    ext: path.extname(mediaPath),
    title,
    source_path: mediaPath,
    content_sha256: await hashFile(mediaPath),
  };

  await deps.store.put(input.runId, ARTIFACT_PATHS.sourceManifest, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, mediaPath };
};
