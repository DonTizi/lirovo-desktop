import { describe, expect, it } from "vitest";
import {
  SCHEMA_PRESETS,
  compileSchema,
  decompileSchema,
  fieldsFingerprint,
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

describe("descriptions", () => {
  it("rides along in the schema, where the model reads it", () => {
    // The model reads the schema. It does not read the app, so a description
    // kept only in the UI would never reach it.
    const schema = compileSchema([
      { name: "risks", kind: "list", description: "things someone said could go wrong, not things that already did" },
    ]) as { properties: Record<string, Record<string, unknown>> };
    expect(schema.properties["risks"]?.["description"]).toContain("could go wrong");
    expect(schema.properties["risks"]?.["type"]).toBe("array");
  });

  it("omits an empty description rather than emitting a blank one", () => {
    const schema = compileSchema([{ name: "a", kind: "text", description: "   " }]) as {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(schema.properties["a"]).toEqual({ type: "string" });
  });

  it("survives a round trip", () => {
    const fields: FieldSpec[] = [{ name: "topics", kind: "list", description: "in the order addressed" }];
    expect(decompileSchema(compileSchema(fields))).toEqual(fields);
  });
});

describe("fieldsFingerprint", () => {
  const base: FieldSpec[] = [{ name: "title", kind: "text", description: "one line" }];

  it("is stable when nothing meaningful changed", () => {
    expect(fieldsFingerprint(base)).toBe(fieldsFingerprint([{ ...base[0]!, description: "one line" }]));
  });

  it("moves when a description is reworded", () => {
    // Rewording changes what the model is asked for, so it has to be a new
    // version — otherwise two runs would claim the same contract having been
    // asked different questions.
    expect(fieldsFingerprint(base)).not.toBe(fieldsFingerprint([{ ...base[0]!, description: "two lines" }]));
  });

  it("moves when a field is renamed or retyped", () => {
    expect(fieldsFingerprint(base)).not.toBe(fieldsFingerprint([{ ...base[0]!, name: "headline" }]));
    expect(fieldsFingerprint(base)).not.toBe(fieldsFingerprint([{ ...base[0]!, kind: "list" }]));
  });

  it("moves when the order changes, because the prompt renders them in order", () => {
    const a: FieldSpec[] = [{ name: "a", kind: "text" }, { name: "b", kind: "text" }];
    const b: FieldSpec[] = [{ name: "b", kind: "text" }, { name: "a", kind: "text" }];
    expect(fieldsFingerprint(a)).not.toBe(fieldsFingerprint(b));
  });

  it("cannot be fooled by a name that contains the separator", () => {
    const a: FieldSpec[] = [{ name: "a:text:x", kind: "text" }];
    const b: FieldSpec[] = [{ name: "a", kind: "text", description: "x" }];
    expect(fieldsFingerprint(a)).not.toBe(fieldsFingerprint(b));
  });
});
