import { randomUUID } from "node:crypto";
import type { Db } from "./db.js";
import { validateAgainst } from "../inference/schema.js";

export type ReviewAction = "approve" | "reject" | "reopen" | "correct";
export interface ReviewMutation {
  readonly runId: string;
  readonly observationId: string;
  readonly expectedRevision: number;
  readonly action: ReviewAction;
  readonly value?: unknown;
  readonly note?: string;
}
export interface ReviewSnapshot {
  readonly revision: number;
  readonly decision: "approved" | "rejected" | "reopened" | null;
  readonly corrected: boolean;
  readonly originalValue: unknown;
  readonly value: unknown;
}
export interface ReviewHistoryEntry {
  readonly id: string;
  readonly revision: number;
  readonly action: ReviewAction;
  readonly actor: string;
  readonly note: string | null;
  readonly createdAt: number;
  readonly value?: unknown;
}
interface Observation { value_json: string; field_path: string; schema_revision_id: string | null }
interface EventRow { id: string; decision: NonNullable<ReviewSnapshot["decision"]>; actor: string; note: string | null; created_at: number; value_json: string | null }

const observation = (db: Db, runId: string, id: string): Observation => {
  const row = db.prepare<[string, string], Observation>(
    `SELECT v.value_json, v.field_path, r.schema_revision_id FROM extracted_values v
     JOIN runs r ON r.id = v.run_id WHERE v.run_id = ? AND v.observation_id = ?`,
  ).get(runId, id);
  if (!row) throw new Error("This result does not belong to the requested extraction.");
  return row;
};
const events = (db: Db, id: string): EventRow[] => db.prepare<[string], EventRow>(
  `SELECT e.id, e.decision, e.actor, e.note, e.created_at, c.value_json FROM review_events e
   LEFT JOIN review_corrections c ON c.event_id = e.id WHERE e.observation_id = ?
   ORDER BY e.created_at, e.id`,
).all(id);

const snapshot = (original: unknown, history: readonly EventRow[]): ReviewSnapshot => {
  const corrected = [...history].reverse().find((event) => event.value_json !== null);
  return {
    revision: history.length,
    decision: history.at(-1)?.decision ?? null,
    corrected: corrected !== undefined,
    originalValue: original,
    value: corrected ? JSON.parse(corrected.value_json!) : original,
  };
};

export const getValueReview = (db: Db, runId: string, id: string): ReviewSnapshot =>
  snapshot(JSON.parse(observation(db, runId, id).value_json), events(db, id));

export const runReviewSnapshots = (db: Db, runId: string): Map<string, ReviewSnapshot> => {
  const rows = db.prepare<[string], { observation_id: string; value_json: string }>(
    "SELECT observation_id, value_json FROM extracted_values WHERE run_id = ?",
  ).all(runId);
  return new Map(rows.map((row) => [row.observation_id, snapshot(JSON.parse(row.value_json), events(db, row.observation_id))]));
};

export const reviewHistory = (db: Db, runId: string, id: string): ReviewHistoryEntry[] => {
  observation(db, runId, id);
  return events(db, id).map((event, index) => ({
    id: event.id, revision: index + 1, actor: event.actor, note: event.note, createdAt: event.created_at,
    action: event.value_json !== null ? "correct" : event.decision === "approved" ? "approve" : event.decision === "rejected" ? "reject" : "reopen",
    ...(event.value_json === null ? {} : { value: JSON.parse(event.value_json) }),
  }));
};

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const jsonValue = (value: unknown): boolean => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(jsonValue);
  return object(value) && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(jsonValue);
};

/** Validate an addressable leaf; legacy non-null values retain their type. Null carries no inferred type. */
const validateCorrection = (db: Db, runId: string, row: Observation, value: unknown): void => {
  if (!jsonValue(value)) throw new Error("The correction must be a finite JSON value.");
  const stored = db.prepare<[string], { schema_json: string | null }>(
    `SELECT COALESCE(m.schema_json, s.json_schema) AS schema_json FROM runs r
     LEFT JOIN run_manifests m ON m.run_id = r.id
     LEFT JOIN schema_revisions s ON s.id = r.schema_revision_id WHERE r.id = ?`,
  ).get(runId);
  const root: unknown = stored?.schema_json ? JSON.parse(stored.schema_json) : null;
  let leaf = root;
  for (const part of row.field_path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean)) {
    if (!object(leaf)) { leaf = null; break; }
    leaf = /^\d+$/.test(part) && (leaf.type === "array" || leaf.items !== undefined)
      ? leaf.items
      : object(leaf.properties) ? leaf.properties[part] : null;
  }
  if (object(root) && object(leaf)) {
    const errors = validateAgainst({ ...leaf, ...(root.$defs ? { $defs: root.$defs } : {}), ...(root.definitions ? { definitions: root.definitions } : {}) }, value);
    if (errors.length) throw new Error(`The correction does not match its field: ${errors.join("; ")}`);
    return;
  }
  const original: unknown = JSON.parse(row.value_json);
  // A missing extraction is not a schema declaring type:null. The explicit JSON
  // correction may supply any finite JSON type, and still needs separate approval.
  if (original === null) return;
  const kind = (v: unknown): string => v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
  if (kind(original) !== kind(value)) throw new Error(`This field requires a ${kind(original)} value. Its saved schema is unavailable.`);
};

/** Lock, check revision and append both decision and correction as one atomic action. */
export const reviewValue = (db: Db, input: ReviewMutation, actor = "local-user"): ReviewSnapshot => {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new Error("Invalid review revision.");
  if (!["approve", "reject", "reopen", "correct"].includes(input.action)) throw new Error("Invalid review action.");
  if (input.note !== undefined && typeof input.note !== "string") throw new Error("The review note must be text.");
  if (typeof actor !== "string" || !actor.trim()) throw new Error("A review actor is required.");
  let result: ReviewSnapshot | undefined;
  db.transaction(() => {
    const row = observation(db, input.runId, input.observationId);
    const history = events(db, input.observationId);
    if (history.length !== input.expectedRevision) throw new Error("This result was reviewed elsewhere. Reload it before saving your change.");
    if (input.action === "correct") validateCorrection(db, input.runId, row, input.value);
    const id = randomUUID();
    // Fractional seconds preserve the existing view's order even for rapid actions.
    const createdAt = Math.max(Date.now() / 1000, (history.at(-1)?.created_at ?? 0) + 0.001);
    const decision = input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "reopened";
    db.prepare(`INSERT INTO review_events (id, observation_id, decision, actor, note, schema_revision_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, input.observationId, decision, actor, input.note ?? null, row.schema_revision_id, createdAt);
    if (input.action === "correct") db.prepare("INSERT INTO review_corrections (event_id, value_json) VALUES (?, ?)").run(id, JSON.stringify(input.value));
    result = getValueReview(db, input.runId, input.observationId);
  }).immediate();
  return result!;
};
