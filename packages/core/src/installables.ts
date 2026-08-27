/**
 * What this app can put on a Mac that has nothing.
 *
 * Two of the four dependencies have an official, checksummed macOS artifact
 * and can simply be fetched. The other two do not, and pretending otherwise
 * would mean downloading an unsigned third-party build and running it — so
 * they carry the command a person runs instead, and the app says which is
 * which rather than blurring them into one "Install" button that sometimes
 * lies.
 *
 * Verified 2026-08-27 by fetching each one:
 *   yt-dlp        ships `yt-dlp_macos` plus SHA2-256SUMS on every release.
 *   whisper.cpp   publishes NO macOS binary — its latest release carries an
 *                 xcframework, Linux and Windows archives, and nothing else.
 *   ffmpeg        has no official macOS build at all; ffmpeg.org links to
 *                 third parties, and the one it links for macOS is Intel-only.
 */

export type InstallableId = "whisper-model" | "yt-dlp";

export interface Installable {
  readonly id: InstallableId;
  readonly label: string;
  /** Why someone would want it, in the terms the doctor uses. */
  readonly why: string;
  readonly url: string;
  /**
   * Known ahead of time, or fetched from a checksum file the publisher ships.
   * Never absent: a binary this app downloads and then executes is verified or
   * it is not installed.
   */
  readonly sha256: string | { readonly fromSumsFile: string; readonly name: string };
  readonly bytes: number | null;
  /** Where it lands, relative to the data directory. */
  readonly relPath: string;
  readonly executable: boolean;
}

/**
 * The default speech model.
 *
 * base.en at q5_1 is 60MB and transcribes an hour of English talk in a couple
 * of minutes on Apple Silicon. The multilingual and large variants are offered
 * too, because a French keynote is not an edge case.
 */
export const WHISPER_MODELS: readonly {
  readonly id: string;
  readonly file: string;
  readonly label: string;
  readonly about: string;
  readonly sha256: string;
  readonly bytes: number;
}[] = [
  {
    id: "base.en",
    file: "ggml-base.en-q5_1.bin",
    label: "Base, English",
    about: "60 MB · fast · English only",
    sha256: "4baf70dd0d7c4247ba2b81fafd9c01005ac77c2f9ef064e00dcf195d0e2fdd2f",
    bytes: 59_721_011,
  },
  {
    id: "base",
    file: "ggml-base-q5_1.bin",
    label: "Base, every language",
    about: "60 MB · fast · 99 languages",
    sha256: "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898",
    bytes: 59_707_625,
  },
  {
    id: "large-v3-turbo",
    file: "ggml-large-v3-turbo-q5_0.bin",
    label: "Large v3 turbo",
    about: "574 MB · slower · the most accurate",
    sha256: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2",
    bytes: 574_041_195,
  },
];

export const DEFAULT_WHISPER_MODEL_ID = "base.en";

const HF = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

export const whisperModelInstallable = (id: string): Installable | null => {
  const model = WHISPER_MODELS.find((m) => m.id === id);
  if (model === undefined) return null;
  return {
    id: "whisper-model",
    label: `Whisper — ${model.label}`,
    why: "transcribe locally when there are no subtitles",
    url: `${HF}/${model.file}`,
    sha256: model.sha256,
    bytes: model.bytes,
    relPath: `models/${model.file}`,
    executable: false,
  };
};

/**
 * yt-dlp's own macOS build.
 *
 * The checksum is read from the release's SHA2-256SUMS rather than pinned,
 * because `latest` moves and a pinned hash would mean shipping a stale
 * downloader — and a stale yt-dlp is exactly the failure this exists to avoid.
 * The file is still verified; the number just comes from the same release as
 * the binary.
 */
export const YT_DLP: Installable = {
  id: "yt-dlp",
  label: "yt-dlp",
  why: "download from a URL and fetch subtitles",
  url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos",
  sha256: {
    fromSumsFile: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS",
    name: "yt-dlp_macos",
  },
  bytes: null,
  relPath: "bin/yt-dlp",
  executable: true,
};

/** A checksum line is `<hex>  <name>`; the name is what identifies it. */
export const sha256FromSumsFile = (contents: string, name: string): string | null => {
  for (const line of contents.split("\n")) {
    const match = /^([0-9a-f]{64})\s+(.+?)\s*$/.exec(line.trim());
    if (match !== null && match[2] === name) return match[1] as string;
  }
  return null;
};

/**
 * The ones with no artifact to fetch.
 *
 * Homebrew is not a preference here, it is the only route: ffmpeg publishes no
 * macOS binary and whisper.cpp publishes none either. Bundling them inside a
 * signed app is the real answer and belongs to packaging, not to a downloader.
 */
export const BREW_ONLY: readonly { readonly id: string; readonly formula: string; readonly why: string }[] = [
  { id: "ffmpeg", formula: "ffmpeg", why: "cut frames and audio, read duration and streams" },
  { id: "whisper-cli", formula: "whisper-cpp", why: "run the speech model" },
];

/** Homebrew's own one-liner, for a Mac that does not have it yet. */
export const INSTALL_HOMEBREW =
  '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
