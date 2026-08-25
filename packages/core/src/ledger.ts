import type { Stage } from "@lirovo/contracts";

/**
 * The record of what each stage did, and the only thing resume trusts.
 *
 * Kept as a port rather than a database handle so the pipeline stays free of
 * SQLite, and so a test can drive a resume with a Map.
 */
export interface StageLedger {
  /** The output of the last attempt that succeeded on THIS input, if any. */
  cached(stage: Stage, inputHash: string): unknown | null;
  begin(stage: Stage, inputHash: string): number;
  complete(
    stage: Stage,
    attempt: number,
    outcome: { status: "done" | "failed" | "degraded"; output?: unknown; code?: string; message?: string },
  ): void;
}

/** A ledger that remembers nothing. Every stage runs. */
export const noLedger: StageLedger = {
  cached: () => null,
  begin: () => 1,
  complete: () => {},
};

/**
 * Chain each stage's input hash to the one before it.
 *
 * A stage may only be skipped when everything upstream of it produced the same
 * result AND its own parameters are unchanged. Hashing the inputs in isolation
 * would happily reuse a set of frames detected from a different video, because
 * "detector=scene, threshold=0.3" is identical either way. The chain is what
 * makes "is this cache entry about my run" a hash comparison rather than a
 * judgement call.
 */
export const chainHash = (
  sha256: (input: string) => string,
  previous: string,
  stage: Stage,
  params: unknown,
): string => sha256(`${previous} ${stage} ${JSON.stringify(params ?? null)}`);
