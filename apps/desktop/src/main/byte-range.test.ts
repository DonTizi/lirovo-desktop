import { describe, expect, it } from "vitest";
import { byteRange } from "./byte-range.js";

describe("single media byte ranges", () => {
  it.each([
    ["bytes=0-1023", { start: 0, end: 1023 }],
    ["bytes=4096-8191", { start: 4096, end: 8191 }],
    ["bytes=-512", { start: 8900, end: 9411 }],
    ["bytes=9000-99999", { start: 9000, end: 9411 }],
    ["bytes=9000-", { start: 9000, end: 9411 }],
    ["bytes=-99999", { start: 0, end: 9411 }],
  ])("normalizes %s to an inclusive range", (header, expected) => {
    expect(byteRange(header, 9412)).toEqual(expected);
  });
  it.each(["bytes=10000-", "bytes=8-4", "bytes=-0", "bytes=9007199254740992-"])(
    "rejects unsatisfiable %s",
    (header) => expect(byteRange(header, 9412)).toBe("unsatisfiable"),
  );
  it.each([null, "garbage", "bytes=-", "bytes=0-1,5-6"])(
    "ignores unsupported %s",
    (header) => {
      expect(byteRange(header, 9412)).toBeNull();
    },
  );
  it("rejects ranges on an empty file", () => {
    expect(byteRange("bytes=0-", 0)).toBe("unsatisfiable");
    expect(byteRange(null, 0)).toBeNull();
  });
});
