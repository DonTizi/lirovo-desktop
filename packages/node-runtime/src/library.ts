import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { LirovoPaths } from "@lirovo/core";
import type { Db } from "./store/db.js";

export interface StorageReport {
  readonly dataDir: string;
  readonly runCount: number;
  readonly runsBytes: number;
  readonly modelsBytes: number;
  readonly binBytes: number;
  readonly dbBytes: number;
}

/**
 * Bytes under a directory, or zero when it is not there.
 *
 * A missing directory is not an error here: on a first launch none of them
 * exist, and a settings page that fails to render because the models folder
 * has not been created yet is worse than one that says nothing is stored.
 */
export const directorySize = async (dir: string): Promise<number> => {
  let total = 0;
  const walk = async (at: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(at, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) await walk(full);
      else total += (await stat(full).catch(() => ({ size: 0 }))).size;
    }
  };
  await walk(dir);
  return total;
};

export const storageReport = async (paths: LirovoPaths, db: Db): Promise<StorageReport> => {
  const [runsBytes, modelsBytes, binBytes, dbBytes] = await Promise.all([
    directorySize(paths.runs),
    directorySize(paths.models),
    directorySize(path.join(paths.data, "bin")),
    stat(paths.dbFile)
      .then((s) => s.size)
      .catch(() => 0),
  ]);
  return {
    dataDir: paths.data,
    runCount: (db.prepare("SELECT COUNT(*) AS n FROM runs").get() as { n: number }).n,
    runsBytes,
    modelsBytes,
    binBytes,
    dbBytes,
  };
};

/**
 * Remove the extractions, keep what took a decision or a download.
 *
 * Schemas, settings and the speech model survive: a person clearing 20GB of
 * frames is reclaiming disk, not starting over, and making them re-download
 * 574MB and rebuild their schemas to do it would mean they never do it.
 *
 * The rows go with the files. A run row whose artifacts are gone is a row that
 * opens onto a broken page, and a library full of those is worse than an empty
 * one.
 */
export const purgeRuns = async (paths: LirovoPaths, db: Db): Promise<{ freedBytes: number }> => {
  const freedBytes = await directorySize(paths.runs);
  await rm(paths.runs, { recursive: true, force: true });
  await mkdir(paths.runs, { recursive: true });
  const clear = db.transaction(() => {
    db.exec("DELETE FROM runs");
    // Sources are only meaningful through a run; the FK is on runs, not the
    // other way round, so they have to be swept after.
    db.exec("DELETE FROM sources WHERE id NOT IN (SELECT source_id FROM runs)");
  });
  clear.immediate();
  return { freedBytes };
};

/**
 * Everything this app creates, and nothing else.
 *
 * Named children, never the root. `LIROVO_DATA_DIR` is an env var — it exists
 * so a test or a second profile can run against a throwaway tree — and a
 * recursive delete of whatever it points at turns `LIROVO_DATA_DIR=$HOME`
 * plus one confirmation into an erased home directory. Nothing about the
 * feature requires removing the directory itself, so it does not.
 *
 * The list is exhaustive by construction: every path this app writes is
 * derived from `paths`, and `bin/` is the only one not on that record.
 */
const OWNED = ["runs", "models", "bin"] as const;

export const purgeEverything = async (paths: LirovoPaths): Promise<{ freedBytes: number }> => {
  const freedBytes = await directorySize(paths.data);

  for (const child of OWNED) {
    await rm(path.join(paths.data, child), { recursive: true, force: true });
  }
  // The database and the two files SQLite keeps beside it in WAL mode.
  for (const suffix of ["", "-wal", "-shm"]) {
    await rm(`${paths.dbFile}${suffix}`, { force: true });
  }
  // Recreated empty, the way purgeRuns leaves its directory: the next write
  // needs somewhere to go, and a missing parent fails in a way that reads as a
  // bug rather than as a clean slate.
  await mkdir(paths.runs, { recursive: true });
  await mkdir(paths.models, { recursive: true });
  return { freedBytes };
};

/**
 * Is this path inside the directory this app owns?
 *
 * The renderer asks the system to reveal a file. Without this it could name
 * any path on the disk and have Finder open it, which is a small hole that
 * only stays small until something else reads from the same argument.
 */
export const withinDataDir = (candidate: string, dataDir: string): boolean => {
  const root = path.resolve(dataDir);
  const target = path.resolve(candidate);
  return target === root || target.startsWith(`${root}${path.sep}`);
};
