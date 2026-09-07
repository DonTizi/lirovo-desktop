import { describe, expect, it } from "vitest";
import { knowledgeComparisonSchema } from "./ipc";

describe("knowledge comparison IPC", () => {
  it("preserves legacy requests and the explicit review filter", () => {
    const runIds = ["r1", "r2"];
    expect(knowledgeComparisonSchema.parse({ runIds })).toEqual({ runIds });
    expect(knowledgeComparisonSchema.parse({ runIds, approvedOnly: true })).toEqual({ runIds, approvedOnly: true });
    expect(knowledgeComparisonSchema.parse({ runIds, approvedOnly: false })).toEqual({ runIds, approvedOnly: false });
    expect(knowledgeComparisonSchema.safeParse({ runIds, approvedOnly: "true" }).success).toBe(false);
  });
});
