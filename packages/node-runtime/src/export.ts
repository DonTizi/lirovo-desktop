import type { Db } from "./store/db.js";
import { reviewHistory, runReviewSnapshots } from "./store/review.js";
import { validateAgainst } from "./inference/schema.js";

export interface ExportOptions { readonly format: "json" | "csv" | "markdown" | "folder"; readonly scope: "all" | "approved" }
export interface ExportOutcome { readonly cancelled: boolean; readonly directory?: string; readonly files?: number; readonly warnings?: readonly string[] }
export interface RunExport { readonly content: string; readonly mime: string; readonly extension: string; readonly suggestedName: string }
interface RunRow { id: string; status: string; createdAt: number; title: string | null; sourceId: string; sourceKind: string; sourceUri: string; duration: number | null; schemaJson: string | null }
interface ValueRow { id: string; path: string }
interface Evidence { id: string; modality: string; sourceRef: string; start: number; end: number; quote: string | null; role: string }
type Segment = string | number;
interface Tree { children: Map<Segment, Tree>; leaf?: { value: unknown; id: string; path: string } }
const tree = (): Tree => ({ children: new Map() });

/** Parse only the persisted dot/bracket grammar; never assign untrusted keys onto prototypes. */
function segments(path: string): Segment[] {
  if (path === "") return [];
  const tokens: Segment[] = [];
  let consumed = "";
  for (const match of path.matchAll(/(^|\.)([^.\[\]]+)|\[(\d+)\]/g)) {
    if (match.index !== consumed.length) throw new Error(`Cannot export ambiguous field path: ${path}`);
    consumed += match[0];
    if (match[3] !== undefined) {
      const index = Number(match[3]);
      if (!Number.isSafeInteger(index)) throw new Error(`Invalid array index: ${path}`);
      tokens.push(index);
    } else tokens.push(match[2]!);
  }
  if (consumed !== path) throw new Error(`Cannot export ambiguous field path: ${path}`);
  return tokens;
}
function insert(root: Tree, path: string, id: string, value: unknown): void {
  let current = root;
  for (const segment of segments(path)) {
    if (current.leaf) throw new Error(`Overlapping export fields: ${path}`);
    const child = current.children.get(segment) ?? tree();
    current.children.set(segment, child);
    current = child;
  }
  if (current.leaf || current.children.size) throw new Error(`Duplicate or overlapping export field: ${path}`);
  current.leaf = { value, id, path };
}

const appendPath = (base: string, key: Segment): string => typeof key === "number" ? `${base}[${key}]` : base ? `${base}.${key}` : key;
function materialize(node: Tree, outputPath: string, mappings: Map<string, string>): unknown {
  if (node.leaf) { mappings.set(node.leaf.id, outputPath); return node.leaf.value; }
  const keys = [...node.children.keys()];
  const array = keys.some((key) => typeof key === "number");
  if (array && keys.some((key) => typeof key !== "number")) throw new Error("A field is used as both an object and an array.");
  if (array) return (keys as number[]).sort((a, b) => a - b).map((key, index) => materialize(node.children.get(key)!, appendPath(outputPath, index), mappings));
  return Object.fromEntries(keys.map((key) => [key, materialize(node.children.get(key)!, appendPath(outputPath, key), mappings)]));
}

const json = (value: unknown): string => JSON.stringify(value, null, 2);
// All fields are quoted. Formula-sensitive display text gets an apostrophe;
// canonical JSON columns begin with an object/array, including wrapped value_json.
const csvCell = (value: string): string => `"${(/^[\s\u0000-\u001f]*[=+\-@＝＋－＠]/u.test(value) || /^[\t\r\n]/u.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`;
const markdownText = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/([\\`*_{}\[\]()#+.!|~%-])/g, "\\$1");
const codeBlock = (value: unknown): string => {
  const content = json(value);
  const longest = Math.max(2, ...[...content.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  return `${fence}json\n${content}\n${fence}`;
};
const timestamp = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
function sourceLink(uri: string, start: number): string | null {
  try {
    const url = new URL(uri);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    if (url.hostname === "youtube.com" || url.hostname === "www.youtube.com" || url.hostname === "youtu.be") url.searchParams.set("t", String(Math.floor(start)));
    else url.hash = `t=${start}`;
    return url.toString().replace(/[()]/g, (character) => character === "(" ? "%28" : "%29");
  } catch { return null; }
}

/** Build an immutable, read-transaction snapshot. Native main owns destination selection and writing. */
export function buildRunExport(db: Db, runId: string, options: ExportOptions): RunExport {
  if (!["json", "csv", "markdown"].includes(options.format) || !["all", "approved"].includes(options.scope)) throw new Error("Invalid export format or scope.");
  let output!: RunExport;
  db.transaction(() => {
    const run = db.prepare<[string], RunRow>(`SELECT r.id, r.status, r.created_at AS createdAt, s.title,
      s.id AS sourceId, s.kind AS sourceKind, s.uri AS sourceUri, s.duration_s AS duration,
      COALESCE(m.schema_json, sr.json_schema) AS schemaJson FROM runs r JOIN sources s ON s.id = r.source_id
      LEFT JOIN run_manifests m ON m.run_id = r.id LEFT JOIN schema_revisions sr ON sr.id = r.schema_revision_id WHERE r.id = ?`).get(runId);
    if (!run) throw new Error("This extraction no longer exists.");
    const rows = db.prepare<[string], ValueRow>("SELECT observation_id AS id, field_path AS path FROM extracted_values WHERE run_id = ? ORDER BY field_path, observation_id").all(runId);
    const snapshots = runReviewSnapshots(db, runId);
    const audit = rows.map((row) => ({ ...row, review: snapshots.get(row.id)!, history: reviewHistory(db, runId, row.id),
      evidence: db.prepare<[string, string], Evidence>(`SELECT e.id, e.modality, e.source_ref AS sourceRef, e.t_start AS start,
        e.t_end AS end, e.quote, ve.role FROM evidence e JOIN value_evidence ve ON ve.evidence_id = e.id
        WHERE ve.observation_id = ? AND e.run_id = ? ORDER BY e.t_start, e.id, ve.role`).all(row.id, runId) }));
    const selected = audit.filter((row) => options.scope === "all" || row.review.decision === "approved");
    const root = tree();
    for (const row of selected) insert(root, row.path, row.id, row.review.value);
    const mappings = new Map<string, string>();
    const result = materialize(root, "", mappings);
    const schema: unknown = run.schemaJson ? JSON.parse(run.schemaJson) : null;
    const warnings = ["Only stored observations are reconstructed. Unrecorded empty containers or missing fields are not invented.",
      "Array indexes are compacted when observations are omitted; observation exportPath records the resulting location.",
      "The audit includes all original values, rejected values, corrections, notes and source locations. Review it before sharing."];
    if (!selected.length) warnings.push("No observations match this export scope; result is an empty object, not a complete extraction.");
    if (options.scope === "all") warnings.push("All-results scope includes rejected and unreviewed values. Acceptance is not a factual accuracy guarantee.");
    if (schema && typeof schema === "object" && !Array.isArray(schema)) {
      try { warnings.push(...validateAgainst(schema as Record<string, unknown>, result).map((error) => `Exported result schema validation: ${error}`)); }
      catch { warnings.push("The saved schema could not be validated. The exported result is not asserted to conform."); }
    } else warnings.push("No saved schema is available; result shape is reconstructed from stored field paths.");
    const { schemaJson: _schemaJson, ...runInfo } = run;
    const envelope = { version: "lirovo.export.v1", scope: options.scope, run: runInfo, schema, result,
      observations: selected.map((row) => ({ id: row.id, path: row.path, exportPath: mappings.get(row.id), value: row.review.value, review: row.review, evidence: row.evidence })),
      omissions: audit.filter((row) => !mappings.has(row.id)).map((row) => ({ id: row.id, path: row.path, reason: row.review.decision === "rejected" ? "rejected" : "not-approved" })), audit, warnings };
    let content = json(envelope) + "\n";
    if (options.format === "csv") {
      const csvEncoding = {
        value_json: "JSON object wrapper. Decode with JSON.parse(cell).value to preserve all JSON types, including negative numbers.",
        review_json: "JSON object", evidence_json: "JSON array", history_json: "JSON array", metadata_json: "JSON object",
        displayColumns: "Formula-sensitive observation_id, field_path and export_path cells are prefixed with an apostrophe for spreadsheet safety. Canonical paths and ids remain in metadata/result provenance and JSON audit columns.",
      };
      const csvRows = [["record_type", "observation_id", "field_path", "export_path", "value_json", "review_json", "evidence_json", "history_json", "metadata_json"],
        ["metadata", "", "", "", "", "", "", "", JSON.stringify({ version: envelope.version, scope: options.scope, run: runInfo, schema, result, observations: envelope.observations.map(({ id, path, exportPath }) => ({ id, path, exportPath })), omissions: envelope.omissions, csvEncoding, warnings })],
        ...envelope.observations.map((row) => ["result", row.id, row.path, row.exportPath!, JSON.stringify({ value: row.value }), JSON.stringify(row.review), JSON.stringify(row.evidence), "", ""]),
        ...audit.map((row) => ["audit", row.id, row.path, "", JSON.stringify({ value: row.review.originalValue }), JSON.stringify({ id: row.id, path: row.path, ...row.review }), JSON.stringify(row.evidence), JSON.stringify(row.history), ""])];
      content = csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
    }
    if (options.format === "markdown") {
      const sections = [`# ${markdownText(run.title ?? "Lirovo extraction")}`, `Scope: ${options.scope === "approved" ? "Accepted results only" : "All results, including rejected and unreviewed"} · ${selected.length} results`,
        `Run: ${markdownText(run.id)} · Status: ${markdownText(run.status)}`, "## Export notes", ...warnings.map((warning) => `- ${markdownText(warning)}`), "## Results"];
      for (const [index, row] of selected.entries()) {
        sections.push(`### ${markdownText(row.path || "Root value")}`, typeof row.review.value === "string" ? markdownText(row.review.value) : codeBlock(row.review.value),
          `Review: ${row.review.decision ?? "unreviewed"}${row.review.corrected ? " · corrected" : ""}`);
        if (!row.evidence.length) sections.push("No linked evidence is recorded for this result.");
        for (const [proofIndex, proof] of row.evidence.entries()) {
          const id = `source-${index + 1}-${proofIndex + 1}`;
          const link = sourceLink(run.sourceUri, proof.start);
          sections.push(`Source: ${link ? `[${timestamp(proof.start)}](${link})` : timestamp(proof.start)}[^${id}]`,
            `[^${id}]: ${markdownText(proof.modality)} · ${markdownText(proof.sourceRef)} · ${timestamp(proof.start)}–${timestamp(proof.end)}${proof.quote ? ` — ${markdownText(proof.quote).replace(/\n/g, "\n    ")}` : ""}`);
        }
      }
      sections.push("## Complete provenance and review audit", "This machine-readable snapshot preserves full values and history, including items omitted from Results.", codeBlock(envelope));
      content = sections.join("\n\n") + "\n";
    }
    const extension = options.format === "markdown" ? "md" : options.format;
    output = { content, extension, mime: options.format === "json" ? "application/json" : options.format === "csv" ? "text/csv;charset=utf-8" : "text/markdown;charset=utf-8",
      suggestedName: `lirovo-${runId.replace(/[^a-zA-Z0-9_-]/g, "_")}-${options.scope}.${extension}` };
  })();
  return output;
}
