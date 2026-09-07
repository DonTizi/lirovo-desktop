import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, hostname } from "node:os";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { createLibraryBackup, restoreLibraryBackup } from "./library-backup.js";
import { createRunStore } from "./store/runs.js";
import { openDatabase, type Db } from "./store/db.js";
import { resolvePaths } from "./paths.js";

const fixtures: { directory: string; db: Db }[] = [];
afterEach(() => { for (const item of fixtures.splice(0)) { item.db.close(); rmSync(item.directory, { recursive: true, force: true }); } });
function fixture() {
  const directory = mkdtempSync(join(realpathSync(tmpdir()), "lirovo-backup-test-"));
  const paths = resolvePaths({ LIROVO_DATA_DIR: join(directory, "profile") });
  const db = openDatabase(paths.dbFile); fixtures.push({ directory, db });
  const runs = createRunStore(db);
  const source = runs.upsertSource({ source_type: "file", duration_s: 1, codec: "wav", has_audio: true, has_video: false,
    ext: ".wav", title: "Full français", source_path: "/external/original.wav", content_sha256: "abc" }, "/external/original.wav");
  runs.createRun("run_abc", source, null, "owner"); runs.finish("run_abc", "succeeded");
  mkdirSync(join(paths.runs, "run_abc"), { recursive: true });
  writeFileSync(join(paths.runs, "run_abc", "transcript.json"), '{"text":"Full text français"}');
  writeFileSync(join(paths.runs, "run_abc", "audio.flac"), Buffer.alloc(200_000, 42));
  db.prepare("INSERT INTO settings VALUES ('secret_token','not-exported',1)").run();
  db.prepare("INSERT INTO settings VALUES ('theme','dark',1)").run();
  return { directory, paths, db, runs, backup: join(directory, "backup"), restore: join(directory, "restore") };
}

describe("library backups", () => {
  it("refuses an unreleased parent between subprocesses and clears obsolete journal rows on restore", async () => {
    const f = fixture(); const child = spawnSync(process.execPath, ["-e", ""]);
    expect(child.status).toBe(0);
    f.db.prepare("INSERT INTO extraction_processes VALUES (?, ?, ?, ?, ?, 0)")
      .run("run_abc", `${hostname()}:${process.pid}:abc`, hostname(), child.pid, 1);
    await expect(createLibraryBackup(f.paths, f.backup)).rejects.toThrow("subprocess is still running");
    expect(existsSync(f.backup)).toBe(false);
    f.db.exec("UPDATE extraction_processes SET owner_released=1");
    await createLibraryBackup(f.paths, f.backup);
    await restoreLibraryBackup(f.backup, f.restore);
    const restored = new DatabaseSync(join(f.restore, "lirovo.db"));
    try { expect(restored.prepare("SELECT COUNT(*) AS n FROM extraction_processes").get()?.n).toBe(0); }
    finally { restored.close(); }
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM extraction_processes").get()?.n).toBe(1);
  });

  it("round-trips WAL data and full artifact bytes into a new profile, excluding credentials/models", async () => {
    const f = fixture();
    mkdirSync(f.paths.models); writeFileSync(join(f.paths.models, "model.bin"), "model");
    writeFileSync(join(f.paths.data, "credentials.json"), "secret");
    const backed = await createLibraryBackup(f.paths, f.backup);
    expect(backed.files).toBe(3); expect(backed.runCount).toBe(1);
    const restored = await restoreLibraryBackup(f.backup, f.restore);
    expect(restored.runCount).toBe(1);
    expect(readFileSync(join(f.restore, "runs/run_abc/audio.flac"))).toEqual(Buffer.alloc(200_000, 42));
    expect(readFileSync(join(f.restore, "runs/run_abc/transcript.json"), "utf8")).toBe('{"text":"Full text français"}');
    const check = new DatabaseSync(join(f.restore, "lirovo.db"), { readOnly: true });
    try {
      expect(check.prepare("SELECT title,uri FROM sources").get()).toEqual({ title: "Full français", uri: "/external/original.wav" });
      expect(check.prepare("SELECT key,value FROM settings").all()).toEqual([{ key: "theme", value: "dark" }]);
      expect(check.prepare("PRAGMA integrity_check").get()?.integrity_check).toBe("ok");
    } finally { check.close(); }
    expect(f.db.prepare("SELECT value FROM settings WHERE key='secret_token'").get()?.value).toBe("not-exported");
    expect(existsSync(join(f.backup, "models"))).toBe(false);
    expect(existsSync(join(f.backup, "credentials.json"))).toBe(false);
    expect(existsSync(join(f.restore, ".lirovo-incomplete"))).toBe(false);
  });

  it("refuses live leases, queued work, existing empty targets and nested targets", async () => {
    const f = fixture();
    f.db.prepare("UPDATE runs SET lease_expires_at=? WHERE id='run_abc'").run(Date.now() / 1000 + 60);
    await expect(createLibraryBackup(f.paths, f.backup)).rejects.toThrow("Stop active");
    expect(existsSync(f.backup)).toBe(false);
    f.db.prepare("UPDATE runs SET lease_expires_at=NULL WHERE id='run_abc'").run();
    f.db.prepare("INSERT INTO extraction_queue VALUES ('run_def','{}','queued',1,1,NULL)").run();
    await expect(createLibraryBackup(f.paths, f.backup)).rejects.toThrow("queued work");
    f.db.prepare("DELETE FROM extraction_queue").run();
    mkdirSync(f.backup);
    await expect(createLibraryBackup(f.paths, f.backup)).rejects.toThrow();
    expect(readdirSync(f.backup)).toEqual([]);
    await expect(createLibraryBackup(f.paths, join(f.paths.data, "nested"))).rejects.toThrow("outside");
  });

  it("rejects tampered, extra, missing and incomplete backup files before creating a restored profile", async () => {
    const f = fixture(); await createLibraryBackup(f.paths, f.backup);
    const transcript = join(f.backup, "runs/run_abc/transcript.json");
    const original = readFileSync(transcript);
    writeFileSync(transcript, "tampered");
    await expect(restoreLibraryBackup(f.backup, f.restore)).rejects.toThrow("Checksum");
    expect(existsSync(f.restore)).toBe(false);
    writeFileSync(transcript, original);
    writeFileSync(join(f.backup, "lirovo.db-wal"), "unexpected");
    await expect(restoreLibraryBackup(f.backup, f.restore)).rejects.toThrow("inventory");
    rmSync(join(f.backup, "lirovo.db-wal"));
    writeFileSync(join(f.backup, ".lirovo-incomplete"), "interrupted");
    await expect(restoreLibraryBackup(f.backup, f.restore)).rejects.toThrow("incomplete");
    rmSync(join(f.backup, ".lirovo-incomplete")); rmSync(transcript);
    await expect(restoreLibraryBackup(f.backup, f.restore)).rejects.toThrow("inventory");
  });

  it("rejects symlinks and traversal without copying or overwriting their targets", async () => {
    const f = fixture();
    const secret = join(f.directory, "secret"); writeFileSync(secret, "private");
    symlinkSync(secret, join(f.paths.runs, "run_abc", "linked"));
    await expect(createLibraryBackup(f.paths, f.backup)).rejects.toThrow("Symbolic links");
    expect(readFileSync(secret, "utf8")).toBe("private");
    expect(existsSync(join(f.backup, ".lirovo-incomplete"))).toBe(true);
    rmSync(join(f.paths.runs, "run_abc", "linked"));
    const clean = join(f.directory, "clean"); await createLibraryBackup(f.paths, clean);
    const manifestFile = join(clean, "lirovo-backup.json");
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    manifest.files[0].path = "../secret"; writeFileSync(manifestFile, JSON.stringify(manifest));
    await expect(restoreLibraryBackup(clean, f.restore)).rejects.toThrow("invalid");
    expect(existsSync(f.restore)).toBe(false);
  });

  it("validates future schema versions even if the file checksum was updated", async () => {
    const f = fixture(); await createLibraryBackup(f.paths, f.backup);
    const path = join(f.backup, "lirovo.db"); const future = new DatabaseSync(path); future.exec("PRAGMA user_version=999"); future.close();
    const manifestPath = join(f.backup, "lirovo-backup.json"); const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const file = manifest.files.find((entry: { path: string }) => entry.path === "lirovo.db");
    file.sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
    manifest.databaseVersion = 999; writeFileSync(manifestPath, JSON.stringify(manifest));
    await expect(restoreLibraryBackup(f.backup, f.restore)).rejects.toThrow("unsupported database version");
    expect(existsSync(f.restore)).toBe(false);
  });

  it("leaves failed restores explicitly incomplete and never changes the active profile", async () => {
    const f = fixture();
    const attempt = f.runs.beginAttempt("run_abc", "normalize", "hash");
    f.runs.completeAttempt("run_abc", "normalize", attempt, { status: "done", output: {} });
    f.db.prepare("UPDATE run_stage_attempts SET output_json='invalid json'").run();
    await createLibraryBackup(f.paths, f.backup);
    await expect(restoreLibraryBackup(f.backup, f.restore)).rejects.toThrow("incomplete restored profile");
    expect(existsSync(join(f.restore, ".lirovo-incomplete"))).toBe(true);
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM runs").get()?.n).toBe(1);
    await expect(restoreLibraryBackup(f.backup, f.restore)).rejects.toThrow();
  });
});
