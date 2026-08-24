import type { EvidenceDraft, ReviewSignals } from "@lirovo/contracts";

/**
 * Bump this whenever the derivation below changes.
 *
 * A stored priority is only comparable to another one computed by the same
 * rules. Without the version, an old row and a new one sit in the same queue
 * claiming the same scale while meaning different things.
 */
export const PRIORITY_VERSION = 1;

export interface SignalInput {
  readonly observationId: string;
  readonly evidence: readonly EvidenceDraft[];
  readonly mappingStatus: ReviewSignals["mappingStatus"];
  readonly retracted: boolean;
  readonly conflicting: boolean;
}

/**
 * Four axes a human can read, and a queue position derived from them.
 *
 * Deliberately not a probability. The system this descends from labels its own
 * equivalent "not a calibrated probability" in the schema itself, and the
 * translation people reach for — audio agreeing with a slide counts as
 * corroboration — does not hold: a slide and the narration describing it are
 * two encodings of one source, not two witnesses. Until there is a labelled
 * video corpus and calibration curves, a percentage here would be a number
 * that looks like knowledge and is not.
 */
export const deriveReviewSignals = (input: SignalInput): ReviewSignals => {
  const modalities = new Set(input.evidence.map((e) => (e.modality === "both" ? "audio" : e.modality)));
  const evidenceCoverage: ReviewSignals["evidenceCoverage"] =
    input.evidence.length === 0 ? "none" : input.evidence.length === 1 ? "single" : "multiple";

  // A verbatim quote can be checked against the transcript. OCR can be wrong
  // about characters. An inference cannot be checked at all.
  const evidenceQuality: ReviewSignals["evidenceQuality"] =
    input.evidence.length === 0
      ? "inferred"
      : input.evidence.some((e) => e.quote !== null && e.quote.trim() !== "")
        ? "verbatim"
        : input.evidence.some((e) => e.modality === "visual")
          ? "ocr_uncertain"
          : "inferred";

  const consistency: ReviewSignals["consistency"] = input.retracted
    ? "retracted"
    : input.conflicting
      ? "conflict"
      : "agree";

  let priority = 0;
  if (evidenceCoverage === "none") priority += 100;
  else if (evidenceCoverage === "single") priority += 40;
  if (evidenceQuality === "inferred") priority += 60;
  else if (evidenceQuality === "ocr_uncertain") priority += 25;
  if (consistency === "conflict") priority += 120;
  else if (consistency === "retracted") priority += 80;
  // An ungoverned label is exactly what a human needs to see, so it must not
  // sink to the bottom of the queue that exists to surface it.
  if (input.mappingStatus === "unmapped") priority += 50;
  else if (input.mappingStatus === "provisional") priority += 30;

  return {
    observationId: input.observationId,
    evidenceCoverage,
    evidenceModalities: modalities.size,
    evidenceQuality,
    consistency,
    mappingStatus: input.mappingStatus,
    reviewPriority: priority,
    priorityVersion: PRIORITY_VERSION,
  };
};
