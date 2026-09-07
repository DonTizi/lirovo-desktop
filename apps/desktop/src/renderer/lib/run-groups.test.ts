import { expect, it } from "vitest";
import { groupRuns } from "./run-groups";
import type { RunSummary } from "../../bridge/contract";
const row = (
  runId: string,
  schemaName: string | null,
  createdAt: number,
  schemaKey?: string,
): RunSummary => ({
  runId,
  schemaName,
  createdAt,
  ...(schemaKey ? { schemaKey } : {}),
  status: "succeeded",
  title: runId,
  valueCount: 0,
  groundedCount: 0,
  durationS: null,
  sourceType: null,
  frameCount: null,
});
it("groups newest first, unknown last, without modifying rows", () => {
  const input = [
    row("old", "Meeting", 1),
    row("unknown", null, 10),
    row("new", "Meeting", 3),
    row("demo", "Demo", 2),
  ];
  const groups = groupRuns(input);
  expect(groups.map((group) => group.name)).toEqual([
    "Meeting",
    "Demo",
    "Uncategorized",
  ]);
  expect(groups[0]!.runs.map((run) => run.runId)).toEqual(["new", "old"]);
  expect(groups[0]!.runs[1]).toBe(input[0]);
  expect(input.map((run) => run.runId)).toEqual([
    "old",
    "unknown",
    "new",
    "demo",
  ]);
});
it("retains every status, distinct schema IDs and labels matching the fallback", () => {
  const input = [
    row("a", "Same", 1, "saved:1"),
    { ...row("b", "Same", 2, "saved:2"), status: "running" },
    { ...row("c", "Uncategorized", 3), status: "failed" },
    row("d", null, 4),
  ];
  expect(groupRuns(input)).toHaveLength(4);
  expect(groupRuns(input).flatMap((g) => g.runs)).toHaveLength(4);
  expect(groupRuns([])).toEqual([]);
});
