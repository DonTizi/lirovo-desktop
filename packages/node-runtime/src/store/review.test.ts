import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDatabase, openMemoryDatabase, type Db } from "./db.js";
import { getValueReview, reviewHistory, reviewValue, runReviewSnapshots } from "./review.js";

const databases: Db[] = [];
const directories: string[] = [];
const setup = (db = openMemoryDatabase()): Db => {
  databases.push(db);
  db.exec(`INSERT INTO sources VALUES ('s','file','scratch',NULL,NULL,NULL,1,1,1);
    INSERT INTO runs (id,source_id,status,created_at) VALUES ('run','s','succeeded',1), ('other','s','succeeded',1);
    INSERT INTO extracted_values (observation_id,run_id,field_path,value_json,created_at)
    VALUES ('value','run','title','"Original"',1), ('numeric','run','metrics[0]','3',1);
    INSERT INTO evidence VALUES ('proof','run','audio','transcript:1',10,12,'Original',NULL);
    INSERT INTO value_evidence VALUES ('value','proof','value');`);
  return db;
};
const base = { runId: "run", observationId: "value", expectedRevision: 0 };
afterEach(() => { for (const db of databases.splice(0)) db.close(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("audited value review", () => {
  it("starts undecided, edits without replacing the original or evidence, then accepts", () => {
    const db = setup();
    expect(getValueReview(db, "run", "value")).toEqual({ revision: 0, decision: null, corrected: false, originalValue: "Original", value: "Original" });
    const corrected = reviewValue(db, { ...base, action: "correct", value: "Exact correction\nÉté", note: "Checked 0:10" });
    expect(corrected).toEqual({ revision: 1, decision: "reopened", corrected: true, originalValue: "Original", value: "Exact correction\nÉté" });
    const accepted = reviewValue(db, { ...base, expectedRevision: 1, action: "approve" });
    expect(accepted.decision).toBe("approved");
    expect(db.prepare("SELECT value_json FROM extracted_values WHERE observation_id = 'value'").get()).toEqual({ value_json: '"Original"' });
    expect(db.prepare("SELECT COUNT(*) AS n FROM value_evidence").get()).toEqual({ n: 1 });
    expect(reviewHistory(db, "run", "value").map((e) => [e.action, e.revision, e.note])).toEqual([["correct", 1, "Checked 0:10"], ["approve", 2, null]]);
    expect(runReviewSnapshots(db, "run").get("value")).toEqual(accepted);
  });

  it("reopens rejection without losing a correction", () => {
    const db = setup();
    reviewValue(db, { ...base, action: "correct", value: "Correction" });
    reviewValue(db, { ...base, expectedRevision: 1, action: "reject" });
    expect(reviewValue(db, { ...base, expectedRevision: 2, action: "reopen" })).toMatchObject({ revision: 3, decision: "reopened", value: "Correction" });
    expect(db.prepare("SELECT decision FROM review_state WHERE observation_id = 'value'").get()).toEqual({ decision: "reopened" });
  });

  it("rejects stale writes, wrong-run writes and unknown observations without history changes", () => {
    const db = setup();
    reviewValue(db, { ...base, action: "approve" });
    expect(() => reviewValue(db, { ...base, action: "reject" })).toThrow(/reviewed elsewhere/);
    expect(() => reviewValue(db, { ...base, runId: "other", action: "reject" })).toThrow(/does not belong/);
    expect(() => reviewHistory(db, "other", "value")).toThrow(/does not belong/);
    expect(() => reviewValue(db, { ...base, observationId: "missing", action: "reject" })).toThrow(/does not belong/);
    expect(reviewHistory(db, "run", "value")).toHaveLength(1);
  });

  it("preserves legacy JSON types and refuses non-JSON values", () => {
    const db = setup();
    for (const value of [3, null, false, {}, []]) expect(() => reviewValue(db, { ...base, action: "correct", value })).toThrow(/requires a string/);
    for (const value of [undefined, Number.NaN, Infinity, { nested: undefined }, new Date()]) expect(() => reviewValue(db, { ...base, action: "correct", value })).toThrow(/finite JSON/);
    expect(reviewHistory(db, "run", "value")).toHaveLength(0);
  });

  it("allows explicit finite JSON corrections for legacy null without approving or replacing the original", () => {
    const db = setup();
    db.exec("UPDATE extracted_values SET value_json = 'null' WHERE observation_id = 'value'");
    const values = ["Known now", -2.5, true, { nested: [1, "Été"] }, [false, null], null];
    for (const [index, value] of values.entries()) {
      const result = reviewValue(db, { ...base, expectedRevision: index, action: "correct", value });
      expect(result).toMatchObject({ revision: index + 1, originalValue: null, decision: "reopened", corrected: true });
      expect(result.value).toEqual(value);
    }
    expect(reviewHistory(db, "run", "value").map((event) => event.value)).toEqual(values);
    expect(db.prepare("SELECT value_json FROM extracted_values WHERE observation_id = 'value'").get()).toEqual({ value_json: "null" });
    expect(() => reviewValue(db, { ...base, action: "correct", value: "stale" })).toThrow(/reviewed elsewhere/);
  });

  it("keeps saved null-field schemas authoritative and rejects non-JSON fallback corrections", () => {
    const db = setup();
    db.exec("UPDATE extracted_values SET value_json = 'null' WHERE observation_id = 'value'");
    for (const value of [undefined, Infinity, Number.NaN, { missing: undefined }, new Date()]) expect(() => reviewValue(db, { ...base, action: "correct", value })).toThrow(/finite JSON/);
    db.prepare("INSERT INTO run_manifests(run_id,schema_json,prompts_json,dependencies_json,settings_json,created_at) VALUES ('run',?,'{}','{}','{}',1)").run(JSON.stringify({ type: "object", properties: { title: { type: ["string", "null"], minLength: 3 } } }));
    for (const value of [42, false, [], {}, "x"]) expect(() => reviewValue(db, { ...base, action: "correct", value })).toThrow(/does not match/);
    expect(reviewValue(db, { ...base, action: "correct", value: "Resolved" })).toMatchObject({ value: "Resolved", originalValue: null, decision: "reopened" });
    reviewValue(db, { ...base, expectedRevision: 1, action: "approve" });
    expect(reviewValue(db, { ...base, expectedRevision: 2, action: "correct", value: null })).toMatchObject({ value: null, decision: "reopened" });
  });

  it("permits missing-value correction when a legacy schema does not resolve that field", () => {
    const db = setup();
    db.exec("UPDATE extracted_values SET value_json = 'null' WHERE observation_id = 'value'");
    db.prepare("INSERT INTO run_manifests(run_id,schema_json,prompts_json,dependencies_json,settings_json,created_at) VALUES ('run',?,'{}','{}','{}',1)").run(JSON.stringify({ type: "object", properties: { another: { type: "string" } } }));
    expect(reviewValue(db, { ...base, action: "correct", value: { recovered: true } })).toMatchObject({ value: { recovered: true }, originalValue: null, decision: "reopened" });
  });

  it("validates saved array-item constraints without relying on the original type", () => {
    const db = setup();
    db.prepare(`INSERT INTO run_manifests (run_id,schema_json,prompts_json,dependencies_json,settings_json,created_at) VALUES ('run',?,'{}','{}','{}',1)`).run(JSON.stringify({ type: "object", properties: { metrics: { type: "array", items: { type: "integer", minimum: 0, maximum: 10 } }, title: { type: "string", minLength: 2 } } }));
    for (const value of [-1, 11, 2.5, "5"]) expect(() => reviewValue(db, { ...base, observationId: "numeric", action: "correct", value })).toThrow(/does not match/);
    expect(reviewValue(db, { ...base, observationId: "numeric", action: "correct", value: 5 }).value).toBe(5);
    expect(() => reviewValue(db, { ...base, action: "correct", value: "" })).toThrow(/does not match/);
  });

  it("rolls back a decision when writing its correction fails", () => {
    const db = setup();
    db.exec("CREATE TRIGGER fail_correction BEFORE INSERT ON review_corrections BEGIN SELECT RAISE(ABORT, 'scratch failure'); END");
    expect(() => reviewValue(db, { ...base, action: "correct", value: "Changed" })).toThrow(/scratch failure/);
    expect(reviewHistory(db, "run", "value")).toHaveLength(0);
  });

  it("retains edits and history after closing and reopening a disk database", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lirovo-review-test-")); directories.push(dir);
    const file = path.join(dir, "scratch.sqlite");
    const first = setup(openDatabase(file));
    reviewValue(first, { ...base, action: "correct", value: "Persisted" });
    reviewValue(first, { ...base, expectedRevision: 1, action: "approve" });
    first.close(); databases.pop();
    const second = openDatabase(file); databases.push(second);
    expect(getValueReview(second, "run", "value")).toMatchObject({ value: "Persisted", originalValue: "Original", decision: "approved", revision: 2 });
    expect(second.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(() => reviewValue(second, { ...base, expectedRevision: 1, action: "reject" })).toThrow(/reviewed elsewhere/);
  });
});
