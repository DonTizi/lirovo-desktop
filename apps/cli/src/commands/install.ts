import {
  BREW_ONLY,
  DEFAULT_WHISPER_MODEL_ID,
  INSTALL_HOMEBREW,
  WHISPER_MODELS,
  YT_DLP,
  whisperModelInstallable,
  type Installable,
} from "@lirovo/core";
import {
  STALE_AFTER_DAYS,
  installArtifact,
  parseVersion,
  realExec,
  resolveBinary,
  resolvePaths,
  versionAgeDays,
  type InstallProgress,
} from "@lirovo/node-runtime";
import { EXIT, type ExitCode } from "../exit-codes.js";

export interface InstallOptions {
  /** Which whisper model to fetch. */
  readonly model: string;
  readonly json: boolean;
}

const mb = (n: number): string => `${(n / 1_000_000).toFixed(0)} MB`;

/**
 * How old the yt-dlp at this path is, in days.
 *
 * Unreadable version, unparseable version, or a binary that will not run: all
 * answer zero, which reads as fresh. Guessing "stale" from a failed probe
 * would download 37MB every time the probe was merely unlucky.
 */
const ageInDays = async (bin: string): Promise<number> => {
  try {
    const result = await realExec(bin, ["--version"], { timeoutMs: 30_000 });
    return versionAgeDays(parseVersion(result.stdout)) ?? 0;
  } catch {
    return 0;
  }
};

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

  // Skip what the machine already has, unless what it has has gone stale.
  //
  // Downloading a second yt-dlp over a working one wastes 37MB and then
  // shadows it — and the copy it shadows may be the faster-starting Homebrew
  // one. But a copy bundled inside a DMG is frozen at the day that DMG was
  // built, and yt-dlp older than ninety days stops being able to download from
  // YouTube while still reading metadata fine. Refusing to refresh it leaves
  // the one failure this command exists to fix.
  const already = await resolveBinary("yt-dlp", paths);
  const stale = already === null ? false : (await ageInDays(already.path)) > STALE_AFTER_DAYS;
  const fetchYtDlp = already === null || (already.origin === "bundled" && stale);
  const wanted: Installable[] = fetchYtDlp ? [model, YT_DLP] : [model];
  if (already !== null && !opts.json) {
    stdout(
      fetchYtDlp
        ? `  yt-dlp         the bundled copy is over ${STALE_AFTER_DAYS} days old — fetching a current one`
        : `  yt-dlp         already on this Mac (${already.origin}) — leaving it alone`,
    );
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
