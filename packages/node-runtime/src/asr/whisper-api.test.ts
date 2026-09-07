import { describe, expect, it } from "vitest";
import { parseVerboseJson } from "./whisper-api.js";
import { assertTranscriptQuality, TranscriptQualityError } from "./quality.js";

describe("hosted speech evidence offsets", () => {
  it.each([
    { end: 2, text: "Complete source sentence." },
    { start: 0, text: "Complete source sentence." },
    { text: "Complete source sentence." },
  ])("rejects missing timestamps rather than inventing zero for %j", (segment) => {
    const parsed = parseVerboseJson({ duration: 2, text: segment.text, segments: [segment] });
    const candidate = { ...parsed, text: segment.text, engine: "whisper-api", model: "fixture", language: "en" };
    expect(() => assertTranscriptQuality(candidate)).toThrow(TranscriptQualityError);
    expect(candidate.segments[0]?.text).toBe(segment.text);
  });

  it("preserves a real zero start and the complete returned text", () => {
    const text = "Complete source sentence. Été, research and evidence.";
    const parsed = parseVerboseJson({ duration: 2, text, segments: [{ start: 0, end: 2, text }] });
    expect(parsed.segments[0]).toMatchObject({ tStart: 0, tEnd: 2, text });
    expect(() => assertTranscriptQuality({ ...parsed, text, engine: "whisper-api", model: "fixture", language: "en" })).not.toThrow();
  });
});
