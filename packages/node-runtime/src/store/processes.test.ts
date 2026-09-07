import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTrackedExec } from "../exec.js";
import { createFsArtifactStore } from "./artifacts.js";
import { openDatabase, openMemoryDatabase } from "./db.js";
import { createRunStore } from "./runs.js";
import { assertNoExtractionProcesses, createRunProcessJournal, processExists } from "./processes.js";

const owner = `${hostname()}:${process.pid}:abc`;
const manifest = { source_type: "file" as const, duration_s: 1, codec: "h264", has_audio: true, has_video: true,
  ext: ".mp4", title: "probe", source_path: "/tmp/probe", content_sha256: null };
async function until(test: () => boolean): Promise<void> {
  const start = Date.now();
  while (!test()) { if (Date.now() - start > 4000) throw new Error("Subprocess did not settle"); await new Promise((resolve) => setTimeout(resolve, 10)); }
}

describe.skipIf(process.platform === "win32")("extraction process ownership", () => {
  it("retains pre-ingest ownership between binaries and refuses late publication after release", async () => {
    const db = openMemoryDatabase(); const journal = createRunProcessJournal(db, "run_test", owner);
    const folder = mkdtempSync(join(tmpdir(), "lirovo-publish-test-"));
    const store = createFsArtifactStore(folder, journal.publish);
    try {
      await createTrackedExec({ onSpawn: journal.record })(process.execPath, ["-e", "process.stdout.write('ready')"]);
      expect(db.prepare("SELECT COUNT(*) AS n FROM runs").get()?.n).toBe(0);
      expect(() => assertNoExtractionProcesses(db, "run_test")).toThrow(/previous extraction/);
      await store.put("run_test", "value.txt", "original");
      journal.release();
      expect(() => assertNoExtractionProcesses(db, "run_test")).not.toThrow();
      db.close();
      await expect(store.put("run_test", "value.txt", "stale")).rejects.toThrow();
      expect(readFileSync(join(folder, "run_test", "value.txt"), "utf8")).toBe("original");
    } finally { rmSync(folder, { recursive: true, force: true }); }
  });

  it("refuses a live parent's expired lease and unknown hosts, but permits a proven dead parent", () => {
    const db = openMemoryDatabase(); const runs = createRunStore(db, owner);
    const source = runs.upsertSource(manifest, "/tmp/probe");
    runs.createRun("run_test", source, null, owner);
    db.exec("UPDATE runs SET lease_expires_at=0");
    expect(() => runs.claim("run_test", owner)).toThrow(/previous extraction process must exit/);
    db.prepare("UPDATE runs SET lease_owner=?").run("unknown-host:123");
    expect(() => runs.claim("run_test", owner)).toThrow(/previous extraction process must exit/);
    const dead = spawnSync(process.execPath, ["-e", ""]);
    expect(dead.status).toBe(0);
    db.prepare("UPDATE runs SET lease_owner=?").run(`${hostname()}:${dead.pid}:def`);
    expect(runs.claim("run_test", owner)).toBe(true);
    db.exec("UPDATE runs SET lease_expires_at=0");
    createRunProcessJournal(db, "run_test", owner).release();
    expect(runs.claim("run_test", owner)).toBe(true);
    db.close();
  });

  it("blocks resume while a journaled detached writer survives its killed parent", async () => {
    const folder = mkdtempSync(join(tmpdir(), "lirovo-orphan-test-"));
    const file = join(folder, "lirovo.db");
    const runtime = new URL("../../dist/index.js", import.meta.url).href;
    const target = `const fs=require('node:fs'); fs.writeFileSync(${JSON.stringify(join(folder, "ready"))},'ready');
      const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(join(folder, "release"))})){fs.writeFileSync(${JSON.stringify(join(folder, "artifact"))},'old writer');clearInterval(timer)}},10);setTimeout(()=>process.exit(),4000).unref();`;
    const source = `import {hostname} from 'node:os';
      import {openDatabase,createRunStore,createRunProcessJournal,createTrackedExec} from ${JSON.stringify(runtime)};
      const db=openDatabase(process.argv[1]); const owner=hostname()+':'+process.pid+':abc';
      const runs=createRunStore(db,owner);const source=runs.upsertSource(${JSON.stringify(manifest)},'/tmp/probe');
      runs.createRun('run_test',source,null,owner);const journal=createRunProcessJournal(db,'run_test',owner);
      await createTrackedExec({onSpawn:journal.record})(process.execPath,['-e',process.argv[2]]);`;
    const parent = spawn(process.execPath, ["--input-type=module", "-e", source, file, target], { stdio: "ignore" });
    let pgid = 0;
    try {
      await until(() => existsSync(join(folder, "ready")));
      const exited = once(parent, "exit"); parent.kill("SIGKILL"); await exited;
      const db = openDatabase(file); const runs = createRunStore(db, owner);
      try {
        pgid = Number(db.prepare("SELECT process_group FROM extraction_processes").get()?.process_group);
        expect(() => runs.claim("run_test", owner)).toThrow(/previous extraction/);
        writeFileSync(join(folder, "release"), "release");
        await until(() => !processExists(-pgid));
        expect(runs.claim("run_test", owner)).toBe(true);
        expect(readFileSync(join(folder, "artifact"), "utf8")).toBe("old writer");
      } finally { db.close(); }
    } finally {
      if (parent.exitCode === null && parent.signalCode === null) parent.kill("SIGKILL");
      if (pgid > 0 && processExists(-pgid)) { process.kill(-pgid, "SIGKILL"); await until(() => !processExists(-pgid)); }
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
