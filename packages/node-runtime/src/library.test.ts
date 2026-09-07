import { mkdir, mkdtemp, readFile, readdir, writeFile, realpath, rm, stat, symlink, chmod } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LirovoPaths, SourceManifest } from "@lirovo/core";
import { openDatabase, openMemoryDatabase, type Db } from "./store/db.js";
import { createRunStore } from "./store/runs.js";
import { createSchemaStore } from "./store/schemas.js";
import { createSettingsStore } from "./store/settings.js";
import { directorySize, purgeEverything, purgeRuns, storageReport, withinDataDir } from "./library.js";

let paths: LirovoPaths;
let db: Db;

const manifest = (hash: string): SourceManifest => ({
  source_type: "file",
  duration_s: 10,
  codec: "h264",
  has_audio: true,
  has_video: true,
  ext: "mp4",
  title: "talk",
  source_path: "/tmp/talk.mp4",
  content_sha256: hash,
});

beforeEach(async () => {
  const data = await mkdtemp(path.join(await realpath(tmpdir()), "lirovo-library-"));
  paths = {
    data,
    runs: path.join(data, "runs"),
    models: path.join(data, "models"),
    bundledBin: null,
    dbFile: path.join(data, "lirovo.db"),
  };
  db = openMemoryDatabase();
});
afterEach(async () => { db.close(); await rm(paths.data, { recursive: true, force: true }); });

const seed = async (runs: number): Promise<void> => {
  const store = createRunStore(db);
  for (let i = 0; i < runs; i++) {
    const source = store.upsertSource(manifest(`hash-${i}`), `/tmp/${i}.mp4`);
    store.createRun(`run_${i}`, source, null, "host:1");
    store.finish(`run_${i}`, "succeeded");
    const dir = path.join(paths.runs, `run_${i}`, "frames");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "000000.jpg"), "x".repeat(1000));
  }
};

describe("directorySize", () => {
  it("is zero for a directory that does not exist", async () => {
    // Every one of them is missing on a first launch. A settings page that
    // throws because `models/` has not been created yet is worse than one
    // that says nothing is stored.
    expect(await directorySize(path.join(paths.data, "nope"))).toBe(0);
  });

  it("counts nested files", async () => {
    await mkdir(path.join(paths.data, "a", "b"), { recursive: true });
    await writeFile(path.join(paths.data, "a", "b", "f"), "12345");
    expect(await directorySize(paths.data)).toBe(5);
  });
});

describe("storageReport", () => {
  it("reports zeros and no runs on an untouched machine", async () => {
    const report = await storageReport(paths, db);
    expect(report).toMatchObject({ runCount: 0, runsBytes: 0, modelsBytes: 0, binBytes: 0, dbBytes: 0 });
  });

  it("separates the things a person decides between", async () => {
    await seed(2);
    await mkdir(paths.models, { recursive: true });
    await writeFile(path.join(paths.models, "ggml.bin"), "m".repeat(500));
    await mkdir(path.join(paths.data, "bin"), { recursive: true });
    await writeFile(path.join(paths.data, "bin", "yt-dlp"), "b".repeat(50));

    const report = await storageReport(paths, db);
    expect(report.runCount).toBe(2);
    expect(report.runsBytes).toBe(2000);
    expect(report.modelsBytes).toBe(500);
    expect(report.binBytes).toBe(50);
  });
});

describe("purgeRuns", () => {
  it("removes the artifacts and the rows together", async () => {
    await seed(3);
    const { freedBytes } = await purgeRuns(paths, db);
    expect(freedBytes).toBe(3000);
    expect(await readdir(paths.runs)).toEqual([]);
    // A run row whose artifacts are gone opens onto a broken page.
    expect((await storageReport(paths, db)).runCount).toBe(0);
  });

  it("leaves the runs directory in place, ready to be written to again", async () => {
    await seed(1);
    await purgeRuns(paths, db);
    await expect(readdir(paths.runs)).resolves.toEqual([]);
  });

  it("keeps schemas, settings and the speech model", async () => {
    await seed(1);
    const schemas = createSchemaStore(db);
    schemas.save({ name: "Talks", fields: [{ name: "title", kind: "text" }] });
    createSettingsStore(db).set("default_backend", "claude");
    await mkdir(paths.models, { recursive: true });
    await writeFile(path.join(paths.models, "ggml.bin"), "model");

    await purgeRuns(paths, db);

    expect(schemas.list()).toHaveLength(1);
    expect(createSettingsStore(db).get("default_backend")).toBe("claude");
    expect(await directorySize(paths.models)).toBe(5);
  });

  it("is safe to run twice, and on a machine with nothing", async () => {
    await expect(purgeRuns(paths, db)).resolves.toEqual({ freedBytes: 0 });
    await expect(purgeRuns(paths, db)).resolves.toEqual({ freedBytes: 0 });
  });
});

describe("purgeEverything", () => {
  it("empties everything it owns and leaves the trees in place", async () => {
    await seed(2);
    await mkdir(paths.models, { recursive: true });
    await writeFile(path.join(paths.models, "ggml.bin"), "m".repeat(100));

    const { freedBytes } = await purgeEverything(paths, db);
    expect(freedBytes).toBe(2100);
    // Empty, not missing: the next write needs somewhere to go, and a missing
    // parent fails in a way that reads as a bug rather than as a clean slate.
    await expect(readdir(paths.runs)).resolves.toEqual([]);
    await expect(readdir(paths.models)).resolves.toEqual([]);
  });

  it("is safe on a machine that has nothing", async () => {
    await expect(purgeEverything(paths, db)).resolves.toEqual({ freedBytes: 0 });
  });

  it("removes only what this app created, never a stranger's file in the same folder", async () => {
    // `LIROVO_DATA_DIR` is an env var. A recursive delete of whatever it points
    // at turns `LIROVO_DATA_DIR=$HOME` plus one confirmation into an erased
    // home directory, so the delete names its children instead.
    await mkdir(path.join(paths.data, "Documents"), { recursive: true });
    await writeFile(path.join(paths.data, "Documents", "thesis.pdf"), "years of work");
    await writeFile(path.join(paths.data, ".zshrc"), "not ours");
    await mkdir(paths.runs, { recursive: true });
    await writeFile(path.join(paths.runs, "run_1"), "ours");

    const result = await purgeEverything(paths, db);
    expect(result.freedBytes).toBe(4);

    await expect(readFile(path.join(paths.data, "Documents", "thesis.pdf"), "utf8")).resolves.toBe("years of work");
    await expect(readFile(path.join(paths.data, ".zshrc"), "utf8")).resolves.toBe("not ours");
    expect(await readdir(paths.runs)).toEqual([]);
  });

  it("keeps the DB inode locked through deletion so a waiting external writer survives reset", { timeout: 15_000 }, async () => {
    db.close(); db = openDatabase(paths.dbFile);
    await mkdir(path.join(paths.runs, "run_abc"), { recursive: true });
    await writeFile(path.join(paths.runs, "run_abc", "frame"), "1234");
    db.prepare("INSERT INTO settings VALUES ('theme','dark',1)").run();
    const inode = (await stat(paths.dbFile)).ino;
    const start = path.join(paths.data, "start"), blocked = path.join(paths.data, "blocked");
    const source = `const {DatabaseSync}=require('node:sqlite'),fs=require('node:fs');
      const db=new DatabaseSync(process.argv[1]);db.exec('PRAGMA busy_timeout=0');process.stdout.write('ready');
      const pause=new Int32Array(new SharedArrayBuffer(4)),deadline=Date.now()+10000;
      while(!fs.existsSync(process.argv[2])){if(Date.now()>deadline)throw Error('start handshake timed out');Atomics.wait(pause,0,0,5);}
      try{db.prepare("INSERT INTO settings VALUES ('new_writer','safe',2)").run();throw Error('write was not blocked');}
      catch(error){if(error.errcode!==5)throw error;fs.writeFileSync(process.argv[3],String(error.errcode));}
      db.exec('PRAGMA busy_timeout=5000');
      db.prepare("INSERT INTO settings VALUES ('new_writer','safe',2)").run();db.close();`;
    const child = spawn(process.execPath, ["-e", source, paths.dbFile, start, blocked], { stdio: ["ignore", "pipe", "pipe"] });
    const exited = once(child, "exit");
    let childErrors = "";
    child.stderr.on("data", (chunk) => { childErrors += String(chunk); });
    // Attach an error handler immediately, including for a failed spawn.
    void exited.catch(() => {});
    try {
      await once(child.stdout, "data", { signal: AbortSignal.timeout(3_000) });
      let sawBlockedWriter = false;
      let commitProbed = false;
      const locked: Db = { ...db, exec(sql) {
        if (sql === "COMMIT" && !commitProbed) {
          commitProbed = true;
          // The filesystem work is finished, but the real SQLite transaction
          // must still exclude the other connection. Wait for proof of BUSY,
          // not for an arbitrary number of slow filesystem operations.
          const pause = new Int32Array(new SharedArrayBuffer(4));
          const deadline = Date.now() + 3_000;
          while (!existsSync(blocked)) {
            if (Date.now() > deadline) throw new Error("writer did not report SQLITE_BUSY before commit");
            Atomics.wait(pause, 0, 0, 5);
          }
          sawBlockedWriter = readFileSync(blocked, "utf8") === "5";
          expect(existsSync(path.join(paths.runs, "run_abc"))).toBe(false);
        }
        db.exec(sql);
        if (sql === "BEGIN IMMEDIATE") writeFileSync(start, "go");
      } };
      expect(await purgeEverything(paths, locked)).toEqual({ freedBytes: 4 });
      expect(await exited, childErrors).toEqual([0, null]);
      expect(sawBlockedWriter).toBe(true);
      expect((await stat(paths.dbFile)).ino).toBe(inode);
      expect(db.prepare("SELECT key,value FROM settings").all()).toEqual([{ key: "new_writer", value: "safe" }]);
      expect(db.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
    } finally { if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await exited; } }
  });

  it("refuses active work and symbolic links before deleting any content", async () => {
    await seed(1);
    db.exec("UPDATE runs SET lease_owner='unknown:1', lease_expires_at=0");
    await expect(purgeRuns(paths, db)).rejects.toThrow("Stop active");
    expect(await directorySize(paths.runs)).toBe(1000);
    db.exec("UPDATE runs SET lease_owner=NULL");
    db.prepare("INSERT INTO extraction_queue VALUES ('pending','{}','queued',1,1,NULL)").run();
    await expect(purgeRuns(paths, db)).rejects.toThrow("queued work");
    db.exec("DELETE FROM extraction_queue");
    await symlink(paths.data, path.join(paths.runs, "outside"));
    await expect(purgeRuns(paths, db)).rejects.toThrow("symbolic link");
    expect(db.prepare("SELECT COUNT(*) AS n FROM runs").get()?.n).toBe(1);
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("reports a real partial filesystem failure without resurrecting deleted library entries", async () => {
    await seed(1);
    await chmod(paths.data, 0o555);
    try {
      await expect(purgeRuns(paths, db)).rejects.toThrow("only partially completed");
      expect(db.prepare("SELECT COUNT(*) AS n FROM runs").get()?.n).toBe(0);
      expect(db.prepare("SELECT COUNT(*) AS n FROM sources").get()?.n).toBe(0);
    } finally { await chmod(paths.data, 0o700); }
    await expect(purgeRuns(paths, db)).resolves.toMatchObject({ freedBytes: expect.any(Number) });
  });
});

describe("withinDataDir", () => {
  it("accepts the directory itself and anything under it", () => {
    expect(withinDataDir("/Users/x/Lirovo", "/Users/x/Lirovo")).toBe(true);
    expect(withinDataDir("/Users/x/Lirovo/runs/run_1/frames/0.jpg", "/Users/x/Lirovo")).toBe(true);
  });

  it("refuses anything outside, including the traversal that looks inside", () => {
    expect(withinDataDir("/etc/passwd", "/Users/x/Lirovo")).toBe(false);
    expect(withinDataDir("/Users/x/Lirovo/../.ssh/id_rsa", "/Users/x/Lirovo")).toBe(false);
    expect(withinDataDir("/Users/x/Lirovo-other/secret", "/Users/x/Lirovo")).toBe(false);
  });

  it("refuses a sibling whose name merely starts the same way", () => {
    // The prefix check has to include the separator or `Lirovo-backup` passes.
    expect(withinDataDir("/Users/x/Lirovoo/f", "/Users/x/Lirovo")).toBe(false);
  });
});
