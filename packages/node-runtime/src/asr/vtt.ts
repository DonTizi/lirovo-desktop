import type { TranscriptSegment, TranscriptWord } from "@lirovo/contracts";

/**
 * WebVTT parsing, tuned for YouTube auto-captions.
 *
 * Auto-captions ROLL: each cue repeats the tail of the previous cue and adds a
 * word or two. A parser that concatenates cues produces a transcript two to
 * three times longer than what was said, with every phrase stuttering. So the
 * parser tracks what has already been emitted and keeps only the new tail.
 *
 * Auto-captions also carry per-word timings as inline `<00:00:01.234><c>word</c>`
 * tags. Those are worth extracting: a word-level anchor makes the "click a value,
 * jump to the instant it was said" behaviour land on the word rather than on a
 * five-second block.
 */

const TIMESTAMP = /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/;
const CUE_LINE = new RegExp(`^${TIMESTAMP.source}\\s*-->\\s*${TIMESTAMP.source}`);
const INLINE_TIME = /<(\d{2}):(\d{2}):(\d{2})[.,](\d{3})>/g;

export const parseTimestamp = (h: string, m: string, s: string, ms: string): number =>
  Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

interface RawCue {
  readonly tStart: number;
  readonly tEnd: number;
  readonly raw: string;
}

const readCues = (vtt: string): RawCue[] => {
  const cues: RawCue[] = [];
  const lines = vtt.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const match = CUE_LINE.exec(lines[i] ?? "");
    if (match === null) continue;
    const tStart = parseTimestamp(match[1] as string, match[2] as string, match[3] as string, match[4] as string);
    const tEnd = parseTimestamp(match[5] as string, match[6] as string, match[7] as string, match[8] as string);

    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j] ?? "";
      // A cue ends at an EMPTY line, not at a whitespace-only one: YouTube
      // emits a single-space line ahead of the payload, and trimming here
      // silently dropped the first cue of every auto-captioned video.
      if (line === "" || CUE_LINE.test(line)) break;
      body.push(line);
      i = j;
    }
    cues.push({ tStart, tEnd, raw: body.join("\n") });
  }
  return cues;
};

/** Strip cue tags but keep the text: `<c.colorE5E5E5>hi</c>` becomes `hi`. */
const stripTags = (s: string): string =>
  s
    .replace(INLINE_TIME, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** Word timings, when the cue carries inline `<time>` tags. */
export const parseInlineWords = (raw: string, cueStart: number, cueEnd: number): TranscriptWord[] => {
  // No inline timestamps means no word-level timing exists. Emitting one word
  // per token all sharing the cue's start would claim a precision the caption
  // file does not carry, and evidence anchors would point at the wrong instant.
  if (!INLINE_TIME.test(raw)) return [];
  INLINE_TIME.lastIndex = 0;

  const words: TranscriptWord[] = [];
  // Split on the timestamps, keeping them, so each chunk is "time then text".
  const parts = raw.split(/(<\d{2}:\d{2}:\d{2}[.,]\d{3}>)/);
  let pending = cueStart;

  for (const part of parts) {
    const timeMatch = /^<(\d{2}):(\d{2}):(\d{2})[.,](\d{3})>$/.exec(part);
    if (timeMatch !== null) {
      pending = parseTimestamp(
        timeMatch[1] as string,
        timeMatch[2] as string,
        timeMatch[3] as string,
        timeMatch[4] as string,
      );
      continue;
    }
    const text = stripTags(part);
    if (text === "") continue;
    for (const token of text.split(" ")) {
      if (token === "") continue;
      words.push({ w: token, tStart: pending, tEnd: cueEnd });
    }
  }

  // Each word ends where the next begins; the last one runs to the cue end.
  return words.map((word, i) => {
    const next = words[i + 1];
    return next === undefined ? word : { ...word, tEnd: next.tStart };
  });
};

/**
 * How many leading tokens of `next` repeat the tail of `seen`.
 *
 * The comparison is on tokens rather than characters so a cue that re-emits
 * "so the topic" followed by a new "today" contributes only "today".
 */
export const overlapLength = (seen: readonly string[], next: readonly string[]): number => {
  const max = Math.min(seen.length, next.length);
  for (let n = max; n > 0; n -= 1) {
    let same = true;
    for (let i = 0; i < n; i += 1) {
      if (seen[seen.length - n + i] !== next[i]) {
        same = false;
        break;
      }
    }
    if (same) return n;
  }
  return 0;
};

export interface ParsedVtt {
  readonly segments: readonly TranscriptSegment[];
  readonly text: string;
  readonly durationS: number;
}

export const parseVtt = (vtt: string): ParsedVtt => {
  const cues = readCues(vtt);
  const segments: TranscriptSegment[] = [];
  const emitted: string[] = [];
  let durationS = 0;

  for (const cue of cues) {
    durationS = Math.max(durationS, cue.tEnd);
    const words = parseInlineWords(cue.raw, cue.tStart, cue.tEnd);
    const tokens = words.length > 0 ? words.map((w) => w.w) : stripTags(cue.raw).split(" ").filter((t) => t !== "");
    if (tokens.length === 0) continue;

    const skip = overlapLength(emitted, tokens);
    const fresh = tokens.slice(skip);
    if (fresh.length === 0) continue;

    const freshWords = words.length > 0 ? words.slice(skip) : [];
    segments.push({
      id: `seg_${segments.length}`,
      speaker: null,
      // A rolling cue's new words start where the first of them starts, not
      // where the cue does — otherwise every segment claims the same instant.
      tStart: freshWords[0]?.tStart ?? cue.tStart,
      tEnd: cue.tEnd,
      text: fresh.join(" "),
      words: freshWords,
    });
    emitted.push(...fresh);
  }

  return { segments, text: segments.map((s) => s.text).join(" "), durationS };
};
