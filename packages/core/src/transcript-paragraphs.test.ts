import { describe, expect, it } from "vitest";
import { cueAt, toParagraphs, type CueLike } from "./transcript-paragraphs.js";

/** Shaped like the auto-captions this exists for: ~2s, cut mid-clause. */
const captions = (texts: readonly string[], step = 2): CueLike[] =>
  texts.map((text, i) => ({ tStart: i * step, tEnd: i * step + step, text }));

describe("toParagraphs", () => {
  it("keeps every word, in order", () => {
    const cues = captions([
      "Apple made it faster and faster while",
      "leaving a few strange cracks behind.",
      "Slow base storage, weird monitor",
      "restrictions, and now local AI",
    ]);
    const text = toParagraphs(cues).map((p) => p.text).join(" ");
    for (const cue of cues) expect(text).toContain(cue.text);
  });

  it("joins fragments into something that reads as a sentence", () => {
    const [para] = toParagraphs(captions(["Apple made it faster and faster while", "leaving a few cracks behind."]));
    expect(para?.text).toBe("Apple made it faster and faster while leaving a few cracks behind.");
  });

  it("keeps the first cue's start, so a click still seeks where the words begin", () => {
    const [para] = toParagraphs(captions(["one", "two", "three"]));
    expect(para?.tStart).toBe(0);
    expect(para?.tEnd).toBe(6);
  });

  it("breaks on a silence, because a pause is a paragraph", () => {
    const paras = toParagraphs([
      { tStart: 0, tEnd: 2, text: "first thought" },
      { tStart: 10, tEnd: 12, text: "second thought" },
    ]);
    expect(paras).toHaveLength(2);
  });

  it("breaks when the speaker changes", () => {
    const paras = toParagraphs([
      { tStart: 0, tEnd: 2, text: "hello", speaker: "A" },
      { tStart: 2, tEnd: 4, text: "hi", speaker: "B" },
    ]);
    expect(paras).toHaveLength(2);
  });

  it("closes on length even when nothing is ever punctuated", () => {
    // Unpunctuated speech has no sentence edge to wait for, and waiting
    // forever is how one paragraph swallows a whole video.
    const paras = toParagraphs(captions(Array.from({ length: 60 }, () => "and then another thing happened")));
    expect(paras.length).toBeGreaterThan(1);
    for (const p of paras) expect(p.text.length).toBeLessThan(500);
  });

  it("closes on time even when the text stays short", () => {
    const paras = toParagraphs(Array.from({ length: 40 }, (_, i) => ({ tStart: i * 3, tEnd: i * 3 + 3, text: "yes" })));
    expect(paras.length).toBeGreaterThan(1);
  });

  it("returns nothing for nothing", () => {
    expect(toParagraphs([])).toEqual([]);
  });

  it("locates the cue being spoken, which is what gets highlighted", () => {
    const [para] = toParagraphs(captions(["one", "two", "three"]));
    expect(cueAt(para as never, 2.5)?.text).toBe("two");
    expect(cueAt(para as never, 99)).toBeNull();
  });
});
