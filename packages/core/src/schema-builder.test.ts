import { describe, expect, it } from "vitest";
import {
  SCHEMA_PRESETS,
  compileSchema,
  decompileSchema,
  toPropertyName,
  type FieldSpec,
} from "./schema-builder.js";

describe("toPropertyName", () => {
  it("turns what a person types into something a schema can key on", () => {
    expect(toPropertyName("Action items")).toBe("action_items");
    expect(toPropertyName("  Key claims!  ")).toBe("key_claims");
  });

  it("keeps non-Latin words rather than erasing them", () => {
    expect(toPropertyName("決定事項")).toBe("決定事項");
  });

  it("returns empty for a name with nothing in it", () => {
    expect(toPropertyName("  ---  ")).toBe("");
  });
});

describe("compileSchema", () => {
  const fields: FieldSpec[] = [
    { name: "Title", kind: "text" },
    { name: "Topics", kind: "list" },
  ];

  it("produces a schema the strict fast path can carry", () => {
    // Strict structured output rejects anything that leaves a property optional
    // or an object open, so a schema built here has to satisfy both.
    const schema = compileSchema(fields) as Record<string, unknown>;
    expect(schema["additionalProperties"]).toBe(false);
    expect(schema["required"]).toEqual(["title", "topics"]);
  });

  it("maps each kind to its shape", () => {
    const schema = compileSchema([
      { name: "a", kind: "text" },
      { name: "b", kind: "list" },
      { name: "c", kind: "number" },
    ]) as { properties: Record<string, unknown> };
    expect(schema.properties["a"]).toEqual({ type: "string" });
    expect(schema.properties["b"]).toEqual({ type: "array", items: { type: "string" } });
    expect(schema.properties["c"]).toEqual({ type: "number" });
  });

  it("drops a nameless row instead of emitting an empty key", () => {
    const schema = compileSchema([{ name: "  ", kind: "text" }, ...fields]) as { required: string[] };
    expect(schema.required).toEqual(["title", "topics"]);
  });

  it("keeps the first of two rows that name the same thing", () => {
    const schema = compileSchema([
      { name: "Topics", kind: "list" },
      { name: "topics", kind: "text" },
    ]) as { required: string[]; properties: Record<string, unknown> };
    expect(schema.required).toEqual(["topics"]);
    expect(schema.properties["topics"]).toEqual({ type: "array", items: { type: "string" } });
  });
});

describe("decompileSchema", () => {
  it("round-trips what the builder produced", () => {
    const fields: FieldSpec[] = [
      { name: "title", kind: "text" },
      { name: "topics", kind: "list" },
      { name: "count", kind: "number" },
    ];
    expect(decompileSchema(compileSchema(fields))).toEqual(fields);
  });

  it("refuses a schema it cannot represent, rather than guessing", () => {
    // Guessing would silently discard the nesting the next time it recompiled.
    expect(decompileSchema({ type: "object", properties: { a: { type: "object" } } })).toBeNull();
    expect(
      decompileSchema({ type: "object", properties: { a: { type: "array", items: { type: "object" } } } }),
    ).toBeNull();
    expect(decompileSchema({ type: "array" })).toBeNull();
    expect(decompileSchema(null)).toBeNull();
  });
});

describe("presets", () => {
  it("every preset compiles to a strict-valid schema", () => {
    for (const preset of SCHEMA_PRESETS) {
      const schema = compileSchema(preset.fields) as { required: string[]; additionalProperties: boolean };
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required.length).toBe(preset.fields.length);
    }
  });

  it("stays short enough to read without scanning", () => {
    expect(SCHEMA_PRESETS.length).toBeLessThanOrEqual(4);
  });
});
