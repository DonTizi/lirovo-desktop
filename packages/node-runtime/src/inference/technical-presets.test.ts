import { describe, expect, it } from "vitest";
import { compileSchema, SCHEMA_PRESETS } from "@lirovo/core";
import { isStrictSchema } from "./strict-schema.js";
import { validateAgainst } from "./schema.js";

describe("technical research preset schema contracts", () => {
  for (const id of ["technical-talk", "benchmark-comparison"]) {
    it(`${id} accepts complete source observations without normalizing metric strings`, () => {
      const preset = SCHEMA_PRESETS.find((entry) => entry.id === id)!;
      const schema = compileSchema(preset.fields);
      const data = {
        title: "Scratch local evaluation",
        ...(id === "technical-talk" ? { topics: ["Latency under load"] } : { systems: ["Example v2 · 8 GB"] }),
        key_claims: ["Presenter A claims this setup reduces median latency; not independently verified."],
        metrics: ["Example v2; local fixture; -2.5 ms difference; units and setup as stated; sample size not stated."],
        limitations: ["Presenter A states only one workload was measured."],
        source_context: ["Presenter A; exact source-time references supplied separately as evidence."],
      };
      expect(isStrictSchema(schema)).toBe(true);
      expect(validateAgainst(schema, data)).toEqual([]);
      expect(validateAgainst(schema, { ...data, metrics: [{ score: -2.5 }] }).length).toBeGreaterThan(0);
      expect(validateAgainst(schema, { ...data, invented_property: "extra" }).length).toBeGreaterThan(0);
      expect(validateAgainst(schema, {}).length).toBe(6);
    });
    it(`${id} allows explicit absent lists without encouraging fabricated defaults`, () => {
      const schema = compileSchema(SCHEMA_PRESETS.find((entry) => entry.id === id)!.fields);
      const empty = { title: "", ...(id === "technical-talk" ? { topics: [] } : { systems: [] }), key_claims: [], metrics: [], limitations: [], source_context: [] };
      expect(validateAgainst(schema, empty)).toEqual([]);
    });
  }
});
