import { access, constants } from "node:fs/promises";
import path from "node:path";
import type { Exec } from "@lirovo/contracts";
import type { BinaryStatus, DependencySpec, LirovoPaths } from "@lirovo/core";

/** Homebrew's two prefixes: Apple Silicon first, then Intel. */
const HOMEBREW_PREFIXES = ["/opt/homebrew/bin", "/usr/local/bin"] as const;

const isExecutable = async (candidate: string): Promise<boolean> => {
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

interface Resolved {
  readonly path: string;
  readonly origin: BinaryStatus["origin"];
}

/**
 * Bundled, then what this app installed, then PATH, then Homebrew.
 *
 * Bundled wins so a signed build uses the binary it was notarised with rather
 * than whatever the user happens to have installed. The app's own `bin`
 * directory comes next: `lirovo install` downloads a verified yt-dlp there,
 * and a Mac with no Homebrew has nothing on PATH to find — without this step
 * the download lands somewhere nothing ever looks. Homebrew is last so a
 * developer machine still works with nothing bundled and nothing installed.
 */
export const resolveBinary = async (
  id: string,
  paths: LirovoPaths,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Resolved | null> => {
  if (paths.bundledBin !== null) {
    const bundled = path.join(paths.bundledBin, id);
    if (await isExecutable(bundled)) return { path: bundled, origin: "bundled" };
  }
  const installed = path.join(paths.data, "bin", id);
  if (await isExecutable(installed)) return { path: installed, origin: "installed" };
  for (const dir of (env["PATH"] ?? "").split(path.delimiter)) {
    if (dir === "") continue;
    const candidate = path.join(dir, id);
    if (await isExecutable(candidate)) {
      const origin: BinaryStatus["origin"] = HOMEBREW_PREFIXES.includes(dir as never) ? "homebrew" : "path";
      return { path: candidate, origin };
    }
  }
  for (const prefix of HOMEBREW_PREFIXES) {
    const candidate = path.join(prefix, id);
    if (await isExecutable(candidate)) return { path: candidate, origin: "homebrew" };
  }
  return null;
};

/**
 * How old a yt-dlp build is, from its date-shaped version.
 *
 * yt-dlp warns past ninety days for a reason: YouTube changes its player
 * regularly and an old build stops being able to download, while still
 * reading metadata perfectly well. That asymmetry is what makes it look like
 * the video is fine right up until the download fails.
 */
export const versionAgeDays = (version: string | null, today = new Date()): number | null => {
  const match = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(version ?? "");
  if (match === null) return null;
  const built = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Math.floor((today.getTime() - built) / 86_400_000);
};

export const STALE_AFTER_DAYS = 90;

/** First line that looks like a version, or the first non-empty line. */
export const parseVersion = (output: string): string | null => {
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const match = /\b\d+\.\d+(\.\d+)?\b/.exec(trimmed);
    return match ? match[0] : trimmed.slice(0, 60);
  }
  return null;
};

export const makeBinaryProbe =
  (paths: LirovoPaths, exec: Exec, env: NodeJS.ProcessEnv = process.env) =>
  async (spec: DependencySpec): Promise<BinaryStatus> => {
    const resolved = await resolveBinary(spec.id, paths, env);
    if (resolved === null) {
      return {
        id: spec.id,
        found: false,
        path: null,
        origin: null,
        version: null,
        required: spec.required,
        why: spec.why,
        stale: null,
        fix: { label: "Install", command: spec.install },
      };
    }
    // A binary that resolves but cannot run is a missing binary as far as the
    // pipeline is concerned, so the version probe is part of the check.
    let version: string | null = null;
    try {
      const { stdout, stderr } = await exec(resolved.path, spec.versionArgs, {
        env: { PATH: env["PATH"] ?? "" },
        // Thirty seconds, because yt-dlp's standalone macOS build is a
        // PyInstaller bundle that unpacks itself on EVERY launch: measured at
        // 9.7s to answer `--version`, cold or warm. At the old ten-second
        // ceiling the probe raced it and usually lost, so a perfectly good
        // binary reported no version — and with no version there is no date,
        // and with no date the staleness warning that predicts the 403 can
        // never fire.
        timeoutMs: 30_000,
      });
      version = parseVersion(stdout || stderr);
    } catch {
      version = null;
    }
    // Only yt-dlp goes stale in a way that matters: its version IS a date, and
    // the platforms it reads change under it. ffmpeg from last year is fine.
    const age = spec.id === "yt-dlp" ? versionAgeDays(version) : null;
    // A stale binary is upgraded, not installed, and the command differs by
    // where it came from. The probe is the only place that knows which.
    const stale = age !== null && age > STALE_AFTER_DAYS;
    return {
      id: spec.id,
      found: true,
      path: resolved.path,
      origin: resolved.origin,
      version,
      required: spec.required,
      why: spec.why,
      stale: stale ? `${age} days old — platforms change and old builds stop being able to download` : null,
      fix: stale
        ? {
            label: "Update",
            command: resolved.origin === "homebrew" ? `brew upgrade ${spec.id}` : `${spec.id} -U`,
          }
        : null,
    };
  };
