import { stat } from "node:fs/promises";
import path from "node:path";
import type { ArtifactStore, Exec, NormalizeResult, SourceManifest } from "@lirovo/contracts";
import { ARTIFACT_PATHS, LirovoError } from "@lirovo/contracts";

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
}

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
