import type { Fix } from "@lirovo/contracts";

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
  /** What a user runs to get it. Homebrew because that is what macOS has. */
  readonly install: string;
}

export const DEPENDENCIES: readonly DependencySpec[] = [
  {
    id: "ffmpeg",
    required: true,
    why: "normalize audio and extract frames",
    versionArgs: ["-version"],
    install: "brew install ffmpeg",
  },
  {
    id: "ffprobe",
    required: true,
    why: "read duration and stream layout",
    versionArgs: ["-version"],
    // Same formula as ffmpeg: they ship together and are never installed apart.
    install: "brew install ffmpeg",
  },
  {
    id: "yt-dlp",
    required: false,
    why: "download from a URL and fetch subtitles",
    versionArgs: ["--version"],
    install: "brew install yt-dlp",
  },
  {
    id: "whisper-cli",
    required: false,
    why: "transcribe locally when there are no subtitles",
    versionArgs: ["--help"],
    install: "brew install whisper-cpp",
  },
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
  /** Present when the binary works but is old enough to have stopped working. */
  readonly stale: string | null;
  /** What to do about it, when there is something to do. */
  readonly fix: Fix | null;
}
