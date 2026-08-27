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
 * Remove the data directory.
 *
 * This is what uninstall means for an app whose entire state is one folder.
 * The directory is recreated empty so the next call finds somewhere to write
 * rather than failing on a missing parent.
 */
export const purgeEverything = async (paths: LirovoPaths): Promise<{ freedBytes: number }> => {
  const freedBytes = await directorySize(paths.data);
  await rm(paths.data, { recursive: true, force: true });
  await mkdir(paths.data, { recursive: true });
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
