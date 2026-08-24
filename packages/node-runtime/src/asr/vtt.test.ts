import { describe, expect, it } from "vitest";
import { overlapLength, parseInlineWords, parseVtt } from "./vtt.js";

/** The real shape YouTube emits: every cue repeats the previous line and adds words. */
const ROLLING = `WEBVTT
Kind: captions
Language: en

00:00:00.030 --> 00:00:02.669 align:start position:0%
 
so<00:00:00.719><c> the</c><00:00:01.000><c> topic</c>

00:00:02.669 --> 00:00:02.679 align:start position:0%
so the topic
 

00:00:02.679 --> 00:00:04.910 align:start position:0%
so the topic
today<00:00:03.100><c> is</c><00:00:03.400><c> launch</c>

00:00:04.910 --> 00:00:06.000 align:start position:0%
today is launch
window
`;

const PLAIN = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello there.

00:00:03.000 --> 00:00:05.500
This is a second cue.
`;

describe("parseVtt", () => {
  it("does not repeat rolling caption lines", () => {
    const { text } = parseVtt(ROLLING);
    // A naive concatenation yields "so the topic so the topic so the topic today...".
    expect(text).toBe("so the topic today is launch window");
    expect(text.match(/so the topic/g)).toHaveLength(1);
  });

  it("drops cues that introduce nothing new", () => {
    // The second cue in ROLLING only re-states the first.
    const { segments } = parseVtt(ROLLING);
    expect(segments.map((s) => s.text)).toEqual(["so the topic", "today is launch", "window"]);
  });

  it("starts a segment at its first new word, not at the cue boundary", () => {
    const { segments } = parseVtt(ROLLING);
    // "today is launch" is introduced inside a cue that opens at 2.679, but the
    // word "today" is what lands there, so the segment must not claim 0.030.
    expect(segments[1]?.tStart).toBeCloseTo(2.679, 3);
    expect(segments[0]?.tStart).toBeCloseTo(0.03, 3);
  });

  it("extracts per-word timings when the cue carries them", () => {
    const { segments } = parseVtt(ROLLING);
    const first = segments[0];
    expect(first?.words.map((w) => w.w)).toEqual(["so", "the", "topic"]);
    expect(first?.words[1]?.tStart).toBeCloseTo(0.719, 3);
    // Each word ends where the next begins.
    expect(first?.words[0]?.tEnd).toBeCloseTo(0.719, 3);
  });

  it("handles plain non-rolling captions with no word timings", () => {
    const { segments, text, durationS } = parseVtt(PLAIN);
    expect(text).toBe("Hello there. This is a second cue.");
    expect(segments).toHaveLength(2);
    expect(segments[0]?.words).toEqual([]);
    expect(durationS).toBeCloseTo(5.5, 3);
  });

  it("strips cue tags and decodes entities", () => {
    const vtt = `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<c.colorE5E5E5>Ben &amp; Jerry&#39;s</c>\n`;
    expect(parseVtt(vtt).text).toBe("Ben & Jerry's");
  });

  it("returns nothing for a caption file with no cues", () => {
    expect(parseVtt("WEBVTT\n\n").segments).toEqual([]);
  });

  it("accepts comma decimal separators", () => {
    const vtt = `WEBVTT\n\n00:00:01,000 --> 00:00:02,500\nok\n`;
    expect(parseVtt(vtt).durationS).toBeCloseTo(2.5, 3);
  });
});

describe("overlapLength", () => {
  it("finds the longest repeated tail", () => {
    expect(overlapLength(["a", "b", "c"], ["b", "c", "d"])).toBe(2);
  });

  it("is zero when nothing repeats", () => {
    expect(overlapLength(["a", "b"], ["x", "y"])).toBe(0);
  });

  it("does not over-consume when the whole cue repeats", () => {
    expect(overlapLength(["a", "b"], ["a", "b"])).toBe(2);
  });

  it("prefers the longest match, not the first", () => {
    // A short tail also matches here; taking it would duplicate "a".
    expect(overlapLength(["x", "a", "a"], ["a", "a", "b"])).toBe(2);
  });
});

describe("parseInlineWords", () => {
  it("carries the leading word at the cue start", () => {
    const words = parseInlineWords("so<00:00:00.719><c> the</c>", 0.03, 2.0);
    expect(words[0]).toEqual({ w: "so", tStart: 0.03, tEnd: 0.719 });
  });

  it("returns nothing for a cue with no text", () => {
    expect(parseInlineWords(" \n ", 0, 1)).toEqual([]);
  });
});
