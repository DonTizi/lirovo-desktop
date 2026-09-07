import type { DatabaseSync } from "node:sqlite";
import { hostname } from "node:os";
import { ownerProcessIsGone, processExists } from "./store/processes.js";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const INCOMPLETE = ".lirovo-incomplete";
export interface VerifiedFile { path: string; bytes: number; sha256: string }

const inside = (parent: string, child: string): boolean => child === parent || child.startsWith(`${parent}${sep}`);
export const exists = async (path: string): Promise<boolean> => {
  try { await lstat(path); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};

/** Reject links in every existing component, not only the final filename. */
export async function noSymlinks(path: string): Promise<void> {
  const absolute = resolve(path);
  let cursor = absolute;
  for (;;) {
    const info = await lstat(cursor);
    if (info.isSymbolicLink()) throw new Error(`Symbolic links are not supported in library transfers: ${cursor}`);
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}

export async function reserveDirectory(destination: string, excluded: readonly string[]): Promise<string> {
  if (!isAbsolute(destination) || destination.split(/[\\/]/).includes("..")) throw new Error("Choose an absolute new directory without parent traversal.");
  const target = resolve(destination);
  if (excluded.some((source) => inside(resolve(source), target) || inside(target, resolve(source))))
    throw new Error("Choose a new directory outside the source library and protected folders.");
  await noSymlinks(dirname(target));
  // Exclusive mkdir is the no-overwrite boundary. An incomplete directory is
  // not a published backup and is deliberately retained on failure.
  await mkdir(target, { mode: 0o700 });
  const marker = await open(join(target, INCOMPLETE), "wx", 0o600);
  try { await marker.writeFile("This transfer did not finish. Do not restore or activate this directory.\n"); await marker.sync(); }
  finally { await marker.close(); }
  return target;
}

export async function inventory(root: string): Promise<string[]> {
  await noSymlinks(root);
  const files: string[] = [];
  const walk = async (folder: string): Promise<void> => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not supported: ${path}`);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(relative(root, path).split(sep).join("/"));
      else throw new Error(`Unsupported filesystem entry: ${path}`);
    }
  };
  await walk(root);
  return files.sort();
}

export async function hashFile(path: string): Promise<{ bytes: number; sha256: string }> {
  await noSymlinks(path);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new Error(`Expected a regular file: ${path}`);
    const hash = createHash("sha256"); let bytes = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) { hash.update(chunk); bytes += chunk.length; }
    const after = await handle.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes !== after.size)
      throw new Error(`A source file changed during the transfer: ${path}`);
    return { bytes, sha256: hash.digest("hex") };
  } finally { await handle.close(); }
}

export async function copyVerified(source: string, destination: string): Promise<{ bytes: number; sha256: string }> {
  await noSymlinks(source);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await noSymlinks(dirname(destination));
  const input = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
  let output: Awaited<ReturnType<typeof open>> | null = null;
  try {
    const before = await input.stat();
    if (!before.isFile()) throw new Error(`Expected a regular file: ${source}`);
    output = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const hash = createHash("sha256"); let bytes = 0;
    for await (const chunk of input.createReadStream({ autoClose: false })) {
      hash.update(chunk); bytes += chunk.length;
      let written = 0;
      while (written < chunk.length) {
        const part = await output.write(chunk, written, chunk.length - written);
        if (part.bytesWritten === 0) throw new Error("The destination stopped accepting file data.");
        written += part.bytesWritten;
      }
    }
    await output.sync();
    const after = await input.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || after.size !== bytes)
      throw new Error(`A source file changed during transfer: ${source}`);
    return { bytes, sha256: hash.digest("hex") };
  } finally { await output?.close(); await input.close(); }
}

export async function verifyFiles(directory: string, files: readonly VerifiedFile[], controls: readonly string[]): Promise<void> {
  const actual = (await inventory(directory)).filter((file) => !controls.includes(file));
  const expected = files.map((file) => file.path).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("The transferred file inventory does not match its manifest.");
  for (const file of files) {
    const found = await hashFile(join(directory, file.path));
    if (found.bytes !== file.bytes || found.sha256 !== file.sha256) throw new Error(`Checksum verification failed for ${file.path}.`);
  }
}

export async function publish(directory: string): Promise<void> {
  const folder = await open(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { await folder.sync(); await unlink(join(directory, INCOMPLETE)); await folder.sync(); }
  finally { await folder.close(); }
}

/** Caller must hold BEGIN IMMEDIATE until its file snapshot is published. */
export function assertLibraryIdle(lock: DatabaseSync): void {
  const active = Number(lock.prepare("SELECT COUNT(*) AS n FROM runs WHERE lease_expires_at > ?").get(Math.floor(Date.now() / 1000))?.n);
  const hasQueue = lock.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='extraction_queue'").get() !== undefined;
  const queued = hasQueue ? Number(lock.prepare("SELECT COUNT(*) AS n FROM extraction_queue WHERE status IN ('queued','running')").get()?.n) : 0;
  if (active > 0 || queued > 0) throw new Error("Stop active extractions and queued work before exporting or backing up the library.");
  if (lock.prepare("SELECT name FROM sqlite_master WHERE name='extraction_processes'").get()) {
    for (const row of lock.prepare("SELECT * FROM extraction_processes").all()) {
      if (row.host !== hostname()) throw new Error("This library has extraction ownership from another computer or hostname. Export on the original computer, or restore a verified backup into a new profile. Waiting here cannot establish that the other process stopped.");
      if (processExists(-Number(row.process_group)) || (row.owner_released !== 1 && !ownerProcessIsGone(String(row.owner)))) throw new Error("An extraction subprocess is still running. Wait for it to exit before exporting or backing up the library.");
    }
  }
}
