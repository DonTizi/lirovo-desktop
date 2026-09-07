import { describe, expect, it } from "vitest";
import type { InferenceBackend } from "@lirovo/contracts";
import { createRunStore, createStageLedger, openMemoryDatabase, reviewValue } from "@lirovo/node-runtime";
import { committedExtraction, persistRecoveredExtraction, requireChosenBackend, recoverFinishedReason } from "./extraction-recovery";

describe("recovery boundaries", () => {
  it("keeps observation identity, original values and human decisions after a persistence retry", () => {
    const db = openMemoryDatabase();
    const runs = createRunStore(db);
    const source = runs.upsertSource({ source_type: "file", duration_s: 1, codec: "h264", has_audio: true,
      has_video: true, ext: ".mp4", title: "probe", source_path: "/tmp/probe.mp4", content_sha256: "abc" }, "/tmp/probe.mp4");
    runs.createRun("run_recovery", source, null, "process-a");
    const input = { runId: "run_recovery", data: { title: "Original" }, evidenceByField: new Map() };
    expect(committedExtraction(db, input.runId)).toBeNull();
    persistRecoveredExtraction(db, input);
    const original = db.prepare("SELECT observation_id, value_json FROM extracted_values").get()!;
    reviewValue(db, { runId: input.runId, observationId: String(original.observation_id), expectedRevision: 0, action: "correct", value: "Human correction" });
    expect(persistRecoveredExtraction(db, { ...input, data: { title: "Different regenerated value" } }).values).toBe(1);
    expect(db.prepare("SELECT observation_id, value_json FROM extracted_values").all()).toEqual([original]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM review_events").get()?.n).toBe(1);
    runs.createRun("run_empty", source, null, "owner");
    const ledger = createStageLedger(runs, "run_empty");
    ledger.complete("reason", ledger.begin("reason", "hash"), { status: "done", output: { data: {}, evidenceByField: new Map() } });
    expect(recoverFinishedReason(db, "run_empty")).toEqual({ values: 0, grounded: 0, evidenceRows: 0 });
    expect(recoverFinishedReason(db, "run_empty")).toEqual({ values: 0, grounded: 0, evidenceRows: 0 });
    db.close();
  });

  it("never probes an alternate provider when the chosen provider is unavailable, missing or not set", async () => {
    const calls: string[] = [];
    const adapters = ["local", "remote"].map((id) => ({ id, detect: async () => {
      calls.push(id); return { available: id === "remote" };
    } })) as unknown as InferenceBackend[];
    await expect(requireChosenBackend(adapters, "local")).rejects.toThrow("no other provider was contacted");
    await expect(requireChosenBackend(adapters, "unknown")).rejects.toThrow();
    await expect(requireChosenBackend(adapters, null)).rejects.toThrow("Choose a backend");
    expect(calls).toEqual(["local"]);
    expect(await requireChosenBackend(adapters, "remote")).toBe(adapters[1]);
    expect(calls).toEqual(["local", "remote"]);
  });
});
