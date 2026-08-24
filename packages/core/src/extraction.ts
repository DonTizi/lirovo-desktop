import type {
  AbortSignalLike,
  EvidenceDraft,
  FrameAnalysis,
  PipelineEventListener,
  TranscriptSegment,
} from "@lirovo/contracts";
import { LirovoError, asLirovoError } from "@lirovo/contracts";
import type { Kg } from "./kg.js";
import type { MediaPipelineDeps, MediaPipelineInput, MediaPipelineResult } from "./media-pipeline.js";
import { runMediaPipeline } from "./media-pipeline.js";

/** The model stages, behind a port so core stays free of any provider. */
export interface InferenceStages {
  /**
   * Describe the kept frames.
   *
   * Optional because a backend that cannot see images is a real configuration,
   * not a broken one: the run is then built from speech alone.
   */
  describeFrames?(input: { runId: string; signal: AbortSignalLike }): Promise<{
    analyses: readonly FrameAnalysis[];
    sessions: number;
    framesMissing: number;
    framesSkippedForBudget: number;
  }>;

  buildGraph(input: {
    segments: readonly TranscriptSegment[];
    frames: readonly FrameAnalysis[];
    durationS: number;
    signal: AbortSignalLike;
  }): Promise<{ kg: Kg; windows: number; repaired: number; prompts: Record<string, string> }>;

  extract(input: { kg: Kg; dataSchema: Record<string, unknown>; signal: AbortSignalLike }): Promise<{
    data: unknown;
    evidenceByField: Map<string, EvidenceDraft[]>;
    repaired: boolean;
    prompt: string;
  }>;
}

export interface ExtractionInput extends MediaPipelineInput {
  readonly dataSchema: Record<string, unknown>;
}

export interface ExtractionDeps extends MediaPipelineDeps {
  readonly inference: InferenceStages;
  readonly onEvent?: PipelineEventListener;
}

export interface ExtractionResult extends MediaPipelineResult {
  readonly kg: Kg;
  readonly frameAnalyses: number;
  readonly visionSessions: number;
  readonly framesSkippedForBudget: number;
  readonly data: unknown;
  readonly evidenceByField: Map<string, EvidenceDraft[]>;
  readonly graphWindows: number;
  readonly repairs: number;
  readonly prompts: Record<string, string>;
}

/**
 * The whole pipeline: media, transcription, graph, typed extraction.
 *
 * The two model stages are appended to the deterministic half rather than
 * folded into it, so a media run that already happened is not repeated when
 * only the schema changed — and so the deterministic half stays independently
 * runnable and independently comparable against a golden reference.
 */
export const runExtraction = async (
  input: ExtractionInput,
  deps: ExtractionDeps,
): Promise<ExtractionResult> => {
  const media = await runMediaPipeline(input, deps);
  const emit = deps.onEvent ?? ((): void => {});

  const stage = async <T>(name: "vision" | "graph" | "reason", run: () => Promise<T>): Promise<T> => {
    emit({ type: "stage:start", runId: input.runId, stage: name, attempt: 1 });
    const startedAt = deps.now();
    try {
      const value = await run();
      emit({ type: "stage:done", runId: input.runId, stage: name, ms: deps.now() - startedAt });
      return value;
    } catch (error) {
      const lirovo = asLirovoError(error, "INFERENCE_FAILED", { stage: name });
      emit(
        lirovo.code === "CANCELLED"
          ? { type: "run:cancelled", runId: input.runId, stage: name }
          : { type: "run:failed", runId: input.runId, stage: name, code: lirovo.code, message: lirovo.message },
      );
      throw lirovo;
    }
  };

  // Vision is enrichment: a backend that cannot see images, or a source with
  // no frames, still yields a graph from speech. Failing the run here would
  // throw away a transcript the user already paid for.
  let analyses: readonly FrameAnalysis[] = [];
  let visionSessions = 0;
  let framesSkippedForBudget = 0;
  if (deps.inference.describeFrames !== undefined && media.keptFrameCount > 0) {
    try {
      const described = await stage("vision", () =>
        (deps.inference.describeFrames as NonNullable<InferenceStages["describeFrames"]>)({
          runId: input.runId,
          signal: input.signal,
        }),
      );
      analyses = described.analyses;
      visionSessions = described.sessions;
      framesSkippedForBudget = described.framesSkippedForBudget;
      if (described.framesSkippedForBudget > 0) {
        // Loud, never silent: a user who does not know frames were left out
        // will read the result as complete.
        emit({
          type: "stage:degraded",
          runId: input.runId,
          stage: "vision",
          code: "FRAME_BUDGET_APPLIED",
          message: `${described.framesSkippedForBudget} frame(s) left undescribed to stay inside the time budget`,
        });
      }
      if (described.framesMissing > 0) {
        emit({
          type: "stage:degraded",
          runId: input.runId,
          stage: "vision",
          code: "FRAMES_UNDESCRIBED",
          message: `${described.framesMissing} frame(s) came back undescribed`,
        });
      }
    } catch (error) {
      const lirovo = asLirovoError(error, "INFERENCE_FAILED", { stage: "vision" });
      if (lirovo.code === "CANCELLED") throw lirovo;
      media.degraded.push({ stage: "vision", code: lirovo.code, message: lirovo.message });
      emit({ type: "stage:degraded", runId: input.runId, stage: "vision", code: lirovo.code, message: lirovo.message });
    }
  }

  const graph = await stage("graph", () =>
    deps.inference.buildGraph({
      segments: media.transcript.segments,
      frames: analyses,
      durationS: media.transcript.durationS,
      signal: input.signal,
    }),
  );

  if (graph.kg.nodes.length === 0) {
    throw new LirovoError("INFERENCE_FAILED", "the graph came back empty — nothing was grounded in the source", {
      stage: "graph",
    });
  }

  const extracted = await stage("reason", () =>
    deps.inference.extract({ kg: graph.kg, dataSchema: input.dataSchema, signal: input.signal }),
  );

  emit({ type: "run:done", runId: input.runId, ms: deps.now() });

  return {
    ...media,
    kg: graph.kg,
    frameAnalyses: analyses.length,
    visionSessions,
    framesSkippedForBudget,
    data: extracted.data,
    evidenceByField: extracted.evidenceByField,
    graphWindows: graph.windows,
    repairs: graph.repaired + (extracted.repaired ? 1 : 0),
    prompts: { ...graph.prompts, pass_b: extracted.prompt },
  };
};

/** Every leaf path in a value, in the bracket/dot notation the model cites. */
export const leafPaths = (value: unknown, prefix = ""): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => leafPaths(item, `${prefix}[${i}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      leafPaths(child, prefix === "" ? key : `${prefix}.${key}`),
    );
  }
  return [prefix];
};
