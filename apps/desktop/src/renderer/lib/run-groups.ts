import type { RunSummary } from "../../bridge/contract";

export const runGroupKey = (run: RunSummary): string =>
  run.schemaKey ?? (run.schemaName ? `name:${run.schemaName}` : "unknown");

/** Display-only grouping. Original rows and the caller's array remain untouched. */
export function groupRuns(runs: readonly RunSummary[]) {
  const groups = new Map<
    string,
    { key: string; name: string; runs: RunSummary[] }
  >();
  for (const run of [...runs].sort(
    (a, b) => b.createdAt - a.createdAt || a.runId.localeCompare(b.runId),
  )) {
    const key = runGroupKey(run);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: run.schemaName?.trim() || "Uncategorized",
        runs: [],
      };
      groups.set(key, group);
    }
    group.runs.push(run);
  }
  return [...groups.values()].sort(
    (a, b) => Number(a.key === "unknown") - Number(b.key === "unknown"),
  );
}
