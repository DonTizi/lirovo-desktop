import { describe, expect, it } from "vitest";
import { isStrictSchema } from "./strict-schema.js";
import { KG_JSON_SCHEMA } from "./schema.js";

describe("isStrictSchema", () => {
  const strictObject = {
    type: "object",
    additionalProperties: false,
    required: ["a"],
    properties: { a: { type: "string" } },
  };

  it("accepts a fully closed object", () => {
    expect(isStrictSchema(strictObject)).toBe(true);
  });

  it("rejects an object that allows extra properties", () => {
    expect(isStrictSchema({ type: "object", required: ["a"], properties: { a: { type: "string" } } })).toBe(false);
  });

  it("rejects an object with an optional property", () => {
    // Strict mode requires every property to be listed in `required`.
    expect(
      isStrictSchema({
        type: "object",
        additionalProperties: false,
        required: [],
        properties: { a: { type: "string" } },
      }),
    ).toBe(false);
  });

  it("looks inside arrays and nested objects", () => {
    expect(isStrictSchema({ type: "array", items: strictObject })).toBe(true);
    expect(isStrictSchema({ type: "array", items: { type: "object", properties: { a: {} } } })).toBe(false);
  });

  it("looks inside anyOf branches", () => {
    expect(isStrictSchema({ anyOf: [strictObject, { type: "object", properties: {} }] })).toBe(false);
  });

  it("treats a scalar schema as carryable", () => {
    expect(isStrictSchema({ type: "string" })).toBe(true);
  });

  it("says the knowledge graph schema cannot go through strict mode", () => {
    // Deliberately open: a model may describe a node with fields we did not
    // anticipate, and closing it would throw that away.
    expect(isStrictSchema(KG_JSON_SCHEMA)).toBe(false);
  });
});
