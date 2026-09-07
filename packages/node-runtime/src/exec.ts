import { spawn } from "node:child_process";
import type { Writable } from "node:stream";
import type { Exec, ExecOptions, ExecResult } from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

export interface ExecTracking {
  /** Commit the process-group journal synchronously. Throw to refuse startup. */
  readonly onSpawn: (pid: number) => void;
}

// fd 3 is exclusively the startup gate: the target's entire stdin is untouched.
// Arguments are positional parameters, never source text interpreted by a shell.
const START_GATE = 'IFS= read -r lirovo_token <&3 || exit 125; [ "$lirovo_token" = "lirovo-start" ] || exit 125; command -v "$1" >/dev/null 2>&1 || exit 127; exec "$@" 3<&-';

/** Extraction-only adapter: no target code runs until its group is journaled. */
export const createTrackedExec = (tracking: ExecTracking): Exec => {
  if (process.platform === "win32") {
    return async () => { throw new LirovoError("DEPENDENCY_MISSING", "Safe extraction process tracking requires macOS or Linux."); };
  }
  return (bin, args, opts) => execute(bin, args, opts, tracking);
};

/**
 * Spawn a child process.
 *
 * Two decisions worth knowing about:
 *
 * - The child runs in its own process group (`detached`) and cancellation
 *   signals the whole group. ffmpeg and yt-dlp both spawn helpers; killing only
 *   the parent leaves those orphans running and holding the work directory.
 * - `env` REPLACES the environment rather than merging into it. Every caller
 *   states what the child may see, so an agent CLI cannot silently inherit
 *   `ANTHROPIC_API_KEY`, `AWS_*` or anything else that happens to be exported.
 */
export const realExec: Exec = (bin, args, opts) => execute(bin, args, opts);

const execute = (bin: string, args: readonly string[], opts: ExecOptions = {}, tracking?: ExecTracking): Promise<ExecResult> =>
  new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new LirovoError("CANCELLED", `${bin} cancelled`, { detail: { bin } }));
      return;
    }
    const child = spawn(tracking ? "/bin/sh" : bin, tracking ? ["-c", START_GATE, "lirovo-exec", bin, ...args] : [...args], {
      cwd: opts.cwd,
      env: opts.env as NodeJS.ProcessEnv | undefined,
      detached: true,
      stdio: ["pipe", "pipe", "pipe", tracking ? "pipe" : "ignore"],
    });
    const gate = tracking ? child.stdio[3] as Writable : null;

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const killGroup = (signal: NodeJS.Signals): void => {
      if (child.pid === undefined) return;
      try {
        process.kill(-child.pid, signal);
      } catch {
        // The group is already gone; nothing to clean up.
      }
    };

    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      fn();
    };

    child.on("close", () => {
      if (killTimer !== undefined) clearTimeout(killTimer);
    });

    const timer = setTimeout(() => {
      killGroup("SIGKILL");
      finish(() =>
        reject(new LirovoError("TIMED_OUT", `${bin} exceeded ${timeoutMs}ms`, { detail: { bin, args } })),
      );
    }, timeoutMs);

    // SIGTERM first so the child can close its output file, then SIGKILL if it
    // is still alive. Measured: ffmpeg mid-transcode survives a lone SIGTERM
    // and keeps burning CPU after the run it belongs to is gone.
    const GRACE_MS = 2000;
    let killTimer: NodeJS.Timeout | undefined;

    const onAbort = (): void => {
      killGroup("SIGTERM");
      killTimer = setTimeout(() => killGroup("SIGKILL"), GRACE_MS);
      killTimer.unref();
      finish(() => reject(new LirovoError("CANCELLED", `${bin} cancelled`, { detail: { bin } })));
    };
    opts.signal?.addEventListener("abort", onAbort);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      const code = error.code === "ENOENT" ? "DEPENDENCY_MISSING" : "INTERNAL";
      finish(() => reject(new LirovoError(code, `${bin}: ${error.message}`, { detail: { bin } })));
    });

    // Early child exit may close these pipes before their pending writes drain.
    child.stdin?.on("error", () => {});
    gate?.on("error", (error) => {
      killGroup("SIGKILL");
      finish(() => reject(new LirovoError("INTERNAL", `Could not release the extraction startup gate: ${String(error)}`)));
    });
    if (tracking) child.once("spawn", () => {
      if (settled || opts.signal?.aborted) { gate?.end(); killGroup("SIGKILL"); return; }
      try {
        if (child.pid === undefined) throw new Error("The subprocess has no process identifier.");
        const receipt: unknown = tracking.onSpawn(child.pid);
        if (receipt !== null && typeof receipt === "object" && "then" in receipt) {
          void Promise.resolve(receipt).catch(() => {});
          throw new Error("The subprocess journal must commit synchronously before execution.");
        }
        if (opts.signal?.aborted) { onAbort(); return; }
        gate?.end("lirovo-start\n");
      } catch (error) {
        gate?.end();
        killGroup("SIGKILL");
        finish(() => reject(error));
      }
    });

    child.on("close", (exitCode) => {
      finish(() => {
        if (exitCode === 0) {
          resolve({ stdout, stderr });
          return;
        }
        reject(
          new LirovoError(tracking && exitCode === 127 ? "DEPENDENCY_MISSING" : "INTERNAL", `${bin} exited ${exitCode}: ${stderr.trim() || stdout.trim()}`, {
            detail: { bin, args, exitCode },
          }),
        );
      });
    });

    if (opts.stdin !== undefined) child.stdin?.end(opts.stdin);
    else child.stdin?.end();
  });
