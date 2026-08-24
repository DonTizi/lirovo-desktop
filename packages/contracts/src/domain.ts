import { z } from "zod";
import { stageSchema } from "./stages.js";

export const sourceKindSchema = z.enum(["url", "file"]);
export type SourceKind = z.infer<typeof sourceKindSchema>;

export const runStatusSchema = z.enum(["claimed", "running", "succeeded", "failed", "cancelled"]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const modalitySchema = z.enum(["audio", "visual", "both"]);
export type Modality = z.infer<typeof modalitySchema>;

/** A source is the video. Identity is the content hash, so the same bytes twice is one source. */
export const sourceSchema = z.object({
  id: z.string(),
  kind: sourceKindSchema,
  uri: z.string(),
  contentSha256: z.string().length(64).nullable(),
  title: z.string().nullable(),
  durationS: z.number().positive().nullable(),
  hasAudio: z.boolean(),
  hasVideo: z.boolean(),
  createdAt: z.number().int(),
});
export type Source = z.infer<typeof sourceSchema>;

/**
 * One execution over one source. A job IS a run: there is no separate job row.
 *
 * The v1 draft had both, with artifacts and stages at job grain — a second
 * execution would then have overwritten or ambiguated the first.
 */
export const runSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  schemaRevisionId: z.string().nullable(),
  status: runStatusSchema,
  stagePointer: stageSchema.nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  leaseOwner: z.string().nullable(),
  leaseExpiresAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  startedAt: z.number().int().nullable(),
  finishedAt: z.number().int().nullable(),
});
export type Run = z.infer<typeof runSchema>;

/** One row per ATTEMPT, not per stage: a retry must not erase why the first try failed. */
export const stageAttemptSchema = z.object({
  runId: z.string(),
  stage: stageSchema,
  attempt: z.number().int().min(1),
  inputHash: z.string(),
  status: z.enum(["running", "done", "failed", "degraded"]),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  startedAt: z.number().int(),
  finishedAt: z.number().int().nullable(),
});
export type StageAttempt = z.infer<typeof stageAttemptSchema>;

export const artifactSchema = z.object({
  id: z.string(),
  runId: z.string(),
  kind: z.string(),
  relPath: z.string(),
  sha256: z.string().length(64),
  bytes: z.number().int().min(0),
  contentType: z.string(),
  createdAt: z.number().int(),
});
export type Artifact = z.infer<typeof artifactSchema>;

/**
 * Evidence: an addressable moment that proves something.
 *
 * `sourceRef` is the anchor into an artifact (`asr#seg_12`, `frame#000042`).
 * This plus `extracted_values` is the invariant the whole product rests on.
 */
export const evidenceSchema = z.object({
  id: z.string(),
  runId: z.string(),
  modality: modalitySchema,
  sourceRef: z.string(),
  tStart: z.number().min(0),
  tEnd: z.number().min(0),
  quote: z.string().nullable(),
  nodeKey: z.string().nullable(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

/**
 * One extracted leaf value.
 *
 * `observationId` is always present. `propositionKey` is present ONLY when the
 * schema declares an identity rule: the financial `claim_id` carries nine
 * dimensions (entity, metric, period, basis, unit, currency...) that arbitrary
 * video JSON simply does not have, so a mandatory identity would be false
 * precision. See the plan, section 4.3.
 */
export const extractedValueSchema = z.object({
  observationId: z.string(),
  runId: z.string(),
  fieldPath: z.string(),
  valueJson: z.string(),
  propositionKey: z.string().nullable(),
  retractsObservationId: z.string().nullable(),
  createdAt: z.number().int(),
});
export type ExtractedValue = z.infer<typeof extractedValueSchema>;

/**
 * Four audited axes. Deliberately NOT a probability.
 *
 * appIQ names its own equivalent RELEVANCE_SCORE and documents it as "not a
 * calibrated probability". A slide and the narration describing it are usually
 * two correlated encodings of one source, not two independent witnesses, so a
 * cross-modal agreement number would overstate what is actually known.
 */
export const reviewSignalsSchema = z.object({
  observationId: z.string(),
  evidenceCoverage: z.enum(["none", "single", "multiple"]),
  evidenceModalities: z.number().int().min(0).max(2),
  evidenceQuality: z.enum(["verbatim", "ocr_uncertain", "inferred"]),
  consistency: z.enum(["agree", "conflict", "retracted"]),
  mappingStatus: z.enum(["matched", "provisional", "unmapped"]),
  /** Queue order only. Higher means "a human should look sooner". Never shown as a percentage. */
  reviewPriority: z.number().int(),
  priorityVersion: z.number().int().min(1),
});
export type ReviewSignals = z.infer<typeof reviewSignalsSchema>;

/** Append-only. The current state is a view over the events, never a mutable column. */
export const reviewEventSchema = z.object({
  id: z.string(),
  observationId: z.string(),
  decision: z.enum(["approved", "rejected", "reopened"]),
  actor: z.string(),
  note: z.string().nullable(),
  schemaRevisionId: z.string().nullable(),
  createdAt: z.number().int(),
});
export type ReviewEvent = z.infer<typeof reviewEventSchema>;

/**
 * Everything needed to explain, and to reproduce, one run.
 *
 * Prompts are stored in full. A model alias plus a prompt hash is not enough:
 * the prompt ASSEMBLER changes behaviour with no version bump, which is the
 * exact gap appIQ documents on its own telemetry table.
 */
export const runManifestSchema = z.object({
  runId: z.string(),
  sourceSha256: z.string().nullable(),
  schemaRevisionId: z.string().nullable(),
  schemaJson: z.string().nullable(),
  prompts: z.record(z.string(), z.string()),
  asrEngine: z.string().nullable(),
  asrModel: z.string().nullable(),
  inferenceBackend: z.string().nullable(),
  inferenceModel: z.string().nullable(),
  backendVersion: z.string().nullable(),
  dependencyVersions: z.record(z.string(), z.string()),
  settings: z.record(z.string(), z.unknown()),
  createdAt: z.number().int(),
});
export type RunManifest = z.infer<typeof runManifestSchema>;
