import type { Db } from "./store/db.js";

export interface KnowledgeEvidence { sourceRef: string; modality: string; tStart: number; tEnd: number; quote: string | null }
export interface KnowledgeHit {
  observationId: string; runId: string; title: string; sourceUri: string; sourceId: string;
  fieldPath: string; value: unknown; text: string;
  decision: "approved" | "rejected" | "reopened" | null; corrected: boolean; evidence: KnowledgeEvidence[];
}
export interface KnowledgeQuery { query: string; runIds?: readonly string[] | undefined; approvedOnly?: boolean | undefined }
export interface KnowledgeResult { hits: KnowledgeHit[]; total: number; runCount: number; method: "keywords" }
const normalize = (text: string): string => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

/** Read effective values without changing originals or inferring agreement. */
export const knowledgeCorpus = (db: Db, runIds?: readonly string[]): KnowledgeHit[] => {
  const selected = runIds === undefined || runIds.length === 0 ? [] : [...new Set(runIds)];
  const scope = selected.length === 0 ? "" : ` AND r.id IN (${selected.map(() => "?").join(",")})`;
  const rows = db.prepare<string[], {
    observation_id: string; run_id: string; field_path: string; value_json: string;
    title: string | null; uri: string; source_id: string;
    decision: KnowledgeHit["decision"]; correction_json: string | null;
  }>(`WITH corrections AS (
        SELECT e.observation_id, c.value_json,
          ROW_NUMBER() OVER (PARTITION BY e.observation_id ORDER BY e.created_at DESC,e.id DESC) AS position
        FROM review_events e JOIN review_corrections c ON c.event_id=e.id
      )
      SELECT v.observation_id, v.run_id, v.field_path, v.value_json, s.title, s.uri, s.id AS source_id,
        rs.decision, c.value_json AS correction_json
      FROM extracted_values v JOIN runs r ON r.id = v.run_id JOIN sources s ON s.id = r.source_id
      LEFT JOIN review_state rs ON rs.observation_id=v.observation_id
      LEFT JOIN corrections c ON c.observation_id=v.observation_id AND c.position=1
      WHERE r.status = 'succeeded' AND NOT EXISTS (SELECT 1 FROM run_archives a WHERE a.run_id=r.id)${scope}
      ORDER BY r.created_at DESC, v.run_id, v.field_path`).all(...selected);
  const evidenceRows = db.prepare<string[], {observation_id: string; source_ref: string; modality: string; t_start: number; t_end: number; quote: string | null}>(
    `SELECT ve.observation_id,e.source_ref,e.modality,e.t_start,e.t_end,e.quote FROM evidence e
     JOIN value_evidence ve ON ve.evidence_id=e.id JOIN extracted_values v ON v.observation_id=ve.observation_id AND v.run_id=e.run_id
     JOIN runs r ON r.id=v.run_id WHERE r.status='succeeded' AND NOT EXISTS (SELECT 1 FROM run_archives a WHERE a.run_id=r.id)${scope}
     ORDER BY e.t_start,e.id`).all(...selected);
  const evidence = new Map<string, KnowledgeEvidence[]>();
  for (const row of evidenceRows) {
    const items = evidence.get(row.observation_id) ?? [];
    items.push({sourceRef: row.source_ref, modality: row.modality, tStart: row.t_start, tEnd: row.t_end, quote: row.quote});
    evidence.set(row.observation_id, items);
  }
  const result: KnowledgeHit[] = [];
  for (const row of rows) {
    if (row.decision === "rejected") continue;
    const value: unknown = JSON.parse(row.correction_json ?? row.value_json);
    result.push({observationId: row.observation_id, runId: row.run_id, title: row.title ?? "Untitled extraction",
      sourceUri: row.uri, sourceId: row.source_id, fieldPath: row.field_path, value,
      text: typeof value === "string" ? value : JSON.stringify(value),
      decision: row.decision, corrected: row.correction_json !== null,
      evidence: evidence.get(row.observation_id) ?? [],
    });
  }
  return result;
};

/** Explicit keyword retrieval, not semantic understanding or factual verification. */
export const searchKnowledge = (db: Db, input: KnowledgeQuery): KnowledgeResult => {
  const words = [...new Set(normalize(input.query).match(/[\p{L}\p{N}]+/gu) ?? [])];
  if (words.length === 0) return {hits: [], total: 0, runCount: 0, method: "keywords"};
  const ranked = knowledgeCorpus(db, input.runIds).filter(hit => !input.approvedOnly || hit.decision === "approved")
    .map(hit => {
      const body = normalize(`${hit.text} ${hit.fieldPath} ${hit.evidence.map(e => e.quote ?? "").join(" ")}`);
      const title = normalize(hit.title);
      return {hit, score: words.reduce((sum, word) => sum + (body.includes(word) ? 3 : 0) + (title.includes(word) ? 1 : 0), 0)};
    }).filter(item => item.score > 0)
    .sort((a,b) => b.score-a.score || a.hit.runId.localeCompare(b.hit.runId) || a.hit.fieldPath.localeCompare(b.hit.fieldPath));
  // Limit whole retrieval records, never shorten a value or its evidence.
  const hits: KnowledgeHit[] = [];
  for (const item of ranked) { if (hits.length === 100) break; hits.push(item.hit); }
  return {hits, total: ranked.length, runCount: new Set(ranked.map(item => item.hit.runId)).size, method: "keywords"};
};

export interface KnowledgeComparison {
  runs: {runId: string; title: string; sourceId: string}[];
  fields: {field: string; entries: KnowledgeHit[]}[];
  note: string;
}
export const compareKnowledge = (db: Db, runIds: readonly string[], approvedOnly = false): KnowledgeComparison => {
  if (new Set(runIds).size < 2) throw new Error("Choose at least two extractions to compare.");
  const hits = knowledgeCorpus(db, runIds).filter(hit => !approvedOnly || hit.decision === "approved");
  const runs = new Map<string, KnowledgeComparison["runs"][number]>();
  const groups = new Map<string, KnowledgeHit[]>();
  for (const hit of hits) {
    runs.set(hit.runId, {runId: hit.runId, title: hit.title, sourceId: hit.sourceId});
    const field = hit.fieldPath.replace(/\[\d+\]/g, "[]");
    const group = groups.get(field) ?? []; group.push(hit); groups.set(field, group);
  }
  return {runs: [...runs.values()], fields: [...groups.entries()].map(([field, entries]) => ({field, entries})),
    note: "Grouped by field name, not by inferred entity or agreement. Different extractions may use different schemas. Repeated runs of the same source are not independent evidence."};
};
