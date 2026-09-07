import { describe, expect, it } from "vitest";
import type { ValueRow } from "../../../bridge/contract.js";
import {
  displayValue,
  fieldGroup,
  fieldLabel,
  groupValues,
} from "./value-groups";

const row = (fieldPath: string): ValueRow => ({
  observationId: fieldPath,
  fieldPath,
  value: "Complete value, including the end.",
  reviewPriority: 1,
  evidence: [
    {
      sourceRef: "segment-1",
      modality: "audio",
      tStart: 8.4,
      tEnd: 12.8,
      quote: "Complete source quote.",
    },
  ],
});

describe("result reading groups", () => {
  it("decodes stored JSON strings without losing quotes or line breaks", () => {
    const text = 'First line\nA "quoted" sentence';
    expect(displayValue(JSON.stringify(text))).toBe(text);
    expect(displayValue("plain legacy text")).toBe("plain legacy text");
    expect(displayValue('{"name":"Ada"}')).toBe('{"name":"Ada"}');
    expect(displayValue("null")).toBe("null");
  });
  it("places the title first and sorts numeric field indices naturally", () => {
    const result = groupValues([
      row("key_claims[10]"),
      row("topics[2]"),
      row("title"),
      row("key_claims[2]"),
    ]);
    expect(result.map((g) => g.key)).toEqual(["title", "key_claims", "topics"]);
    expect(result[1]?.rows.map((r) => r.fieldPath)).toEqual([
      "key_claims[2]",
      "key_claims[10]",
    ]);
  });

  it("preserves every object and all evidence without mutating input order", () => {
    const input = [row("topics[10]"), row("title"), row("topics[0]")];
    const before = JSON.stringify(input);
    const output = groupValues(input).flatMap((g) => g.rows);
    expect(JSON.stringify(input)).toBe(before);
    expect(output).toHaveLength(input.length);
    for (const original of input)
      expect(
        output.find((r) => r.observationId === original.observationId),
      ).toBe(original);
  });

  it("supports empty and unbacked results", () => {
    expect(groupValues([])).toEqual([]);
    const unbacked = { ...row("custom_field"), evidence: [] };
    expect(groupValues([unbacked])[0]?.rows).toEqual([unbacked]);
  });

  it("humanizes custom fields without merging distinct nested properties", () => {
    expect(fieldLabel("key_claims[2]")).toBe("Key claims");
    expect(fieldLabel("fullName")).toBe("Full Name");
    expect(fieldGroup("people[0].name")).toBe("people.name");
    expect(
      groupValues([row("people[0].name"), row("people[0].role")]),
    ).toHaveLength(2);
  });
});
