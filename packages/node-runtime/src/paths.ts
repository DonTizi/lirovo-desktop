import { homedir } from "node:os";
import path from "node:path";
import type { LirovoPaths } from "@lirovo/core";

/**
 * Resolve every path the app owns.
 *
 * `LIROVO_DATA_DIR` exists so a test, a spike or a second profile can run
 * against a throwaway tree instead of the user's real library.
 */
export const resolvePaths = (
  env: NodeJS.ProcessEnv = process.env,
  bundledBin: string | null = null,
): LirovoPaths => {
  // `LIROVO_BUNDLED_BIN` overrides the caller, so the packaged layout can be
  // exercised from the CLI: point it at a built .app's Resources/bin and
  // `lirovo doctor` answers exactly as the app would, without launching one.
  const bundled = env["LIROVO_BUNDLED_BIN"] ?? bundledBin;
  const data =
    env["LIROVO_DATA_DIR"] ??
    path.join(homedir(), "Library", "Application Support", "Lirovo");
  return {
    data,
    runs: path.join(data, "runs"),
    models: path.join(data, "models"),
    bundledBin: bundled,
    dbFile: path.join(data, "lirovo.db"),
  };
};
