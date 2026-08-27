import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceManifest } from "@lirovo/core";
import { openMemoryDatabase, type Db } from "./db.js";
import { LEASE_MS, createRunStore, holdLease, observedStatus, type RunStore } from "./runs.js";

const manifest: SourceManifest = {
  source_type: "file",
  duration_s: 10,
  codec: "h264",
  has_audio: true,
  has_video: true,
  ext: "mp4",
  title: "talk",
  source_path: "/tmp/talk.mp4",
  content_sha256: "abc",
};

let db: Db;
let runs: RunStore;
beforeEach(() => {
  db = openMemoryDatabase();
  runs = createRunStore(db);
});

const lease = (runId: string): number | null =>
  (db.prepare("SELECT lease_expires_at AS at FROM runs WHERE id = ?").get(runId) as { at: number | null }).at;

describe("holdLease", () => {
  it("keeps a long run from reading as stopped", () => {
    // The bug: nothing renewed the lease, so any extraction past sixty seconds
    // showed as `stopped` in the library while it was still running — and was
    // claimable by another process writing to the same artifacts.
    vi.useFakeTimers();
    const source = runs.upsertSource(manifest, "/tmp/talk.mp4");
    runs.createRun("run_long", source, null, "host:1");

    const stop = holdLease(runs, "run_long", "host:1");
    // Six minutes, which is what a twelve-minute video actually costs.
    for (let i = 0; i < 6; i++) vi.advanceTimersByTime(60_000);

    const at = lease("run_long") as number;
    expect(observedStatus("running", at, Date.now())).toBe("running");
    stop();
    vi.useRealTimers();
  });

  it("renews often enough to survive two missed beats", () => {
    // A sleeping machine or a busy event loop drops timers. The interval is a
    // third of the lease so losing two of them is still not a lost run.
    vi.useFakeTimers();
    const source = runs.upsertSource(manifest, "/tmp/a.mp4");
    runs.createRun("run_gap", source, null, "host:1");
    const spy = vi.spyOn(runs, "renewLease");

    const stop = holdLease(runs, "run_gap", "host:1");
    vi.advanceTimersByTime(LEASE_MS);
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(3);
    stop();
    vi.useRealTimers();
  });

  it("stops renewing once the run is over", () => {
    vi.useFakeTimers();
    const source = runs.upsertSource(manifest, "/tmp/b.mp4");
    runs.createRun("run_done", source, null, "host:1");
    const spy = vi.spyOn(runs, "renewLease");

    holdLease(runs, "run_done", "host:1")();
    vi.advanceTimersByTime(LEASE_MS * 3);
    // A heartbeat that outlives its run keeps a finished run looking alive.
    expect(spy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("says so when the lease has been taken by somebody else", () => {
    vi.useFakeTimers();
    const source = runs.upsertSource(manifest, "/tmp/c.mp4");
    runs.createRun("run_lost", source, null, "host:1");
    const lost = vi.fn();

    const stop = holdLease(runs, "run_lost", "someone-else:9", lost);
    vi.advanceTimersByTime(LEASE_MS);
    expect(lost).toHaveBeenCalled();
    stop();
    vi.useRealTimers();
  });
});
