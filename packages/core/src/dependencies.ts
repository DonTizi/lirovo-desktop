/**
 * The external binaries the pipeline shells out to.
 *
 * `required: false` means the pipeline degrades without it rather than
 * refusing to start: a user extracting local files never needs yt-dlp.
 */
export interface DependencySpec {
  readonly id: "ffmpeg" | "ffprobe" | "yt-dlp" | "whisper-cli";
  readonly required: boolean;
  readonly why: string;
  /** Argument that makes the binary print its version and exit 0. */
  readonly versionArgs: readonly string[];
}

export const DEPENDENCIES: readonly DependencySpec[] = [
  { id: "ffmpeg", required: true, why: "normalize audio and extract frames", versionArgs: ["-version"] },
  { id: "ffprobe", required: true, why: "read duration and stream layout", versionArgs: ["-version"] },
  { id: "yt-dlp", required: false, why: "download from a URL and fetch subtitles", versionArgs: ["--version"] },
  { id: "whisper-cli", required: false, why: "transcribe locally when there are no subtitles", versionArgs: ["--help"] },
];

export interface BinaryStatus {
  readonly id: DependencySpec["id"];
  readonly found: boolean;
  /** Where it resolved from, so a user can tell bundled from Homebrew. */
  readonly path: string | null;
  readonly origin: "bundled" | "path" | "homebrew" | null;
  readonly version: string | null;
  readonly required: boolean;
  readonly why: string;
}
