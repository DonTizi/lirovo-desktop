import { DEPENDENCIES } from "./dependencies.js";

/**
 * Every command this app is willing to run on somebody's behalf, by id.
 *
 * The window never sends a command. It sends an id — `"ffmpeg"`, `"codex"` —
 * and the process that owns the shell looks the command up here. A first draft
 * passed the command string across the bridge with a length cap on it, which
 * is the same design with a smaller hole: the renderer is a web page, it runs
 * whatever a bug lets in, and a channel that carries a command to a shell
 * belongs to whoever finds that bug. An id cannot express `rm -rf ~`.
 *
 * So this table is the entire vocabulary. Anything not in it cannot be run,
 * and adding to it is a code change that gets read.
 */

export type FixId = "ffmpeg" | "ffprobe" | "yt-dlp" | "whisper-cli" | "local" | "codex" | "claude";

/** Where a thing comes from, for the cases a command cannot finish alone. */
export interface FixPlan {
  readonly command: string;
  /** Shown when the command fails, so there is somewhere left to go. */
  readonly homepage: string | null;
  /**
   * Whether running it can plausibly finish the job.
   *
   * Ollama is the honest `false`: `brew install ollama` puts the binary there
   * and the app still is not running, because a server has to be started and a
   * model pulled. Saying so beforehand is better than a green tick over a row
   * that stays amber.
   */
  readonly selfContained: boolean;
}

const fromDependencies = (): Record<string, FixPlan> =>
  Object.fromEntries(
    DEPENDENCIES.map((d) => [d.id, { command: d.install, homepage: null, selfContained: true }]),
  );

export const FIXES: Readonly<Record<FixId, FixPlan>> = {
  ...(fromDependencies() as Record<FixId, FixPlan>),
  local: {
    command: "brew install ollama",
    homepage: "https://ollama.com/download",
    // Installing it is not running it. The row stays off until `ollama serve`
    // and a model pull, neither of which belongs in a one-shot button.
    selfContained: false,
  },
  codex: {
    command: "npm i -g @openai/codex",
    homepage: "https://github.com/openai/codex",
    selfContained: true,
  },
  claude: {
    command: "npm i -g @anthropic-ai/claude-code",
    homepage: "https://claude.ai/code",
    selfContained: true,
  },
};

/** Null for anything this app will not run, which is everything not above. */
export const planFor = (id: string): FixPlan | null =>
  Object.prototype.hasOwnProperty.call(FIXES, id) ? (FIXES[id as FixId] ?? null) : null;
