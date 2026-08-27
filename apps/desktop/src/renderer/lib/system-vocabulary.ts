import type { AsrProbe, BackendStatus, BinaryStatus } from "@lirovo/core";

/**
 * What every surface calls the machine's parts, and how it colours them.
 *
 * This existed twice — once in the strip on the extract tab, once in the
 * Settings inventory — and the two copies had already drifted: the same
 * whisper-cpp was "Whisper" in one and "Whisper on this Mac" in the other, and
 * only one of them knew what ffprobe was. Naming the same thing two ways in
 * one app is the defect; the duplicated lines were only how it happened.
 *
 * The fuller names won, because they are the ones that read correctly beside
 * their neighbours: "Whisper on this Mac" next to "Whisper API" says which is
 * which, where two rows both called "Whisper" say nothing.
 */

/** Exactly the part of the doctor report the UI draws. */
export interface SystemReport {
  readonly ok: boolean;
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
  readonly dependencies: readonly BinaryStatus[];
  readonly backends: readonly BackendStatus[];
  readonly asr: readonly AsrProbe[];
  /** Which model the user picked for the next run, if they picked one. */
  readonly defaultBackendId: string | null;
}

export type Health = "ok" | "warn" | "off";

export const DOT: Record<Health, string> = { ok: "bg-success", warn: "bg-warning", off: "bg-danger" };

/** Worst first. A list in declaration order buries the one row that matters. */
export const RANK: Record<Health, number> = { off: 0, warn: 1, ok: 2 };

/**
 * Generic so a caller that has already narrowed its items — to the ones with a
 * fix, say — does not lose that narrowing by sorting them.
 */
export const worstFirst = <T extends { readonly health: Health }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => RANK[a.health] - RANK[b.health]);

/** Which rows this app can put right by itself, and what to fetch for them. */
export const FETCHABLE: Record<string, "whisper-model" | "yt-dlp"> = {
  "yt-dlp": "yt-dlp",
  "whisper-cpp": "whisper-model",
};

const NAMES: Record<string, string> = {
  ffmpeg: "FFmpeg",
  ffprobe: "FFprobe",
  "yt-dlp": "yt-dlp",
  "whisper-cli": "Whisper",
  local: "Ollama",
  codex: "Codex",
  claude: "Claude Code",
  captions: "Published subtitles",
  "whisper-cpp": "Whisper on this Mac",
  "whisper-api": "Whisper API",
};

const ROLES: Record<string, string> = {
  ffmpeg: "cuts frames and audio",
  ffprobe: "reads duration and streams",
  "yt-dlp": "downloads links and subtitles",
  "whisper-cli": "runs the speech model",
  local: "runs a model on this Mac",
  codex: "reads frames, builds the graph",
  claude: "reads frames, builds the graph",
  captions: "a free transcript when the platform has one",
  "whisper-cpp": "transcription on this Mac, no network",
  "whisper-api": "transcription off the machine",
};

/** The id itself when nothing knows better — a bare id beats an empty cell. */
export const label = (id: string): string => NAMES[id] ?? id;

export const roleOf = (id: string, fallback: string): string => ROLES[id] ?? fallback;
