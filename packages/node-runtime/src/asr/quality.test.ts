import { describe, expect, it } from "vitest";
import type { Transcript } from "@lirovo/contracts";
import { transcriptQualityIssues, assertTranscriptQuality } from "./quality.js";

const transcript = (texts: readonly string[]): Transcript => ({
  engine: "fixture", model: null, language: "en", durationS: texts.length * 3,
  text: texts.join(" "),
  segments: texts.map((text, i) => ({ id: `seg_${i}`, tStart: i * 3, tEnd: (i + 1) * 3, text, speaker: null, words: [] })),
});

describe("transcription anomaly gate", () => {
  it("accepts the complete sentences observed in the real local English probe", () => {
    expect(transcriptQualityIssues(transcript([
      "Today we compare three language models.", "The first model is fast.",
      "The second model costs less.", "Always check the original source before making a decision.",
    ]))).toEqual([]);
  });
  it("rejects absent speech instead of calling it a trusted transcript", () => {
    expect(() => assertTranscriptQuality(transcript([]))).toThrow("No timestamped speech");
  });
  it.each([NaN, Infinity, -1, 0])("rejects invalid duration %s", (durationS) => {
    expect(transcriptQualityIssues({ ...transcript(["Bonjour le monde."]), durationS }).length).toBeGreaterThan(0);
  });
  it.each([{ tStart: -1, tEnd: 1 }, { tStart: 2, tEnd: 1 }, { tStart: NaN, tEnd: 1 }, { tStart: 0, tEnd: 9 }])("rejects malformed offsets %j", (times) => {
    const t = transcript(["Bonjour le monde."]);
    expect(() => assertTranscriptQuality({ ...t, segments: t.segments.map((s) => ({ ...s, ...times })) })).toThrow("timestamps");
  });
  it("rejects decoding loops both within and across segments without modifying text", () => {
    const phrase = "It was the first time I had to do it.";
    const repeated = transcript(Array(6).fill(phrase));
    expect(() => assertTranscriptQuality(repeated)).toThrow("Suspicious repeated speech");
    expect(() => assertTranscriptQuality(transcript([repeated.text]))).toThrow("Suspicious repeated speech");
    expect(repeated.text).toBe(Array(6).fill(phrase).join(" "));
  });
  it("does not confuse repeated short replies with a decoding loop", () => {
    expect(transcriptQualityIssues(transcript(Array(6).fill("Yes.")))).toEqual([]);
  });
  it("rejects duplicate identities and backwards start times", () => {
    const t = transcript(["One sentence.", "A second sentence."]);
    expect(() => assertTranscriptQuality({ ...t, segments: t.segments.map((s) => ({ ...s, id: "same" })) })).toThrow("identities");
    expect(() => assertTranscriptQuality({ ...t, segments: [...t.segments].reverse() })).toThrow("timestamps");
  });
});
