import { lstat, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { LirovoPaths } from "@lirovo/core";
import type { Db } from "./store/db.js";
import { LirovoError } from "@lirovo/contracts";
import { assertNoExtractionProcesses, ownerProcessIsGone } from "./store/processes.js";

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
  return purgeOwned(paths, db, false);
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

export const purgeEverything = async (paths: LirovoPaths, db: Db): Promise<{ freedBytes: number }> => purgeOwned(paths, db, true);

async function inspectOwnedTree(at: string): Promise<number> {
  const info = await lstat(at).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error; });
  if (info === null) return 0;
  if (info.isSymbolicLink()) throw new Error(`Refusing to purge a symbolic link: ${at}`);
  if (!info.isDirectory()) return info.size;
  let total = 0;
  for (const entry of await readdir(at)) total += await inspectOwnedTree(path.join(at, entry));
  return total;
}

/** The caller gives this async operation exclusive use of its DB connection. */
async function purgeOwned(paths: LirovoPaths, db: Db, everything: boolean): Promise<{ freedBytes: number }> {
  const root = path.resolve(paths.data);
  if (root === path.parse(root).root || path.resolve(paths.runs) !== path.join(root, "runs") || path.resolve(paths.models) !== path.join(root, "models") || path.resolve(paths.dbFile) !== path.join(root, "lirovo.db")) {
    throw new Error("Refusing to purge an unexpected library layout.");
  }
  const targets = (everything ? OWNED : ["runs"]).map((child) => path.join(root, child));
  // Never unlink the database, WAL or SHM: another process may already have
  // this inode open. Its startup/journal write must contend on this same lock.
  db.exec("BEGIN IMMEDIATE");
  let changed = false;
  let removedBytes = 0;
  try {
    assertNoExtractionProcesses(db);
    const leases = db.prepare<[], { lease_owner: string | null; lease_expires_at: number | null }>("SELECT lease_owner, lease_expires_at FROM runs WHERE lease_owner IS NOT NULL").all();
    if (leases.some((run) => (run.lease_expires_at ?? 0) >= Date.now() / 1000 || !ownerProcessIsGone(run.lease_owner!)) ||
      db.prepare("SELECT run_id FROM extraction_queue WHERE status IN ('queued','running') LIMIT 1").get()) {
      throw new LirovoError("STORE_BUSY", "Stop active extractions and queued work before deleting library data.");
    }
    for (let ancestor = root; ; ancestor = path.dirname(ancestor)) {
      const info = await lstat(ancestor);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Refusing to purge a linked library directory.");
      if (ancestor === path.dirname(ancestor)) break;
    }
    const sizes: number[] = [];
    for (const target of targets) sizes.push(await inspectOwnedTree(target));
    db.exec("DELETE FROM extraction_queue; DELETE FROM extraction_processes; DELETE FROM runs; DELETE FROM sources;");
    if (everything) db.exec("DELETE FROM schema_revisions; DELETE FROM schemas; DELETE FROM settings;");
    changed = true;
    for (const [index, target] of targets.entries()) {
      await rm(target, { recursive: true, force: true });
      removedBytes += sizes[index] ?? 0;
      await mkdir(target, { recursive: true });
    }
    db.exec("COMMIT");
    return { freedBytes: removedBytes };
  } catch (error) {
    // Deletion cannot be rolled back. Once it starts, retain the logical clear
    // rather than resurrecting rows whose files may already have been removed.
    if (changed) {
      try { db.exec("COMMIT"); } catch { try { db.exec("ROLLBACK"); } catch { /* Preserve the original failure. */ } }
      throw new Error(`Library reset was only partially completed; some files may remain. ${String(error)}`);
    }
    try { db.exec("ROLLBACK"); } catch { /* Preserve the original failure. */ }
    throw error;
  }
}

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
