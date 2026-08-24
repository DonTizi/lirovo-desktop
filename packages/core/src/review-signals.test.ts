import { describe, expect, it } from "vitest";
import type { EvidenceDraft } from "@lirovo/contracts";
import { deriveReviewSignals, PRIORITY_VERSION } from "./review-signals.js";

const ev = (over: Partial<EvidenceDraft> = {}): EvidenceDraft => ({
  modality: "audio",
  sourceRef: "asr#seg_1",
  tStart: 1,
  tEnd: 2,
  quote: "we ship on the fourth",
  nodeKey: "n1",
  ...over,
});

const base = { observationId: "obs_1", mappingStatus: "matched" as const, retracted: false, conflicting: false };

describe("deriveReviewSignals", () => {
  it("counts distinct modalities, folding 'both' into one", () => {
    const s = deriveReviewSignals({ ...base, evidence: [ev(), ev({ modality: "visual" })] });
    expect(s.evidenceModalities).toBe(2);
    expect(deriveReviewSignals({ ...base, evidence: [ev({ modality: "both" })] }).evidenceModalities).toBe(1);
  });

  it("calls a quoted span verbatim and an unquoted visual one uncertain", () => {
    expect(deriveReviewSignals({ ...base, evidence: [ev()] }).evidenceQuality).toBe("verbatim");
    expect(
      deriveReviewSignals({ ...base, evidence: [ev({ modality: "visual", quote: null })] }).evidenceQuality,
    ).toBe("ocr_uncertain");
  });

  it("puts a conflict at the top of the queue", () => {
    const clean = deriveReviewSignals({ ...base, evidence: [ev(), ev({ sourceRef: "asr#seg_2" })] });
    const conflict = deriveReviewSignals({ ...base, evidence: [ev()], conflicting: true });
    expect(conflict.reviewPriority).toBeGreaterThan(clean.reviewPriority);
  });

  it("does not let an ungoverned label sink below a governed one", () => {
    // The queue exists to surface exactly these, so they must not rank lower.
    const matched = deriveReviewSignals({ ...base, evidence: [ev()] });
    const unmapped = deriveReviewSignals({ ...base, evidence: [ev()], mappingStatus: "unmapped" });
    expect(unmapped.reviewPriority).toBeGreaterThan(matched.reviewPriority);
  });

  it("ranks an ungrounded value above everything ordinary", () => {
    const none = deriveReviewSignals({ ...base, evidence: [] });
    const grounded = deriveReviewSignals({ ...base, evidence: [ev()] });
    expect(none.evidenceCoverage).toBe("none");
    expect(none.evidenceQuality).toBe("inferred");
    expect(none.reviewPriority).toBeGreaterThan(grounded.reviewPriority);
  });

  it("emits no percentage anywhere", () => {
    // A number that looks like a probability would be read as one.
    const s = deriveReviewSignals({ ...base, evidence: [ev()] });
    expect(Object.values(s).some((v) => typeof v === "number" && v > 0 && v < 1)).toBe(false);
    expect(s.priorityVersion).toBe(PRIORITY_VERSION);
  });
});
