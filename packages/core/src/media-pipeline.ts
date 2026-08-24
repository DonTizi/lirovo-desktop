import type {
  AbortSignalLike,
  ArtifactStore,
  AsrStrategy,
  NormalizeResult,
  PipelineEventListener,
  SourceManifest,
  Stage,
  Transcript,
} from "@lirovo/contracts";
import { ARTIFACT_PATHS, LirovoError, asLirovoError, mergeStagePointer } from "@lirovo/contracts";

/**
 * The concrete media stages, behind a port.
 *
 * Every one of them shells out to a binary, so none of them can live in this
 * package. Naming them here is what lets the CLI, the MCP server and the
 * desktop share one orchestration instead of three that drift.
 */
export interface MediaStages {
  ingest(input: { runId: string; source: string; signal: AbortSignalLike }): Promise<{
    manifest: SourceManifest;
    mediaPath: string;
  }>;
  normalize(input: {
    runId: string;
    manifest: SourceManifest;
    mediaPath: string;
    signal: AbortSignalLike;
  }): Promise<NormalizeResult>;
  sceneDetect(input: {
    runId: string;
    videoPath: string;
    frameCap: number;
    signal: AbortSignalLike;
  }): Promise<{ rawFrameCount: number }>;
  dedup(input: { runId: string; signal: AbortSignalLike }): Promise<{ keptCount: number; droppedCount: number }>;
}

export interface MediaPipelineInput {
  readonly runId: string;
  readonly source: string;
  readonly frameCap: number;
  readonly signal: AbortSignalLike;
}

export interface MediaPipelineDeps {
  readonly stages: MediaStages;
  readonly asr: AsrStrategy;
  readonly store: ArtifactStore;
  readonly onEvent?: PipelineEventListener;
  readonly now: () => number;
}

export interface MediaPipelineResult {
  readonly manifest: SourceManifest;
  readonly transcript: Transcript;
  readonly rawFrameCount: number;
  readonly keptFrameCount: number;
  readonly droppedFrameCount: number;
  /** Stages that failed without failing the run. Appended to as later stages degrade. */
  readonly degraded: { stage: Stage; code: string; message: string }[];
}

/**
 * Media stages plus transcription. No model calls.
 *
 * This is the half of the pipeline that is deterministic and cheap, and running
 * it alone is genuinely useful: it is how you check that a source ingests, how
 * you inspect the frames a video actually yields, and how the golden fixture is
 * compared — model output is not reproducible, but this is.
 */
export const runMediaPipeline = async (
  input: MediaPipelineInput,
  deps: MediaPipelineDeps,
): Promise<MediaPipelineResult> => {
  const degraded: { stage: Stage; code: string; message: string }[] = [];
  let pointer: Stage | null = null;

  const emit = deps.onEvent ?? ((): void => {});
  emit({ type: "run:start", runId: input.runId, at: deps.now() });

  const stage = async <T>(name: Stage, run: () => Promise<T>): Promise<T> => {
    pointer = mergeStagePointer(pointer, name);
    emit({ type: "stage:start", runId: input.runId, stage: name, attempt: 1 });
    const startedAt = deps.now();
    const value = await run();
    emit({ type: "stage:done", runId: input.runId, stage: name, ms: deps.now() - startedAt });
    return value;
  };

  try {
    const ingested = await stage("ingest", () =>
      deps.stages.ingest({ runId: input.runId, source: input.source, signal: input.signal }),
    );

    const normalized = await stage("normalize", () =>
      deps.stages.normalize({
        runId: input.runId,
        manifest: ingested.manifest,
        mediaPath: ingested.mediaPath,
        signal: input.signal,
      }),
    );

    // Transcription and the visual branch are independent, so they run together
    // — on a long recording the frames are ready by the time whisper finishes.
    const [transcript, visual] = await Promise.all([
      stage("asr", () =>
        deps.asr.transcribe({
          runId: input.runId,
          sourceKind: ingested.manifest.source_type === "file" ? "file" : "url",
          sourceUri: input.source,
          audioPath: normalized.audio_path,
          signal: input.signal,
        }),
      ),
      (async () => {
        if (normalized.video_path === null) return { raw: 0, kept: 0, dropped: 0 };
        const detected = await stage("scene-detect", () =>
          deps.stages.sceneDetect({
            runId: input.runId,
            videoPath: normalized.video_path as string,
            frameCap: input.frameCap,
            signal: input.signal,
          }),
        );
        if (detected.rawFrameCount === 0) return { raw: 0, kept: 0, dropped: 0 };
        const deduped = await stage("dedup", () => deps.stages.dedup({ runId: input.runId, signal: input.signal }));
        return { raw: detected.rawFrameCount, kept: deduped.keptCount, dropped: deduped.droppedCount };
      })().catch((error: unknown) => {
        // The visual branch is enrichment. A source that yields no usable
        // frames still has a transcript worth having, so this degrades rather
        // than failing the run — except when the user cancelled, and except
        // when the frame budget refused, which is a decision, not a fault.
        const lirovo = asLirovoError(error, "SCENE_DETECT_FAILED", { stage: "scene-detect" });
        if (lirovo.code === "CANCELLED" || lirovo.code === "FRAME_BUDGET_EXCEEDED") throw lirovo;
        degraded.push({ stage: "vision", code: lirovo.code, message: lirovo.message });
        emit({
          type: "stage:degraded",
          runId: input.runId,
          stage: "scene-detect",
          code: lirovo.code,
          message: lirovo.message,
        });
        return { raw: 0, kept: 0, dropped: 0 };
      }),
    ]);

    await deps.store.put(
      input.runId,
      ARTIFACT_PATHS.transcript,
      `${JSON.stringify({ run_id: input.runId, ...transcript }, null, 2)}\n`,
    );

    emit({ type: "run:done", runId: input.runId, ms: deps.now() });
    return {
      manifest: ingested.manifest,
      transcript,
      rawFrameCount: visual.raw,
      keptFrameCount: visual.kept,
      droppedFrameCount: visual.dropped,
      degraded,
    };
  } catch (error) {
    const lirovo = error instanceof LirovoError ? error : asLirovoError(error);
    if (lirovo.code === "CANCELLED") {
      emit({ type: "run:cancelled", runId: input.runId, stage: pointer });
    } else {
      emit({
        type: "run:failed",
        runId: input.runId,
        stage: pointer,
        code: lirovo.code,
        message: lirovo.message,
      });
    }
    throw lirovo;
  }
};
