import { describe, expect, it } from "vitest";
import { DETERMINISTIC_STAGES, STAGES, mergeStagePointer, stageIndex } from "./stages.js";
import { pipelineEventSchema } from "./events.js";
import { encodeBase32, isId, makeId } from "./ids.js";

describe("stage pointer", () => {
  it("never moves backwards when asr and vision interleave", () => {
    // The real interleave: vision reports after asr has already been reported.
    let p = mergeStagePointer(null, "asr");
    p = mergeStagePointer(p, "vision");
    p = mergeStagePointer(p, "asr");
    expect(p).toBe("vision");
  });

  it("advances on a later stage", () => {
    expect(mergeStagePointer("dedup", "graph")).toBe("graph");
  });

  it("orders every stage uniquely", () => {
    const seen = new Set(STAGES.map(stageIndex));
    expect(seen.size).toBe(STAGES.length);
  });

  it("marks only the pre-model stages deterministic", () => {
    expect([...DETERMINISTIC_STAGES].every((s) => stageIndex(s) < stageIndex("asr"))).toBe(true);
  });
});

describe("events", () => {
  it("parses a progress event", () => {
    const parsed = pipelineEventSchema.parse({
      type: "stage:progress",
      runId: "run_abc",
      stage: "vision",
      done: 3,
      total: 14,
    });
    expect(parsed.type).toBe("stage:progress");
  });

  it("rejects an unknown stage", () => {
    expect(() =>
      pipelineEventSchema.parse({ type: "stage:start", runId: "run_abc", stage: "nope", attempt: 1 }),
    ).toThrow();
  });
});

describe("ids", () => {
  it("round-trips a prefix", () => {
    const id = makeId("run", new Uint8Array([1, 2, 3, 4, 5]));
    expect(isId("run", id)).toBe(true);
    expect(isId("source", id)).toBe(false);
  });

  it("encodes base32 without padding", () => {
    expect(encodeBase32(new Uint8Array([0, 0, 0, 0, 0]))).toBe("00000000");
  });
});
