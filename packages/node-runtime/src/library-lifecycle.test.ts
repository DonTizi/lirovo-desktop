import { describe, expect, it } from "vitest";
import { openMemoryDatabase } from "./store/db.js";
import { createRunStore } from "./store/runs.js";
import { persistExtraction } from "./store/results.js";
import { archivedRuns, setRunArchived } from "./library-lifecycle.js";

describe("reversible run archive", () => {
  it("keeps values/evidence while archiving idempotently and restores visibility", () => {
    const db = openMemoryDatabase(); const runs = createRunStore(db);
    const source = runs.upsertSource({ source_type: "file", duration_s: 1, codec: "wav", has_audio: true, has_video: false,
      ext: ".wav", title: "Original", source_path: "/tmp/original.wav", content_sha256: "abc" }, "/tmp/original.wav");
    runs.createRun("run_abc", source, null, "owner"); runs.finish("run_abc", "succeeded");
    persistExtraction(db, { runId: "run_abc", data: { title: "Original" }, evidenceByField: new Map() });
    const original = db.prepare("SELECT * FROM extracted_values").all();
    setRunArchived(db, "run_abc", true); setRunArchived(db, "run_abc", true);
    expect(archivedRuns(db)).toHaveLength(1);
    expect(db.prepare("SELECT * FROM extracted_values").all()).toEqual(original);
    setRunArchived(db, "run_abc", false); setRunArchived(db, "run_abc", false);
    expect(archivedRuns(db)).toEqual([]);
    expect(() => setRunArchived(db, "missing", true)).toThrow("no longer exists");
    db.prepare("INSERT INTO extraction_queue VALUES ('run_abc','{}','queued',1,1,NULL)").run();
    expect(() => setRunArchived(db, "run_abc", true)).toThrow("Stop this extraction");
    db.close();
  });
});
