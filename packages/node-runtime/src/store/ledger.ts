import type { Stage } from "@lirovo/contracts";
import type { StageLedger } from "@lirovo/core";
import type { RunStore } from "./runs.js";

/**
 * The stage ledger, backed by the run store.
 *
 * A thin binding rather than a second implementation: the store already knows
 * how to number attempts and how to answer "did this exact input already
 * succeed", and having two places that decide what resume means is how the two
 * start disagreeing.
 */
export const createStageLedger = (runs: RunStore, runId: string): StageLedger => ({
  cached: (stage: Stage, inputHash: string) => runs.cachedStageOutput(runId, stage, inputHash),
  begin: (stage: Stage, inputHash: string) => {
    runs.setStagePointer(runId, stage);
    return runs.beginAttempt(runId, stage, inputHash);
  },
  complete: (stage, attempt, outcome) => runs.completeAttempt(runId, stage, attempt, outcome),
});
