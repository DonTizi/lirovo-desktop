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

/** The two model stages, behind a port so core stays free of any provider. */
export interface InferenceStages {
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

  const stage = async <T>(name: "graph" | "reason", run: () => Promise<T>): Promise<T> => {
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

  const graph = await stage("graph", () =>
    deps.inference.buildGraph({
      segments: media.transcript.segments,
      // Frame analyses only exist once a vision backend has run. Until then the
      // graph is built from speech alone, which is a real, valid mode — not a
      // degraded one — for an audio-only source.
      frames: [],
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
