import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createRunStore, openDatabase, openMemoryDatabase } from "@lirovo/node-runtime";
import { createExtractionQueue, createQueueWorker } from "./extraction-queue";

const request = { source: "/tmp/video.mp4", schemaJson: null, backendId: null, language: "fr", allowRemoteAsr: false };
describe("durable extraction queue", () => {
  it("persists full pre-ingest requests and holds them after an independent process exits", () => {
    const folder = mkdtempSync(join(tmpdir(), "lirovo-queue-test-"));
    const file = join(folder, "scratch.db");
    const initial = openDatabase(file);
    initial.close();
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { DatabaseSync } from 'node:sqlite';
      const db = new DatabaseSync(process.argv[1]);
      db.prepare("INSERT INTO extraction_queue VALUES (?, ?, 'running', 1, 1, NULL)").run('run_child', process.argv[2]);
      db.close();
    `, file, JSON.stringify(request)], { encoding: "utf8" });
    expect(child.status, child.stderr).toBe(0);
    const reopened = openDatabase(file);
    try {
      const queue = createExtractionQueue(reopened);
      queue.recover();
      expect(queue.list()[0]?.status).toBe("interrupted");
      expect(queue.claimNext()).toBeUndefined();
      expect(JSON.parse(queue.get("run_child")!.requestJson)).toEqual(request);
      queue.resume("run_child");
      expect(queue.claimNext()?.runId).toBe("run_child");
      expect(reopened.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
    } finally { reopened.close(); rmSync(folder, { recursive: true, force: true }); }
  });

  it("runs sequentially, enqueues during active work and cancels waiting without executing it", async () => {
    const db = openMemoryDatabase();
    const queue = createExtractionQueue(db);
    queue.enqueue("one", request);
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const calls: string[] = [];
    const worker = createQueueWorker(queue, async (runId) => { calls.push(runId); if (runId === "one") await barrier; });
    const pumping = worker.wake();
    queue.enqueue("two", request);
    queue.enqueue("three", request);
    expect(worker.wake()).toBe(pumping);
    expect(worker.cancel("two")).toBe(true);
    expect(calls).toEqual(["one"]);
    release();
    await pumping;
    expect(calls).toEqual(["one", "three"]);
    expect(queue.list().map((item) => item.status)).toEqual(["succeeded", "cancelled", "succeeded"]);
    db.close();
  });

  it("routes cancellation to the exact active job and continues pending work", async () => {
    const db = openMemoryDatabase();
    const queue = createExtractionQueue(db);
    queue.enqueue("one", request); queue.enqueue("two", request);
    const worker = createQueueWorker(queue, async (runId, _request, signal) => {
      if (runId === "one") await new Promise<void>((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }));
    });
    const pumping = worker.wake();
    expect(worker.cancel("missing")).toBe(false);
    expect(worker.busy()).toBe(true);
    expect(worker.cancel("one")).toBe(true);
    await pumping;
    expect(queue.get("one")?.status).toBe("cancelled");
    expect(queue.get("two")?.status).toBe("succeeded");
    expect(() => queue.resume("two")).toThrow();
    expect(() => queue.resume("missing")).toThrow();
    db.close();
  });

  it("holds unstarted work on restart and retries only explicitly selected failures", async () => {
    const db = openMemoryDatabase(); const queue = createExtractionQueue(db);
    queue.enqueue("one", request); queue.enqueue("two", request); queue.recover();
    const calls: string[] = [];
    const worker = createQueueWorker(queue, async (runId) => { calls.push(runId); throw new Error("Selected backend unavailable"); });
    await worker.wake(); expect(calls).toEqual([]);
    queue.resume("two"); await worker.wake();
    expect(calls).toEqual(["two"]);
    expect(queue.get("one")?.status).toBe("interrupted");
    expect(queue.get("two")?.error).toContain("Selected backend unavailable");
    db.close();
  });

  it("surfaces queue write failure without an unhandled discarded promise or starting more jobs", async () => {
    const db = openMemoryDatabase(); const queue = createExtractionQueue(db);
    queue.enqueue("one", request);
    const worker = createQueueWorker(queue, async () => { db.exec("DROP TABLE extraction_queue"); });
    await expect(worker.wake()).resolves.toBeUndefined();
    expect(worker.failure()).toContain("Restart Lirovo");
    expect(worker.busy()).toBe(false);
    await expect(worker.wake()).resolves.toBeUndefined();
    db.close();
  });

  it("never reclassifies completed work when its success acknowledgement cannot be saved", async () => {
    const db = openMemoryDatabase(); const queue = createExtractionQueue(db);
    queue.enqueue("one", request); queue.enqueue("two", request);
    db.exec("CREATE TRIGGER fail_success BEFORE UPDATE ON extraction_queue WHEN NEW.status = 'succeeded' BEGIN SELECT RAISE(ABORT, 'ack write failed'); END");
    const calls: string[] = [];
    const worker = createQueueWorker(queue, async (id) => { calls.push(id); });
    await worker.wake();
    expect(calls).toEqual(["one"]);
    expect(queue.get("one")?.status).toBe("running");
    expect(queue.get("two")?.status).toBe("queued");
    expect(worker.failure()).toContain("ack write failed");
    // A transient failure ending does not silently start more model work.
    db.exec("DROP TRIGGER fail_success");
    await worker.wake();
    expect(calls).toEqual(["one"]);
    queue.recover();
    expect(queue.get("one")?.status).toBe("interrupted");
    db.close();
  });

  it("releases a dead local process lease immediately and cancellation finishes its run row", () => {
    const db = openMemoryDatabase(); const queue = createExtractionQueue(db); const runs = createRunStore(db);
    const source = runs.upsertSource({ source_type: "file", duration_s: 1, codec: "a", has_audio: true,
      has_video: false, ext: ".wav", title: "probe", source_path: "/tmp/probe.wav", content_sha256: "abc" }, "/tmp/probe.wav");
    const child = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
    expect(child.status).toBe(0);
    runs.createRun("dead", source, null, `${hostname()}:${child.stdout}`);
    queue.enqueue("dead", request); queue.claimNext(); queue.recover();
    expect(db.prepare("SELECT lease_expires_at FROM runs WHERE id='dead'").get()?.lease_expires_at).toBe(0);
    expect(queue.cancelWaiting("dead")).toBe(true);
    expect(db.prepare("SELECT status FROM runs WHERE id='dead'").get()?.status).toBe("cancelled");
    runs.createRun("alive", source, null, `${hostname()}:${process.pid}`);
    queue.enqueue("alive", request); queue.claimNext(); queue.recover();
    expect(queue.cancelWaiting("alive")).toBe(false);
    expect(db.prepare("SELECT status FROM runs WHERE id='alive'").get()?.status).toBe("running");
    db.close();
  });
});
