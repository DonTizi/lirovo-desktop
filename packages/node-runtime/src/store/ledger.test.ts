import { describe, expect, it } from "vitest";
import { openMemoryDatabase } from "./db.js";
import { createRunStore } from "./runs.js";
import { createStageLedger } from "./ledger.js";

describe("SQLite reasoning ledger", () => {
  it("round-trips Map evidence and invalidates the old lossy object representation", () => {
    const db = openMemoryDatabase();
    const runs = createRunStore(db);
    const source = runs.upsertSource({ source_type: "file", duration_s: 1, codec: "a", has_audio: true,
      has_video: false, ext: ".wav", title: "probe", source_path: "/tmp/probe.wav", content_sha256: "abc" }, "/tmp/probe.wav");
    runs.createRun("run_probe", source, null, "owner");
    const ledger = createStageLedger(runs, "run_probe");
    const evidence = [{ sourceRef: "seg_1", modality: "audio", tStart: 0, tEnd: 1, quote: "Complete citation", nodeKey: null }];
    const result = { data: { title: "Original" }, evidenceByField: new Map([["title", evidence]]) };
    ledger.complete("reason", ledger.begin("reason", "h1"), { status: "done", output: result });
    expect(createStageLedger(runs, "run_probe").cached("reason", "h1")).toEqual(result);
    runs.completeAttempt("run_probe", "reason", runs.beginAttempt("run_probe", "reason", "legacy"), {
      status: "done", output: { data: { title: "Legacy" }, evidenceByField: {} },
    });
    expect(ledger.cached("reason", "legacy")).toBeNull();
    ledger.complete("reason", ledger.begin("reason", "empty"), { status: "done", output: { data: {}, evidenceByField: new Map() } });
    expect(ledger.cached("reason", "empty")).toEqual({ data: {}, evidenceByField: new Map() });
    db.close();
  });
});
