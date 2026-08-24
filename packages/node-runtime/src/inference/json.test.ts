import { describe, expect, it } from "vitest";
import { extractJson, looksTruncated } from "./json.js";

describe("extractJson", () => {
  it("reads a bare object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("unwraps a fenced block", () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```\nHope that helps.')).toEqual({ a: 1 });
  });

  it("ignores prose around the object", () => {
    expect(extractJson('Sure! {"a":1} done')).toEqual({ a: 1 });
  });

  it("does not close on a brace inside a string", () => {
    // The naive "find the last }" approach returns garbage here.
    expect(extractJson('{"note":"a } b","a":1}')).toEqual({ note: "a } b", a: 1 });
  });

  it("does not close on an escaped quote", () => {
    expect(extractJson('{"note":"say \\"hi\\" }","a":1}')).toEqual({ note: 'say "hi" }', a: 1 });
  });

  it("handles a top-level array", () => {
    expect(extractJson('[{"a":1},{"a":2}]')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("reports truncation distinctly from absence", () => {
    expect(() => extractJson('{"a":1')).toThrow(/truncated/);
    expect(() => extractJson("no json at all")).toThrow(/no JSON object/);
  });
});

describe("looksTruncated", () => {
  it("is true for an unterminated object and for empty output", () => {
    expect(looksTruncated('{"a":1')).toBe(true);
    expect(looksTruncated("   ")).toBe(true);
  });

  it("is false for a complete object", () => {
    expect(looksTruncated('{"a":1}')).toBe(false);
  });
});
