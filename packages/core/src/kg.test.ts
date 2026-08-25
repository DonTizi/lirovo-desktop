import { describe, expect, it } from "vitest";
import type { TranscriptSegment } from "@lirovo/contracts";
import { backfillNodeTimestamps, cleanKg, hasSpeech, mergeWindowKgs, planWindows, type Kg } from "./kg.js";
import { leafPaths } from "./extraction.js";

const seg = (id: string, tStart: number, tEnd: number, text: string): TranscriptSegment => ({
  id,
  speaker: null,
  tStart,
  tEnd,
  text,
  words: [],
});

const kg = (over: Partial<Kg> = {}): Kg => ({
  version: "1.0",
  duration_s: 100,
  nodes: [],
  edges: [],
  evidence: [],
  ...over,
});

describe("cleanKg", () => {
  it("drops an edge pointing at a node that does not exist", () => {
    const report = cleanKg(
      kg({
        nodes: [{ id: "n1", type: "claim" }],
        edges: [{ from: "n1", to: "n99", type: "said_by" }],
        evidence: [{ node_id: "n1", modality: "audio", source_ref: "asr#seg_1" }],
      }),
    );
    expect(report.kg.edges).toEqual([]);
    expect(report.droppedEdges).toBe(1);
  });

  it("drops a node with no evidence behind it", () => {
    // An assertion with nothing behind it is the one thing this must not ship.
    const report = cleanKg(kg({ nodes: [{ id: "n1", type: "claim" }] }));
    expect(report.kg.nodes).toEqual([]);
    expect(report.droppedNodes).toBe(1);
  });

  it("drops a citation that is not a seekable anchor", () => {
    const report = cleanKg(
      kg({
        nodes: [{ id: "n1", type: "claim" }],
        evidence: [
          { node_id: "n1", modality: "audio", source_ref: "around the middle" },
          { node_id: "n1", modality: "visual", source_ref: "frame#000042" },
        ],
      }),
    );
    expect(report.kg.evidence.map((e) => e.source_ref)).toEqual(["frame#000042"]);
  });

  it("removes edges whose endpoint was itself dropped for lacking evidence", () => {
    const report = cleanKg(
      kg({
        nodes: [{ id: "n1", type: "claim" }, { id: "n2", type: "speaker" }],
        edges: [{ from: "n1", to: "n2", type: "said_by" }],
        evidence: [{ node_id: "n1", modality: "audio", source_ref: "asr#seg_1" }],
      }),
    );
    expect(report.kg.nodes.map((n) => n.id)).toEqual(["n1"]);
    expect(report.kg.edges).toEqual([]);
  });
});

describe("backfillNodeTimestamps", () => {
  it("derives a window from the evidence when the model omitted one", () => {
    const out = backfillNodeTimestamps(
      kg({
        nodes: [{ id: "n1", type: "claim" }],
        evidence: [
          { node_id: "n1", modality: "audio", source_ref: "asr#seg_1", span: [10, 12] },
          { node_id: "n1", modality: "audio", source_ref: "asr#seg_2", span: [20, 25] },
        ],
      }),
    );
    expect(out.nodes[0]).toMatchObject({ t_start: 10, t_end: 25 });
  });

  it("leaves a timestamp the model did supply alone", () => {
    const out = backfillNodeTimestamps(
      kg({
        nodes: [{ id: "n1", type: "claim", t: 5 }],
        evidence: [{ node_id: "n1", modality: "audio", source_ref: "asr#seg_1", span: [10, 12] }],
      }),
    );
    expect(out.nodes[0]?.t).toBe(5);
    expect(out.nodes[0]?.t_start).toBeUndefined();
  });
});

describe("planWindows", () => {
  const many = Array.from({ length: 10 }, (_, i) => seg(`seg_${i}`, i * 10, i * 10 + 10, "x".repeat(100)));

  it("returns a single window when everything fits", () => {
    expect(planWindows(many, 1_000_000, 100)).toHaveLength(1);
  });

  it("splits rather than truncating", () => {
    // Truncating would silently discard the end of every long recording.
    const windows = planWindows(many, 400, 100);
    expect(windows.length).toBeGreaterThan(1);
    const covered = new Set(windows.flatMap((w) => w.segments.map((s) => s.id)));
    expect(covered.size).toBe(many.length);
  });

  it("overlaps by one segment so a claim on the seam is whole somewhere", () => {
    const windows = planWindows(many, 400, 100);
    const first = windows[0];
    const second = windows[1];
    expect(second?.segments[0]?.id).toBe(first?.segments.at(-1)?.id);
  });

  it("never splits a segment", () => {
    const windows = planWindows([seg("seg_0", 0, 5, "y".repeat(10_000))], 100, 5);
    expect(windows).toHaveLength(1);
    expect(windows[0]?.segments[0]?.text).toHaveLength(10_000);
  });

  it("returns nothing for an empty transcript", () => {
    expect(planWindows([], 100, 0)).toEqual([]);
  });
});

describe("mergeWindowKgs", () => {
  const window = (index: number) => ({ index, tStart: 0, tEnd: 10, segments: [] });

  it("keeps each window's n1 apart", () => {
    // Every window independently names its first node n1. Without prefixing,
    // window 2's speaker would absorb window 1's edges silently.
    const merged = mergeWindowKgs(
      [
        {
          window: window(0),
          kg: kg({
            nodes: [{ id: "n1", type: "claim" }],
            evidence: [{ node_id: "n1", modality: "audio", source_ref: "asr#seg_1" }],
          }),
        },
        {
          window: window(1),
          kg: kg({
            nodes: [{ id: "n1", type: "speaker" }],
            evidence: [{ node_id: "n1", modality: "audio", source_ref: "asr#seg_9" }],
          }),
        },
      ],
      100,
    );
    expect(merged.nodes.map((n) => n.id)).toEqual(["w0_n1", "w1_n1"]);
    expect(merged.evidence.map((e) => e.node_id)).toEqual(["w0_n1", "w1_n1"]);
  });

  it("rewrites edges into the same namespace as the nodes", () => {
    const merged = mergeWindowKgs(
      [
        {
          window: window(0),
          kg: kg({ nodes: [{ id: "n1", type: "claim" }], edges: [{ from: "n1", to: "n2", type: "said_by" }] }),
        },
      ],
      100,
    );
    expect(merged.edges[0]).toEqual({ from: "w0_n1", to: "w0_n2", type: "said_by" });
  });

  it("carries the real duration, not a window's", () => {
    expect(mergeWindowKgs([{ window: window(0), kg: kg({ duration_s: 10 }) }], 7200).duration_s).toBe(7200);
  });
});

describe("leafPaths", () => {
  it("names every leaf the way a citation does", () => {
    expect(
      leafPaths({ title: "x", decisions: ["a", "b"], people: [{ name: "Ana" }] }).sort(),
    ).toEqual(["decisions[0]", "decisions[1]", "people[0].name", "title"]);
  });

  it("treats an empty array as having no leaves", () => {
    expect(leafPaths({ decisions: [] })).toEqual([]);
  });

  it("counts null as a leaf, because a null still needs grounding", () => {
    expect(leafPaths({ owner: null })).toEqual(["owner"]);
  });
});

describe("hasSpeech", () => {
  const seg = (text: string): TranscriptSegment => ({
    id: "seg_0",
    speaker: null,
    tStart: 0,
    tEnd: 1,
    text,
    words: [],
  });

  it("rejects the labels whisper emits for non-speech", () => {
    // A ten-second music bed transcribes to exactly this, and it is seven
    // characters of nothing anyone said.
    expect(hasSpeech([seg("[Music]")])).toBe(false);
    expect(hasSpeech([seg("[BLANK_AUDIO]")])).toBe(false);
    expect(hasSpeech([seg("(wind blowing)")])).toBe(false);
    expect(hasSpeech([seg("  [Music]  ")])).toBe(false);
  });

  it("accepts real speech, including next to a label", () => {
    expect(hasSpeech([seg("so here we are")])).toBe(true);
    expect(hasSpeech([seg("[Music] welcome back")])).toBe(true);
  });

  it("rejects punctuation with no words", () => {
    expect(hasSpeech([seg("... ---")])).toBe(false);
  });

  it("rejects an empty transcript", () => {
    expect(hasSpeech([])).toBe(false);
  });

  it("accepts non-Latin speech", () => {
    expect(hasSpeech([seg("伊東駅に着きました")])).toBe(true);
  });
});
