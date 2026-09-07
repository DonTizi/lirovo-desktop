import { lstat, open, readFile } from "node:fs/promises";
import { DatabaseSync, backup } from "node:sqlite";
import { isAbsolute, join, normalize, resolve } from "node:path";
import type { LirovoPaths } from "@lirovo/core";
import { ARTIFACT_PATHS } from "@lirovo/contracts";
import { INCOMPLETE, assertLibraryIdle, exists, noSymlinks, reserveDirectory, inventory, hashFile, copyVerified, verifyFiles, publish, type VerifiedFile as BackupFile } from "./verified-transfer.js";
import { MIGRATIONS } from "./store/migrations.js";

const MANIFEST = "lirovo-backup.json";
const RUN_ID = /^run_[0-9a-hjkmnp-tv-z]+$/;
const PREFERENCES = ["theme", "onboarded", "default_backend", "whisper_model", "update_channel"];
interface BackupManifest {
  format: "lirovo-library-backup";
  version: 1;
  databaseVersion: number;
  createdAt: string;
  runCount: number;
  originalMediaIncluded: false;
  files: BackupFile[];
  warnings: string[];
}
export interface LibraryTransferResult {
  directory: string;
  files: number;
  bytes: number;
  runCount: number;
  warnings: string[];
}

function inspectDatabase(path: string): { version: number; runCount: number } {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    db.exec("PRAGMA trusted_schema=OFF");
    const version = Number(db.prepare("PRAGMA user_version").get()?.user_version);
    if (!Number.isInteger(version) || version < 1 || version > MIGRATIONS.length)
      throw new Error("This backup uses an unsupported database version. Update Lirovo before restoring it.");
    if (db.prepare("PRAGMA integrity_check").all().some((row) => row.integrity_check !== "ok") || db.prepare("PRAGMA foreign_key_check").all().length !== 0)
      throw new Error("The backup database failed its integrity checks.");
    const runCount = Number(db.prepare("SELECT COUNT(*) AS n FROM runs").get()?.n);
    db.prepare("SELECT id, uri FROM sources LIMIT 0").all();
    return { version, runCount };
  } finally { db.close(); }
}

function safeEntry(path: unknown): path is string {
  if (typeof path !== "string" || path.includes("\\") || isAbsolute(path) || normalize(path) !== path || path.split("/").some((part) => part === ".." || part === "." || part === "")) return false;
  if (path === "lirovo.db") return true;
  const parts = path.split("/");
  return parts.length >= 3 && parts[0] === "runs" && RUN_ID.test(parts[1]!);
}

async function readManifest(directory: string): Promise<BackupManifest> {
  await noSymlinks(directory);
  if (await exists(join(directory, INCOMPLETE))) throw new Error("This transfer is incomplete and cannot be restored.");
  await noSymlinks(join(directory, MANIFEST));
  if ((await lstat(join(directory, MANIFEST))).size > 32 * 1024 * 1024) throw new Error("The backup manifest is too large to validate safely.");
  const value = JSON.parse(await readFile(join(directory, MANIFEST), "utf8")) as Partial<BackupManifest>;
  if (value.format !== "lirovo-library-backup" || value.version !== 1 || !Array.isArray(value.files) ||
    !Number.isInteger(value.databaseVersion) || !Number.isInteger(value.runCount) || !Array.isArray(value.warnings) ||
    value.warnings.some((warning) => typeof warning !== "string") || value.originalMediaIncluded !== false)
    throw new Error("This is not a supported Lirovo library backup.");
  const seen = new Set<string>();
  for (const file of value.files) {
    if (!file || !safeEntry(file.path) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256) || seen.has(file.path))
      throw new Error("The backup has an invalid or duplicate file entry.");
    seen.add(file.path);
  }
  if (!seen.has("lirovo.db")) throw new Error("The backup has no library database.");
  return value as BackupManifest;
}

export async function createLibraryBackup(paths: LirovoPaths, destination: string): Promise<LibraryTransferResult> {
  await noSymlinks(paths.data); await noSymlinks(paths.dbFile);
  if (resolve(paths.dbFile) !== join(resolve(paths.data), "lirovo.db") || resolve(paths.runs) !== join(resolve(paths.data), "runs"))
    throw new Error("The library paths are not a supported profile layout.");
  const lock = new DatabaseSync(paths.dbFile);
  let reader: DatabaseSync | null = null;
  let target: string | null = null;
  try {
    lock.exec("PRAGMA busy_timeout=1000; BEGIN IMMEDIATE");
    assertLibraryIdle(lock);
    const hasQueue = lock.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='extraction_queue'").get() !== undefined;
    const inspected = inspectDatabase(paths.dbFile);
    target = await reserveDirectory(destination, [paths.data]);
    reader = new DatabaseSync(paths.dbFile, { readOnly: true });
    await backup(reader, join(target, "lirovo.db"));
    reader.close(); reader = null;
    const snapshot = new DatabaseSync(join(target, "lirovo.db"));
    try {
      snapshot.exec("PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON;");
      if (inspected.version >= 2) snapshot.prepare(`DELETE FROM settings WHERE key NOT IN (${PREFERENCES.map(() => "?").join(",")})`).run(...PREFERENCES);
      snapshot.exec("VACUUM");
    } finally { snapshot.close(); }
    const ids = lock.prepare(hasQueue ? "SELECT id FROM runs UNION SELECT run_id AS id FROM extraction_queue" : "SELECT id FROM runs").all().map((row) => String(row.id));
    const warnings = ["External original media, models, tools and credential files are not included. Source content and prompts may contain sensitive information.",
      "Restoring creates a separate profile; it never replaces or activates the current library."];
    const files: BackupFile[] = [{ path: "lirovo.db", ...await hashFile(join(target, "lirovo.db")) }];
    for (const id of ids) {
      if (!RUN_ID.test(id)) throw new Error("A stored extraction ID is not a safe directory name.");
      const source = join(paths.runs, id);
      if (!(await exists(source))) { warnings.push(`No artifact directory was available for ${id}.`); continue; }
      const before = await inventory(source);
      for (const entry of before) {
        const path = `runs/${id}/${entry}`;
        const copied = await copyVerified(join(source, entry), join(target, path));
        const reread = await hashFile(join(source, entry));
        if (JSON.stringify(copied) !== JSON.stringify(reread)) throw new Error(`The source changed while copying ${path}.`);
        files.push({ path, ...copied });
      }
      if (JSON.stringify(before) !== JSON.stringify(await inventory(source))) throw new Error("The source artifact inventory changed during backup.");
    }
    const manifest: BackupManifest = { format: "lirovo-library-backup", version: 1, databaseVersion: inspected.version,
      createdAt: new Date().toISOString(), runCount: inspected.runCount, originalMediaIncluded: false, files, warnings };
    await verifyFiles(target, files, [INCOMPLETE]);
    const verified = inspectDatabase(join(target, "lirovo.db"));
    if (verified.version !== inspected.version || verified.runCount !== inspected.runCount) throw new Error("The database snapshot did not match its source.");
    const file = await open(join(target, MANIFEST), "wx", 0o600);
    try { await file.writeFile(JSON.stringify(manifest, null, 2)); await file.sync(); } finally { await file.close(); }
    await publish(target);
    return { directory: target, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), runCount: inspected.runCount, warnings };
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}${target ? ` An incomplete transfer was retained at ${target}; the active library was not replaced.` : ""}`);
  } finally { reader?.close(); try { lock.exec("ROLLBACK"); } catch { /* BEGIN may have failed. */ } lock.close(); }
}

export async function restoreLibraryBackup(backupDirectory: string, destination: string): Promise<LibraryTransferResult> {
  const manifest = await readManifest(backupDirectory);
  await verifyFiles(backupDirectory, manifest.files, [MANIFEST]);
  const checked = inspectDatabase(join(backupDirectory, "lirovo.db"));
  if (checked.version !== manifest.databaseVersion || checked.runCount !== manifest.runCount) throw new Error("The backup database does not match its manifest.");
  const target = await reserveDirectory(destination, [backupDirectory]);
  try {
    for (const file of manifest.files) {
      const copied = await copyVerified(join(backupDirectory, file.path), join(target, file.path));
      if (copied.sha256 !== file.sha256 || copied.bytes !== file.bytes) throw new Error(`The backup changed while restoring ${file.path}.`);
    }
    await verifyFiles(target, manifest.files, [INCOMPLETE]);
    const restored = inspectDatabase(join(target, "lirovo.db"));
    if (restored.version !== manifest.databaseVersion || restored.runCount !== manifest.runCount) throw new Error("The restored database failed validation.");
    // Only internal normalized paths are relocated. External source URIs stay
    // exactly as recorded; resuming may require the original file or URL.
    const db = new DatabaseSync(join(target, "lirovo.db"));
    try {
      db.exec("BEGIN IMMEDIATE");
      const rows = db.prepare("SELECT run_id, attempt, output_json FROM run_stage_attempts WHERE stage='normalize' AND status='done'").all();
      for (const row of rows) {
        if (!RUN_ID.test(String(row.run_id))) throw new Error("A restored run ID is invalid.");
        const output = JSON.parse(String(row.output_json)) as Record<string, unknown>;
        if (typeof output.audio_path === "string") output.audio_path = join(target, "runs", String(row.run_id), ARTIFACT_PATHS.audio);
        if (typeof output.video_path === "string") output.video_path = join(target, "runs", String(row.run_id), ARTIFACT_PATHS.video);
        db.prepare("UPDATE run_stage_attempts SET output_json=? WHERE run_id=? AND stage='normalize' AND attempt=?")
          .run(JSON.stringify(output), row.run_id!, row.attempt!);
      }
      if (restored.version >= 4) db.exec("UPDATE extraction_queue SET status='interrupted', error='Restored profile. Resume explicitly after checking its source and backend.' WHERE status IN ('running','queued')");
      if (restored.version >= 6) db.exec("DELETE FROM extraction_processes");
      db.exec("UPDATE runs SET lease_owner=NULL, lease_expires_at=NULL WHERE lease_owner IS NOT NULL");
      db.exec("COMMIT");
    } finally { db.close(); }
    inspectDatabase(join(target, "lirovo.db"));
    await publish(target);
    return { directory: target, files: manifest.files.length, bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0), runCount: manifest.runCount,
      warnings: [...manifest.warnings, `Not activated. Relaunch Lirovo with LIROVO_DATA_DIR set to this directory: ${target}`, "Original source paths are unchanged. Models and tools must be installed separately before resuming."] };
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)} An incomplete restored profile was retained at ${target}; the active library was not replaced.`);
  }
}
