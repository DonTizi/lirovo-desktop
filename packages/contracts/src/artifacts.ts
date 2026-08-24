/**
 * On-disk artifact shapes.
 *
 * These keep the hosted pipeline's snake_case field names on purpose. The
 * golden fixture is a real hosted run, and a regression gate that has to
 * translate field names before comparing is a gate that can hide a difference.
 */

export const ARTIFACT_PATHS = {
  sourceManifest: "source/manifest.json",
  audio: "normalized/audio.flac",
  video: "normalized/video.mp4",
  framesManifest: "frames/manifest.json",
  rawFrame: (idx: number) => `frames/raw/${String(idx).padStart(6, "0")}.jpg`,
  dedupFrame: (idx: number) => `frames/dedup/${String(idx).padStart(6, "0")}.jpg`,
  transcript: "transcripts/asr.json",
  transcriptMarkdown: "transcripts/transcript.md",
  vision: "vision/analyses.json",
  graph: "graph/kg.json",
  graphCompact: "graph/kg.compact.json",
} as const;

export interface SourceManifest {
  readonly source_type: "youtube" | "vimeo" | "loom" | "url" | "file";
  readonly duration_s: number;
  readonly codec: string | null;
  readonly has_audio: boolean;
  readonly has_video: boolean;
  readonly ext: string;
  readonly title: string | null;
  /** Absolute path when the source is a local file we never copied. */
  readonly source_path: string;
  readonly content_sha256: string | null;
}

export interface RawFrameEntry {
  readonly idx: number;
  readonly t_ms: number;
  readonly source_pts: number;
}

export interface DedupFrameEntry {
  readonly idx: number;
  readonly t_ms: number;
  readonly kept: boolean;
  readonly cluster_id: number;
  readonly phash: string;
}

export interface FramesManifest {
  readonly raw: readonly RawFrameEntry[];
  readonly dedup?: readonly DedupFrameEntry[];
  readonly params: {
    readonly detector: string;
    readonly scene_threshold: number;
    readonly phash_hamming?: number;
  };
}

export interface NormalizeResult {
  readonly audio_path: string;
  readonly video_path: string | null;
  readonly duration_s: number;
  readonly audio_bytes: number;
  readonly video_bytes: number | null;
}
