import { spawn } from "node:child_process";

/**
 * Running the command the app just told somebody to run.
 *
 * The alternative was a button that copied a string, which is not an action —
 * you press Install, nothing installs, and the row stays amber. If this app
 * knows the command well enough to print it, it can run it.
 *
 * Two things make this harder than it sounds, and both are handled here.
 *
 * A LOGIN SHELL, not a bare spawn. `npm`, `brew` and `ollama` are on the PATH
 * that a shell builds from the user's profile — nvm in particular exists only
 * as a shell function sourced from `.zshrc`. An app launched from the Finder
 * has none of that: launchd gives it `/usr/bin:/bin:/usr/sbin:/sbin`. Spawning
 * `sh -lc` is what makes `npm i -g` mean the same thing here as it does in the
 * terminal the command was written for.
 *
 * A TIMEOUT that fits the work. `npm i -g` on a cold cache is minutes, not
 * seconds, and a timeout tuned for a version probe would report failure on an
 * install that was going to succeed.
 *
 * These commands are the app's own constants — `brew install ffmpeg`,
 * `npm i -g @openai/codex` — never anything a user or a server supplied. That
 * is the only reason handing them to a shell is acceptable.
 */

export interface FixOutcome {
  readonly ok: boolean;
  readonly code: number | null;
  /** Combined stdout and stderr, trimmed. What a person needs when it fails. */
  readonly output: string;
}

/** Enough for a cold `npm i -g`, short enough that a hung command still ends. */
const TIMEOUT_MS = 6 * 60 * 1000;

/** The tail is where the error is; the head is npm telling you about funding. */
const LAST_LINES = 40;

const tail = (text: string): string => text.trim().split("\n").slice(-LAST_LINES).join("\n").trim();

export const runFix = async (
  command: string,
  opts: { readonly signal?: AbortSignal; readonly shell?: string } = {},
): Promise<FixOutcome> =>
  new Promise((resolve) => {
    const child = spawn(opts.shell ?? "/bin/sh", ["-lc", command], {
      stdio: ["ignore", "pipe", "pipe"],
      // No inherited stdin: a command that decides to prompt would otherwise
      // wait forever on a terminal that does not exist.
    });

    let out = "";
    const take = (chunk: Buffer): void => {
      out += chunk.toString();
      // A runaway command must not grow the buffer without bound. The tail is
      // what gets reported anyway.
      if (out.length > 200_000) out = out.slice(-100_000);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, code: null, output: tail(`${out}\n\ntimed out after ${TIMEOUT_MS / 60000} minutes`) });
    }, TIMEOUT_MS);
    timer.unref?.();

    const stop = (): void => {
      child.kill("SIGKILL");
    };
    opts.signal?.addEventListener("abort", stop, { once: true });

    child.on("error", (error) => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", stop);
      resolve({ ok: false, code: null, output: tail(`${out}\n${error.message}`) });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", stop);
      resolve({ ok: code === 0, code, output: tail(out) });
    });
  });
