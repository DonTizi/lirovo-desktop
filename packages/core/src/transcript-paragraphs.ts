/**
 * Caption cues, gathered into paragraphs.
 *
 * A platform's auto-captions arrive as two-second fragments cut to fit a
 * subtitle bar, not to end a thought: "Apple made it faster and faster while" /
 * "leaving a few strange cracks behind." Rendered one row each, a twenty-minute
 * talk becomes 554 rows of half-sentences that cannot be read as prose — the
 * text is all there and none of it is legible.
 *
 * Grouping is not summarising: every cue survives, in order, with its own
 * timing kept alongside so a player can still highlight the exact line being
 * spoken and a click can still seek to the second it started.
 */

export interface CueLike {
  readonly tStart: number;
  readonly tEnd: number;
  readonly text: string;
  readonly speaker?: string | null;
}

export interface TranscriptParagraph {
  readonly tStart: number;
  readonly tEnd: number;
  readonly speaker: string | null;
  readonly text: string;
  /** The cues it was built from, so the spoken line stays addressable. */
  readonly cues: readonly CueLike[];
}

export interface ParagraphOptions {
  /** Do not close a paragraph before this many characters. */
  readonly minChars?: number;
  /** Close at the next sentence end past this, whatever else is true. */
  readonly maxChars?: number;
  /** A silence at least this long is a paragraph break on its own. */
  readonly gapS?: number;
  /** Close after this long regardless: unpunctuated speech has no other edge. */
  readonly maxSpanS?: number;
}

/**
 * Chosen against real auto-captions, not from taste.
 *
 * 320 characters is roughly four spoken sentences — long enough to read as
 * prose, short enough that the timecode beside it still points at something
 * precise. The 1.6s gap is above the 0-0.3s that separates consecutive cues in
 * continuous speech and below the pause that follows a real topic change.
 */
const DEFAULTS: Required<ParagraphOptions> = {
  minChars: 200,
  maxChars: 320,
  gapS: 1.6,
  maxSpanS: 45,
};

const ENDS_SENTENCE = /[.!?]["')\]]?\s*$/;

export const toParagraphs = (
  cues: readonly CueLike[],
  options: ParagraphOptions = {},
): TranscriptParagraph[] => {
  const { minChars, maxChars, gapS, maxSpanS } = { ...DEFAULTS, ...options };
  const out: TranscriptParagraph[] = [];
  let batch: CueLike[] = [];

  const flush = (): void => {
    if (batch.length === 0) return;
    const first = batch[0] as CueLike;
    const last = batch[batch.length - 1] as CueLike;
    out.push({
      tStart: first.tStart,
      tEnd: last.tEnd,
      speaker: first.speaker ?? null,
      // Single spaces: cues carry their own trailing whitespace inconsistently,
      // and a paragraph with double gaps in it reads as broken.
      text: batch
        .map((c) => c.text.trim())
        .filter((t) => t !== "")
        .join(" "),
      cues: batch,
    });
    batch = [];
  };

  for (const cue of cues) {
    const previous = batch[batch.length - 1];
    if (previous !== undefined) {
      const silence = cue.tStart - previous.tEnd >= gapS;
      const newSpeaker = (cue.speaker ?? null) !== (previous.speaker ?? null);
      const tooLong = cue.tEnd - (batch[0] as CueLike).tStart >= maxSpanS;
      if (silence || newSpeaker || tooLong) flush();
    }

    batch.push(cue);

    const soFar = batch.map((c) => c.text.trim()).join(" ");
    // A sentence end is where a paragraph WANTS to break; the length decides
    // whether it is time to take it.
    if (soFar.length >= maxChars || (soFar.length >= minChars && ENDS_SENTENCE.test(soFar))) flush();
  }

  flush();
  return out;
};

/** The cue being spoken at `t`, so a reader can see where they are. */
export const cueAt = (paragraph: TranscriptParagraph, t: number): CueLike | null =>
  paragraph.cues.find((c) => t >= c.tStart && t < c.tEnd) ?? null;
