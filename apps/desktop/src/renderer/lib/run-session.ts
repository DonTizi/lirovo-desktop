import type { RunDetail } from "../../bridge/contract";

/** run:start precedes ingest and therefore precedes the persisted source/run row. */
export function pendingRun(runId: string, source: string): RunDetail {
  return {
    runId,
    status: "running",
    title: source || "New extraction",
    sourcePath: source,
    durationS: null,
    transcriptEngine: null,
    errorCode: null,
    errorMessage: null,
    stages: [],
    values: [],
  };
}
