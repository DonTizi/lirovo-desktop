import { describe, expect, it } from "vitest";
import { chainHash, noLedger } from "./ledger.js";

// A stand-in hash: order-sensitive and distinct enough for the property under
// test, which is about what goes IN, not about cryptography.
const fakeSha = (s: string): string => `h(${s.replace(/ /g, "|")})`;

describe("chainHash", () => {
  it("changes when an upstream stage produced something different", () => {
    const a = chainHash(fakeSha, "source-A", "normalize", { hasVideo: true });
    const b = chainHash(fakeSha, "source-B", "normalize", { hasVideo: true });
    expect(a).not.toBe(b);
  });

  it("changes when the stage's own parameters change", () => {
    const a = chainHash(fakeSha, "x", "scene-detect", { threshold: 0.3 });
    const b = chainHash(fakeSha, "x", "scene-detect", { threshold: 0.4 });
    expect(a).not.toBe(b);
  });

  it("is stable for identical inputs, which is what makes resume possible", () => {
    expect(chainHash(fakeSha, "x", "dedup", { hamming: 5 })).toBe(chainHash(fakeSha, "x", "dedup", { hamming: 5 }));
  });

  it("keeps two stages apart even with the same params and predecessor", () => {
    expect(chainHash(fakeSha, "x", "asr", null)).not.toBe(chainHash(fakeSha, "x", "vision", null));
  });

  it("cannot be confused by a value that spells out the separator", () => {
    // Without a separator, the pair ("ab", "c") and ("a", "bc") would collide.
    expect(chainHash(fakeSha, "ab", "asr", "c")).not.toBe(chainHash(fakeSha, "a", "asr", "bc"));
  });
});

describe("noLedger", () => {
  it("never claims a cached result", () => {
    expect(noLedger.cached("asr", "anything")).toBeNull();
  });
});
