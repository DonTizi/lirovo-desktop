import { afterEach, describe, expect, it } from "vitest";
import { openMemoryDatabase, type Db } from "./store/db.js";
import { persistExtraction } from "./store/results.js";
import { reviewValue } from "./store/review.js";
import { buildRunExport } from "./export.js";

const databases: Db[] = [];
const setup = (data: unknown = { title: 'Été, "東京"\n=HYPERLINK("https://example.com")', facts: [{ value: 3, active: true }, { value: null, active: false }] }): Db => {
  const db = openMemoryDatabase(); databases.push(db);
  db.prepare("INSERT INTO sources VALUES (?,?,?,?,?,?,?,?,?)").run("s", "url", "https://www.youtube.com/watch?v=example", null, "Research <img> [title]", 90, 1, 1, 1);
  db.exec("INSERT INTO runs(id,source_id,status,created_at) VALUES ('run','s','succeeded',1)");
  persistExtraction(db, { runId: "run", data, evidenceByField: new Map([["title", [{ modality: "audio", sourceRef: "asr#seg_1", tStart: 12.5, tEnd: 15, quote: "Exact quote\nÉté", nodeKey: null }]]]) });
  return db;
};
const envelope = (db: Db, scope: "all" | "approved" = "all") => JSON.parse(buildRunExport(db, "run", { format: "json", scope }).content);
const idFor = (db: Db, field: string): string => db.prepare<[string], { id: string }>("SELECT observation_id AS id FROM extracted_values WHERE field_path = ?").get(field)!.id;
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

/** Small independent RFC4180 parser: embedded quotes, CRLF and line breaks remain literal cell data. */
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') {
      if (quoted && content[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && c === ",") { row.push(cell); cell = ""; }
    else if (!quoted && c === "\r" && content[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += c;
  }
  if (quoted || row.length || cell) throw new Error("Invalid or unterminated CSV");
  return rows;
}

describe("provenance-preserving run exports", () => {
  it("reconstructs nested arrays, objects, booleans, numbers, null and complete Unicode text", () => {
    const data = { title: 'Été, "東京"\n=HYPERLINK("https://example.com")', facts: [{ value: 3, active: true }, { value: null, active: false }] };
    const db = setup(data), out = envelope(db);
    expect(out.result).toEqual(data);
    expect(out.observations.find((row: { path: string }) => row.path === "title").evidence[0]).toMatchObject({ start: 12.5, end: 15, quote: "Exact quote\nÉté", sourceRef: "asr#seg_1" });
    expect(out.audit).toHaveLength(5);
    expect(out.run.sourceUri).toBe("https://www.youtube.com/watch?v=example");
  });
  it("uses corrections while preserving originals, notes and rejection history", () => {
    const db = setup(), id = idFor(db, "title");
    reviewValue(db, { runId: "run", observationId: id, expectedRevision: 0, action: "correct", value: "Corrected\nÉté", note: "Checked 0:12" });
    reviewValue(db, { runId: "run", observationId: id, expectedRevision: 1, action: "reject" });
    const all = envelope(db), approved = envelope(db, "approved");
    expect(all.result.title).toBe("Corrected\nÉté");
    expect(approved.result).toEqual({});
    expect(approved.omissions.find((row: { id: string }) => row.id === id).reason).toBe("rejected");
    const audit = approved.audit.find((row: { id: string }) => row.id === id);
    expect(audit.review.originalValue).toContain("東京");
    expect(audit.history.map((row: { action: string }) => row.action)).toEqual(["correct", "reject"]);
    expect(audit.history[0].note).toBe("Checked 0:12");
  });
  it("compacts omitted array slots explicitly instead of silently inventing nulls", () => {
    const db = setup({ items: [{ name: "A" }, { name: "B" }, { name: "C" }] });
    reviewValue(db, { runId: "run", observationId: idFor(db, "items[2].name"), expectedRevision: 0, action: "approve" });
    const out = envelope(db, "approved");
    expect(out.result).toEqual({ items: [{ name: "C" }] });
    expect(out.observations[0]).toMatchObject({ path: "items[2].name", exportPath: "items[0].name" });
    expect(out.omissions).toHaveLength(2);
  });
  it("reports schema violations and missing containers without inventing empty values", () => {
    const db = setup({ title: "hello", empty: [] });
    db.prepare("INSERT INTO run_manifests(run_id,schema_json,prompts_json,dependencies_json,settings_json,created_at) VALUES ('run',?,'{}','{}','{}',1)").run(JSON.stringify({ type: "object", required: ["title", "empty"], properties: { title: { type: "string" }, empty: { type: "array" } } }));
    const out = envelope(db);
    expect(out.result).toEqual({ title: "hello" });
    expect(out.warnings.join("\n")).toContain("schema validation");
    expect(out.warnings.join("\n")).toContain("Unrecorded empty containers");
  });
  it("round-trips every CSV JSON column and protects formula-leading field names", () => {
    const db = setup({ "=danger": "=1+1", "@SUM": "\t=1", "normal": '"quote", comma\n東京' });
    const out = envelope(db);
    const rows = parseCsv(buildRunExport(db, "run", { format: "csv", scope: "all" }).content);
    expect(rows.every((row) => row.length === 9)).toBe(true);
    const metadata = JSON.parse(rows[1]![8]!);
    expect(metadata.result).toEqual(out.result);
    const results = rows.filter((row) => row[0] === "result");
    expect(JSON.parse(results.find((row) => row[2] === "'=danger")![4]!).value).toBe("=1+1");
    expect(JSON.parse(results.find((row) => row[2] === "'@SUM")![4]!).value).toBe("\t=1");
    for (const row of results) {
      const original = out.observations.find((item: { id: string }) => item.id === row[1]);
      expect(JSON.parse(row[4]!).value).toEqual(original.value);
      expect(JSON.parse(row[5]!)).toEqual(original.review);
      expect(JSON.parse(row[6]!)).toEqual(original.evidence);
    }
  });
  it("makes negative typed values directly decodable without stripping spreadsheet guards", () => {
    const data = { negative: -2.5, small: -0.000001, integer: -42, formulaText: "-2.5", text: "'=-1", truth: false, absent: null };
    const db = setup(data);
    const rows = parseCsv(buildRunExport(db, "run", { format: "csv", scope: "all" }).content);
    expect(JSON.parse(rows[1]![8]!).csvEncoding.value_json).toContain("JSON.parse(cell).value");
    const reconstructed = Object.fromEntries(rows.filter((row) => row[0] === "result").map((row) => [row[2], JSON.parse(row[4]!).value]));
    expect(reconstructed).toEqual(data);
    for (const row of rows.filter((entry) => entry[0] === "result" || entry[0] === "audit")) expect(row[4]!.startsWith("{")).toBe(true);
  });
  it("includes excluded observations only in CSV audit records", () => {
    const db = setup();
    reviewValue(db, { runId: "run", observationId: idFor(db, "title"), expectedRevision: 0, action: "reject" });
    const rows = parseCsv(buildRunExport(db, "run", { format: "csv", scope: "approved" }).content);
    expect(rows.filter((row) => row[0] === "result")).toHaveLength(0);
    expect(rows.filter((row) => row[0] === "audit")).toHaveLength(5);
  });
  it("exports Markdown references, safe source timestamps and a complete parseable audit", () => {
    const db = setup({ title: 'Literal ```\n<img src=x> [[note]] ![bad](javascript:alert(1))' });
    const content = buildRunExport(db, "run", { format: "markdown", scope: "all" }).content;
    expect(content).toContain("[^source-1-1]: audio");
    expect(content).toContain("https://www.youtube.com/watch?v=example&t=12");
    expect(content).toContain("&lt;img");
    const match = /(`{4,})json\n([\s\S]*)\n\1\n$/.exec(content);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![2]!)).toEqual(envelope(db));
  });
  it("does not turn local paths or unsafe protocols into Markdown links", () => {
    const db = setup({ title: "ok" });
    for (const source of ["javascript:alert(1)", "/private/video.mp4", "https://user:secret@example.com/video"]) {
      db.prepare("UPDATE sources SET uri = ?").run(source);
      const content = buildRunExport(db, "run", { format: "markdown", scope: "all" }).content;
      expect(content).toContain("Source: 0:12[^source-1-1]");
      expect(content).not.toContain("](" + source);
    }
  });
  it("retains prototype-like field keys as own JSON data, never mutating prototypes", () => {
    const db = setup(JSON.parse('{"__proto__":{"polluted":"no"},"constructor":{"prototype":{"safe":true}}}'));
    expect(envelope(db).result).toEqual(JSON.parse('{"__proto__":{"polluted":"no"},"constructor":{"prototype":{"safe":true}}}'));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("rejects duplicate paths, conflicting shapes, missing runs and invalid options safely", () => {
    const db = setup({ title: "ok" });
    expect(() => buildRunExport(db, "missing", { format: "json", scope: "all" })).toThrow(/no longer exists/);
    expect(() => buildRunExport(db, "run", { format: "html" as "json", scope: "all" })).toThrow(/Invalid/);
    db.exec("INSERT INTO extracted_values(observation_id,run_id,field_path,value_json,created_at) VALUES ('duplicate','run','title','1',1)");
    expect(() => envelope(db)).toThrow(/Duplicate/);
    db.exec("UPDATE extracted_values SET field_path = 'title.child' WHERE observation_id = 'duplicate'");
    expect(() => envelope(db)).toThrow(/Overlapping/);
    expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
  });
  it("exports numeric root arrays in numeric index order", () => {
    const data = Array.from({ length: 15 }, (_, n) => n);
    expect(envelope(setup(data)).result).toEqual(data);
  });
  it("preserves primitive roots and nested array types without filling missing slots", () => {
    for (const data of [null, false, 42, "complete root", [[1, 2], [3, 4]]]) expect(envelope(setup(data)).result).toEqual(data);
    const db = setup({ groups: [[{ n: 1 }], [{ n: 2 }, { n: 3 }]] });
    reviewValue(db, { runId: "run", observationId: idFor(db, "groups[1][1].n"), expectedRevision: 0, action: "approve" });
    const out = envelope(db, "approved");
    expect(out.result).toEqual({ groups: [[{ n: 3 }]] });
    expect(out.observations[0].exportPath).toBe("groups[0][0].n");
  });
});
