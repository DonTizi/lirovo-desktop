import type { InferenceBackend } from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";
import type { Db, PersistInput, PersistResult } from "@lirovo/node-runtime";
import { hydrateStoredReason, persistExtraction } from "@lirovo/node-runtime";

/** A user-selected provider is a boundary, not a preference to silently replace. */
export async function requireChosenBackend(backends: readonly InferenceBackend[], chosen: string | null): Promise<InferenceBackend> {
  if (chosen === null) throw new LirovoError("NO_INFERENCE_BACKEND", "Choose a backend in Settings before extracting fields.");
  const backend = backends.find((item) => item.id === chosen);
  const reachable = backend !== undefined && (await backend.detect().catch(() => ({ available: false }))).available;
  if (!reachable) throw new LirovoError("NO_INFERENCE_BACKEND", `The selected backend ${chosen} is unavailable. Start it and resume; no other provider was contacted.`);
  return backend;
}

export function committedExtraction(db: Db, runId: string): PersistResult | null {
  const row = db.prepare<[string, string], PersistResult>(
    `SELECT COUNT(*) AS 'values', COUNT(CASE WHEN EXISTS
      (SELECT 1 FROM value_evidence e WHERE e.observation_id = v.observation_id) THEN 1 END) AS grounded,
      (SELECT COUNT(*) FROM evidence WHERE run_id = ?) AS evidenceRows
      FROM extracted_values v WHERE run_id = ?`,
  ).get(runId, runId);
  return row !== undefined && row.values > 0 ? row : null;
}

/** The writer is atomic. Never replace its original observation identities on retry. */
export function persistRecoveredExtraction(db: Db, input: PersistInput): PersistResult {
  return committedExtraction(db, input.runId) ?? persistExtraction(db, input);
}

/** Recover the final reasoning commit even when the schema produced zero leaves. */
export function recoverFinishedReason(db: Db, runId: string, owner?: string): PersistResult | null {
  const committed = committedExtraction(db, runId);
  if (committed !== null) return committed;
  const row = db.prepare<[string], { output_json: string | null }>(
    "SELECT output_json FROM run_stage_attempts WHERE run_id = ? AND stage = 'reason' AND status = 'done' ORDER BY attempt DESC LIMIT 1",
  ).get(runId);
  if (!row?.output_json) return null;
  const result = hydrateStoredReason(JSON.parse(row.output_json));
  if (result === null || !Object.prototype.hasOwnProperty.call(result, "data")) return null;
  return persistRecoveredExtraction(db, { runId, ...(owner === undefined ? {} : { owner }), data: result.data, evidenceByField: result.evidenceByField });
}
