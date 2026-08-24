import { describe, expect, it } from "vitest";
import type { Kg } from "@lirovo/core";
import { renderKgForPrompt, resolveCitations } from "./pass-b.js";
import { validateAgainst, passBSchema, KG_JSON_SCHEMA } from "./schema.js";

const kg: Kg = {
  version: "1.0",
  duration_s: 100,
  nodes: [
    { id: "n2", type: "claim", text: "we ship on the fourth" },
    { id: "n1", type: "speaker", label: "Ana" },
  ],
  edges: [{ from: "n2", to: "n1", type: "said_by" }],
  evidence: [
    { node_id: "n2", modality: "audio", source_ref: "asr#seg_4", span: [12, 15] },
    { node_id: "n1", modality: "audio", source_ref: "asr#seg_1", span: [0, 3] },
  ],
};

describe("renderKgForPrompt", () => {
  it("is byte-stable for the same graph in a different order", () => {
    // Reproducibility from a manifest depends on this: the same graph has to
    // produce the same prompt, or a replay is a different run wearing the
    // same label.
    const shuffled: Kg = { ...kg, nodes: [...kg.nodes].reverse(), edges: [...kg.edges] };
    expect(renderKgForPrompt(shuffled)).toBe(renderKgForPrompt(kg));
  });

  it("lists every node id the model is allowed to cite", () => {
    const text = renderKgForPrompt(kg);
    expect(text).toContain("id=n1");
    expect(text).toContain("id=n2");
    expect(text).toContain("n2 --said_by--> n1");
  });
});

describe("resolveCitations", () => {
  it("turns a node citation into a seekable span", () => {
    const out = resolveCitations([{ field_path: "decisions[0]", node_id: "n2" }], kg);
    expect(out.get("decisions[0]")).toEqual([
      { modality: "audio", sourceRef: "asr#seg_4", tStart: 12, tEnd: 15, quote: "we ship on the fourth", nodeKey: "n2" },
    ]);
  });

  it("drops a hallucinated node id instead of inventing a span", () => {
    // Keeping it would produce a value the UI shows as grounded that jumps
    // nowhere the first time someone clicks it.
    expect(resolveCitations([{ field_path: "title", node_id: "n99" }], kg).size).toBe(0);
  });

  it("collects every evidence row of a cited node under one field", () => {
    const multi: Kg = {
      ...kg,
      evidence: [...kg.evidence, { node_id: "n2", modality: "visual", source_ref: "frame#000007", span: [13, 13] }],
    };
    expect(resolveCitations([{ field_path: "d[0]", node_id: "n2" }], multi).get("d[0]")).toHaveLength(2);
  });

  it("falls back to the node's own timestamp when the evidence has no span", () => {
    const noSpan: Kg = {
      ...kg,
      nodes: [{ id: "n2", type: "claim", text: "x", t_start: 40, t_end: 44 }],
      evidence: [{ node_id: "n2", modality: "audio", source_ref: "asr#seg_9" }],
    };
    expect(resolveCitations([{ field_path: "a", node_id: "n2" }], noSpan).get("a")?.[0]).toMatchObject({
      tStart: 40,
      tEnd: 44,
    });
  });

  it("ignores a citation with an empty field path", () => {
    expect(resolveCitations([{ field_path: "   ", node_id: "n2" }], kg).size).toBe(0);
  });
});

describe("schemas", () => {
  it("accepts a well-formed graph and rejects one with an unanchored node id", () => {
    expect(validateAgainst(KG_JSON_SCHEMA, { version: "1.0", duration_s: 1, nodes: [], edges: [], evidence: [] })).toEqual([]);
    const bad = validateAgainst(KG_JSON_SCHEMA, {
      version: "1.0",
      duration_s: 1,
      nodes: [{ id: "not a valid id", type: "claim" }],
      edges: [],
      evidence: [],
    });
    expect(bad.length).toBeGreaterThan(0);
  });

  it("wraps the caller's schema so both halves are validated at once", () => {
    const envelope = passBSchema({ type: "object", required: ["title"], properties: { title: { type: "string" } } });
    expect(validateAgainst(envelope, { data: { title: "x" }, evidence: [] })).toEqual([]);
    // A missing required property inside `data` has to fail the envelope too.
    expect(validateAgainst(envelope, { data: {}, evidence: [] }).length).toBeGreaterThan(0);
  });

  it("reports the location of the error, so the repair turn can act on it", () => {
    const envelope = passBSchema({ type: "object", properties: { n: { type: "number" } } });
    const errors = validateAgainst(envelope, { data: { n: "not a number" }, evidence: [] });
    expect(errors[0]).toContain("/data/n");
  });
});

describe("validation errors are written for a model to act on", () => {
  it("drops the ancestor wrappers and keeps the leaf", () => {
    const envelope = passBSchema({ type: "object", properties: { n: { type: "number" } } });
    const errors = validateAgainst(envelope, { data: { n: "not a number" }, evidence: [] });
    // Not: 'Property "data" does not match schema.'
    expect(errors).toEqual(['at /data/n: Instance type "string" is invalid. Expected "number".']);
  });

  it("keeps every independent failure", () => {
    const envelope = passBSchema({
      type: "object",
      properties: { a: { type: "number" }, b: { type: "string" } },
    });
    const errors = validateAgainst(envelope, { data: { a: "x", b: 1 }, evidence: [] });
    expect(errors).toHaveLength(2);
    expect(errors.join(" ")).toContain("/data/a");
    expect(errors.join(" ")).toContain("/data/b");
  });
});
