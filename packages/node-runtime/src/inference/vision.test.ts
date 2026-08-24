import { describe, expect, it } from "vitest";
import { DEFAULT_VISION_BATCH, parseJsonLines } from "./vision.js";

describe("parseJsonLines", () => {
  it("reads one object per line", () => {
    const { rows, skipped } = parseJsonLines('{"file":"000000.jpg"}\n{"file":"000001.jpg"}');
    expect(rows).toHaveLength(2);
    expect(skipped).toBe(0);
  });

  it("loses one frame to a malformed line, not the whole batch", () => {
    // Re-running a twenty-frame session over one fumbled comma is the
    // expensive way to be strict.
    const { rows, skipped } = parseJsonLines('{"file":"a.jpg"}\n{"file":"b.jpg",,}\n{"file":"c.jpg"}');
    expect(rows).toHaveLength(2);
    expect(skipped).toBe(1);
  });

  it("ignores prose and code fences around the lines", () => {
    const { rows } = parseJsonLines('Here you go:\n```json\n{"file":"a.jpg"}\n```\nDone.');
    expect(rows).toHaveLength(1);
  });

  it("returns nothing for empty output", () => {
    expect(parseJsonLines("   \n\n ")).toEqual({ rows: [], skipped: 0 });
  });
});

describe("batch size", () => {
  it("sits where the two cost curves cross", () => {
    // Fixed cost per session ~22s / 12.6k tokens argues for bigger batches;
    // every image staying in the conversation argues for smaller ones. Measured
    // per-frame totals: 3,430 at 6, 1,962 at 20, 2,180 at 40.
    expect(DEFAULT_VISION_BATCH).toBe(20);
  });
});
