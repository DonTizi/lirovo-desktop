import {
  BREW_ONLY,
  DEFAULT_WHISPER_MODEL_ID,
  INSTALL_HOMEBREW,
  WHISPER_MODELS,
  YT_DLP,
  whisperModelInstallable,
  type Installable,
} from "@lirovo/core";
import { installArtifact, resolveBinary, resolvePaths, type InstallProgress } from "@lirovo/node-runtime";
import { EXIT, type ExitCode } from "../exit-codes.js";

export interface InstallOptions {
  /** Which whisper model to fetch. */
  readonly model: string;
  readonly json: boolean;
}

const mb = (n: number): string => `${(n / 1_000_000).toFixed(0)} MB`;

/**
 * A progress line, drawn only when it would change.
 *
 * `fetch` hands over a chunk every few kilobytes, so redrawing per chunk is
 * thousands of writes for one download — invisible on a terminal that honours
 * `\r`, and half a megabyte of output in a log that does not. It redraws on a
 * whole percent, and falls back to one line per ten percent when stdout is not
 * a terminal, which is what a CI log or a piped run actually wants.
 */
const makeBar = (label: string, out: (s: string) => void, tty: boolean): ((r: number, t: number | null) => void) => {
  let last = -1;
  const step = tty ? 1 : 10;
  return (received, total) => {
    const pct = total === null ? null : Math.min(100, Math.round((received / total) * 100));
    const mark = pct === null ? Math.floor(received / 5_000_000) : Math.floor(pct / step);
    if (mark === last) return;
    last = mark;
    const width = 24;
    const filled = pct === null ? 0 : Math.round((pct / 100) * width);
    const track = pct === null ? "".padEnd(width, "·") : "".padEnd(filled, "█").padEnd(width, "·");
    const line = `  ${label.padEnd(14)} ${track} ${pct === null ? mb(received) : `${pct}%`}   `;
    out(tty ? `\r${line}` : `${line}\n`);
  };
};

export const installCommand = async (
  opts: InstallOptions,
  stdout: (s: string) => void,
  write: (s: string) => void = (s) => process.stdout.write(s),
): Promise<ExitCode> => {
  const paths = resolvePaths();
  const model = whisperModelInstallable(opts.model);
  if (model === null) {
    stdout(`unknown model "${opts.model}". Known: ${WHISPER_MODELS.map((m) => m.id).join(", ")}`);
    return EXIT.usage;
  }

  // Skip what the machine already has. Downloading a second yt-dlp over a
  // working one wastes 37MB and then shadows it — and the copy it shadows may
  // be the faster-starting Homebrew build.
  const already = await resolveBinary("yt-dlp", paths);
  const wanted: Installable[] = already === null ? [model, YT_DLP] : [model];
  if (already !== null && !opts.json) {
    stdout(`  yt-dlp         already on this Mac (${already.origin}) — leaving it alone`);
  }
  const done: { id: string; path: string; alreadyPresent: boolean }[] = [];

  const tty = process.stdout.isTTY === true;
  for (const item of wanted) {
    const bar = makeBar(item.id, write, tty);
    if (!opts.json) bar(0, item.bytes);
    try {
      const result = await installArtifact(item, paths, {
        ...(opts.json ? {} : { onProgress: (p: InstallProgress) => bar(p.received, p.total) }),
      });
      done.push({ id: item.id, path: result.path, alreadyPresent: result.alreadyPresent });
      if (!opts.json) {
        const done = `  ${item.id.padEnd(14)} ${result.alreadyPresent ? "already there" : `installed · ${mb(result.bytes)}`}`;
        write(tty ? `\r${done}${" ".repeat(30)}\n` : `${done}\n`);
      }
    } catch (error) {
      if (!opts.json) write("\n");
      stdout(`  ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
      return EXIT.unavailable;
    }
  }

  // The two with no artifact to fetch. Said plainly rather than hidden behind
  // a button that would have to shell out to a package manager the user may
  // not have — and if they do not have it, that is the first thing to fix.
  const brew = await resolveBinary("brew", paths);
  const missing: string[] = [];
  for (const dep of BREW_ONLY) {
    if ((await resolveBinary(dep.id, paths)) === null) missing.push(dep.formula);
  }

  if (opts.json) {
    stdout(JSON.stringify({ ok: true, installed: done, brew: { present: brew !== null, missing } }, null, 2));
    return EXIT.ok;
  }

  if (missing.length > 0) {
    stdout("");
    stdout("still needed, and only Homebrew ships them for macOS:");
    if (brew === null) {
      stdout("  Homebrew itself is not installed. Run this first:");
      stdout(`    ${INSTALL_HOMEBREW}`);
    }
    stdout(`    brew install ${missing.join(" ")}`);
  }

  stdout("");
  stdout(`data directory  ${paths.data}`);
  stdout(missing.length === 0 ? "everything is in place" : "run the command above, then `lirovo doctor`");
  return EXIT.ok;
};
