import type { Transcript } from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";

/** Structural/anomaly checks, not an accuracy score or a semantic fact check. */
export const transcriptQualityIssues = (transcript: Transcript): readonly string[] => {
  const issues: string[] = [];
  if (transcript.text.trim() === "" || transcript.segments.length === 0) {
    issues.push("No timestamped speech was found. Check the audio and selected language.");
  }
  if (!Number.isFinite(transcript.durationS) || transcript.durationS <= 0) {
    issues.push("The transcription duration is invalid.");
  }
  let previousStart = -1;
  const ids = new Set<string>();
  for (const segment of transcript.segments) {
    if (!Number.isFinite(segment.tStart) || !Number.isFinite(segment.tEnd)
      || segment.tStart < 0 || segment.tEnd <= segment.tStart
      || segment.tStart < previousStart || segment.tEnd > transcript.durationS + 0.05
      || ids.has(segment.id) || segment.text.trim() === "") {
      issues.push("Speech timestamps or segment identities are invalid. Retry transcription before using these sources.");
      break;
    }
    previousStart = segment.tStart;
    ids.add(segment.id);
  }
  const normalize = (text: string): string => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  // Repeated long sentences across or within segments are a common decoding
  // loop. Short replies, choruses and repeated technical names are not enough.
  const candidates = [
    transcript.segments.map((segment) => normalize(segment.text)),
    transcript.text.split(/[.!?。！？]+/u).map(normalize).filter(Boolean),
  ];
  for (const phrases of candidates) {
    let previous = "";
    let streak = 0;
    for (const phrase of phrases) {
      streak = phrase === previous ? streak + 1 : 1;
      previous = phrase;
      if (streak >= 4 && phrase.split(" ").length >= 6) {
        issues.push("Suspicious repeated speech was detected. Check the recording, choose its language or a multilingual model, then retry. Repetition can be genuine; this is an anomaly warning, not proof of an error.");
        return issues;
      }
    }
  }
  return issues;
};

export class TranscriptQualityError extends LirovoError {
  constructor(readonly transcript: Transcript, readonly issues: readonly string[]) {
    super("TRANSCRIBE_FAILED", `Transcription needs review: ${issues.join(" ")}`, {
      stage: "asr", detail: { qualityIssues: issues },
    });
  }
}

export const assertTranscriptQuality = (transcript: Transcript): void => {
  const issues = transcriptQualityIssues(transcript);
  if (issues.length > 0) {
    throw new TranscriptQualityError(transcript, issues);
  }
};
