import type { EvidenceDraft, Stage } from "@lirovo/contracts";
import type { StageLedger } from "@lirovo/core";
import type { RunStore } from "./runs.js";

export function hydrateStoredReason(output: unknown): (Record<string, unknown> & { evidenceByField: Map<string, EvidenceDraft[]> }) | null {
  if (output === null || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  const entries = record.evidenceByField;
  // Older JSON.stringify(Map) output lost citations as {}. It must rerun.
  if (!Array.isArray(entries) || !entries.every((entry) => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" && Array.isArray(entry[1]))) return null;
  return { ...record, evidenceByField: new Map(entries as [string, EvidenceDraft[]][]) };
}

/**
 * The stage ledger, backed by the run store.
 *
 * A thin binding rather than a second implementation: the store already knows
 * how to number attempts and how to answer "did this exact input already
 * succeed", and having two places that decide what resume means is how the two
 * start disagreeing.
 */
export const createStageLedger = (runs: RunStore, runId: string): StageLedger => ({
  cached: (stage: Stage, inputHash: string) => {
    const output = runs.cachedStageOutput(runId, stage, inputHash);
    if (stage !== "reason" || output === null) return output;
    return hydrateStoredReason(output);
  },
  begin: (stage: Stage, inputHash: string) => {
    runs.setStagePointer(runId, stage);
    return runs.beginAttempt(runId, stage, inputHash);
  },
  complete: (stage, attempt, outcome) => {
    const output = outcome.output;
    const record = output !== null && typeof output === "object" ? output as Record<string, unknown> : null;
    if (stage === "reason" && record?.evidenceByField instanceof Map) {
      runs.completeAttempt(runId, stage, attempt, { ...outcome, output: { ...record, evidenceByField: [...record.evidenceByField] } });
    } else runs.completeAttempt(runId, stage, attempt, outcome);
  },
});
