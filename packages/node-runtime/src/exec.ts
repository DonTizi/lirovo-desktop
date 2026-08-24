import { spawn } from "node:child_process";
import type { Exec, ExecOptions, ExecResult } from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

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
export const realExec: Exec = (bin, args, opts: ExecOptions = {}): Promise<ExecResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, [...args], {
      cwd: opts.cwd,
      env: opts.env as NodeJS.ProcessEnv | undefined,
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

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

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      const code = error.code === "ENOENT" ? "DEPENDENCY_MISSING" : "INTERNAL";
      finish(() => reject(new LirovoError(code, `${bin}: ${error.message}`, { detail: { bin } })));
    });

    child.on("close", (exitCode) => {
      finish(() => {
        if (exitCode === 0) {
          resolve({ stdout, stderr });
          return;
        }
        reject(
          new LirovoError("INTERNAL", `${bin} exited ${exitCode}: ${stderr.trim() || stdout.trim()}`, {
            detail: { bin, args, exitCode },
          }),
        );
      });
    });

    if (opts.stdin !== undefined) child.stdin.end(opts.stdin);
    else child.stdin.end();
  });
