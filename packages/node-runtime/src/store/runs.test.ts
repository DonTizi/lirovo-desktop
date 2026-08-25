import { describe, expect, it, beforeEach } from "vitest";
import type { SourceManifest } from "@lirovo/contracts";
import { openMemoryDatabase, type Db } from "./db.js";
import { createRunStore, type RunStore } from "./runs.js";

const manifest = (sha: string | null, title = "talk"): SourceManifest => ({
  source_type: "file",
  duration_s: 100,
  codec: "h264",
  has_audio: true,
  has_video: true,
  ext: ".mp4",
  title,
  source_path: "/tmp/talk.mp4",
  content_sha256: sha,
});

describe("run store", () => {
  let db: Db;
  let store: RunStore;
  beforeEach(() => {
    db = openMemoryDatabase();
    store = createRunStore(db);
  });

  it("applies the schema and records its version", () => {
    expect(db.pragma("user_version", { simple: true })).toBe(1);
  });

  describe("source identity", () => {
    it("treats the same bytes as one source, whatever the file was called", () => {
      const a = store.upsertSource(manifest("abc", "talk.mp4"), "/tmp/talk.mp4");
      const b = store.upsertSource(manifest("abc", "copy of talk.mp4"), "/tmp/copy.mp4");
      expect(b).toBe(a);
    });

    it("keeps unhashable sources apart rather than merging them", () => {
      const a = store.upsertSource(manifest(null), "https://a.example/v");
      const b = store.upsertSource(manifest(null), "https://b.example/v");
      expect(b).not.toBe(a);
    });
  });

  describe("leases", () => {
    it("lets the holder renew and refuses a stranger", () => {
      const source = store.upsertSource(manifest("abc"), "/tmp/talk.mp4");
      const run = store.createRun("run_testa", source, null, "process-a");
      expect(store.renewLease(run.id, "process-a")).toBe(true);
      expect(store.renewLease(run.id, "process-b")).toBe(false);
    });

    it("refuses a second process while the lease is live", () => {
      // The desktop app and the CLI both open the same database. Without this,
      // both would run the same pipeline into the same artifact directory.
      const source = store.upsertSource(manifest("abc"), "/tmp/talk.mp4");
      const run = store.createRun("run_testa", source, null, "process-a");
      expect(store.claim(run.id, "process-b")).toBe(false);
      expect(store.claim(run.id, "process-a")).toBe(true);
    });

    it("hands the run over once the lease has expired", () => {
      const source = store.upsertSource(manifest("abc"), "/tmp/talk.mp4");
      const run = store.createRun("run_testa", source, null, "process-a");
      // Simulate process-a dying: its lease ages out and nobody renews it.
      db.prepare("UPDATE runs SET lease_expires_at = ? WHERE id = ?").run(1, run.id);
      expect(store.claim(run.id, "process-b")).toBe(true);
    });

    it("clears the lease when the run finishes", () => {
      const source = store.upsertSource(manifest("abc"), "/tmp/talk.mp4");
      const run = store.createRun("run_testa", source, null, "process-a");
      store.finish(run.id, "succeeded");
      expect(store.getRun(run.id)?.leaseOwner ?? store.getRun(run.id)?.lease_owner).toBeNull();
    });
  });

  describe("stage attempts", () => {
    it("numbers attempts and keeps the failed one", () => {
      const source = store.upsertSource(manifest("abc"), "/tmp/talk.mp4");
      const run = store.createRun("run_test1", source, null, "p");
      const first = store.beginAttempt(run.id, "asr", "h1");
      store.completeAttempt(run.id, "asr", first, { status: "failed", code: "TRANSCRIBE_FAILED", message: "boom" });
      const second = store.beginAttempt(run.id, "asr", "h1");
      expect(second).toBe(2);

      const rows = db
        .prepare("SELECT attempt, status, error_code FROM run_stage_attempts WHERE run_id = ? ORDER BY attempt")
        .all(run.id) as { attempt: number; status: string; error_code: string | null }[];
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ attempt: 1, status: "failed", error_code: "TRANSCRIBE_FAILED" });
    });

    it("returns a cached output only when the input hash matches", () => {
      const source = store.upsertSource(manifest("abc"), "/tmp/talk.mp4");
      const run = store.createRun("run_test1", source, null, "p");
      const attempt = store.beginAttempt(run.id, "normalize", "h1");
      store.completeAttempt(run.id, "normalize", attempt, { status: "done", output: { audio_path: "/a.flac" } });

      expect(store.cachedStageOutput(run.id, "normalize", "h1")).toEqual({ audio_path: "/a.flac" });
      // The source changed, so the previous output describes a different file.
      expect(store.cachedStageOutput(run.id, "normalize", "h2")).toBeNull();
    });

    it("does not resume from a failed attempt", () => {
      const source = store.upsertSource(manifest("abc"), "/tmp/talk.mp4");
      const run = store.createRun("run_test1", source, null, "p");
      const attempt = store.beginAttempt(run.id, "dedup", "h1");
      store.completeAttempt(run.id, "dedup", attempt, { status: "failed", code: "DEDUP_FAILED", message: "x" });
      expect(store.cachedStageOutput(run.id, "dedup", "h1")).toBeNull();
    });
  });

  describe("artifacts", () => {
    it("is idempotent on re-record, so a resumed stage does not duplicate rows", () => {
      const source = store.upsertSource(manifest("abc"), "/tmp/talk.mp4");
      const run = store.createRun("run_test1", source, null, "p");
      store.recordArtifact(run.id, "audio", "normalized/audio.flac", "sha1", 10, "audio/flac");
      store.recordArtifact(run.id, "audio", "normalized/audio.flac", "sha2", 20, "audio/flac");
      const rows = db.prepare("SELECT sha256, bytes FROM artifacts WHERE run_id = ?").all(run.id);
      expect(rows).toEqual([{ sha256: "sha2", bytes: 20 }]);
    });
  });

  describe("review state", () => {
    it("is a view over append-only events, so the history survives a reversal", () => {
      const source = store.upsertSource(manifest("abc"), "/tmp/talk.mp4");
      const run = store.createRun("run_test1", source, null, "p");
      db.prepare(
        "INSERT INTO extracted_values (observation_id, run_id, field_path, value_json, created_at) VALUES (?,?,?,?,?)",
      ).run("obs_1", run.id, "decisions[0]", '"ship on the 4th"', 1);

      const insert = db.prepare(
        "INSERT INTO review_events (id, observation_id, decision, actor, created_at) VALUES (?,?,?,?,?)",
      );
      insert.run("rev_1", "obs_1", "approved", "elyes", 10);
      insert.run("rev_2", "obs_1", "reopened", "elyes", 20);
      insert.run("rev_3", "obs_1", "rejected", "elyes", 30);

      const state = db.prepare("SELECT decision FROM review_state WHERE observation_id = ?").get("obs_1");
      expect(state).toEqual({ decision: "rejected" });
      // Every step is still on record — a mutable column would have erased them.
      expect(db.prepare("SELECT COUNT(*) AS n FROM review_events").get()).toEqual({ n: 3 });
    });
  });
});

describe("interrupted attempts", () => {
  it("closes an attempt that was in flight when the process died", () => {
    const db2 = openMemoryDatabase();
    const store2 = createRunStore(db2);
    const source = store2.upsertSource(manifest("abc"), "/tmp/talk.mp4");
    const run = store2.createRun("run_i", source, null, "process-a");
    store2.beginAttempt(run.id, "vision", "h1");

    // The lease ages out because nobody is left to renew it.
    db2.prepare("UPDATE runs SET lease_expires_at = ? WHERE id = ?").run(1, run.id);
    expect(store2.claim(run.id, "process-b")).toBe(true);

    const row = db2
      .prepare("SELECT status, error_code FROM run_stage_attempts WHERE run_id = ? AND stage = 'vision'")
      .get(run.id);
    expect(row).toMatchObject({ status: "failed", error_code: "INTERRUPTED" });
  });

  it("does not resume from an interrupted attempt", () => {
    const db2 = openMemoryDatabase();
    const store2 = createRunStore(db2);
    const source = store2.upsertSource(manifest("abc"), "/tmp/talk.mp4");
    const run = store2.createRun("run_j", source, null, "p");
    store2.beginAttempt(run.id, "vision", "h1");
    store2.claim(run.id, "p");
    expect(store2.cachedStageOutput(run.id, "vision", "h1")).toBeNull();
  });
});
