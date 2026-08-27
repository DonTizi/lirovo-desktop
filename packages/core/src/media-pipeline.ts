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
import { chainHash, noLedger, type StageLedger } from "./ledger.js";

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
  readonly sha256: (input: string) => string;
  /**
   * Where completed stages are recorded, and where a resumed run reads from.
   * Absent means every stage runs — which is the right default for a caller
   * that has nowhere to persist the ledger.
   */
  readonly ledger?: StageLedger;
  /**
   * Called once the source is known, before any expensive stage.
   *
   * The run row cannot exist before this point — it references a source whose
   * identity is the content hash, and that is what ingest computes. Everything
   * after this callback is ledgered and therefore resumable.
   */
  readonly onIngested?: (manifest: SourceManifest) => void;
}

export interface MediaPipelineResult {
  readonly manifest: SourceManifest;
  readonly transcript: Transcript;
  readonly rawFrameCount: number;
  readonly keptFrameCount: number;
  readonly droppedFrameCount: number;
  /** Stages that failed without failing the run. Appended to as later stages degrade. */
  readonly degraded: { stage: Stage; code: string; message: string }[];
  /** The hash the next stage chains from. Internal, but the model stages need it. */
  readonly chainTip: string;
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

  const ledger = deps.ledger ?? noLedger;

  /**
   * Run a stage, or hand back what an earlier attempt already produced.
   *
   * The hash chains through every stage before this one, so a cache entry can
   * only match when the whole upstream produced the same thing and this
   * stage's own parameters are unchanged. That is what makes it safe to skip
   * two hundred seconds of frame description after a crash, and what makes a
   * changed threshold correctly redo the work.
   */
  const stage = async <T>(
    name: Stage,
    previousHash: string,
    params: unknown,
    run: () => Promise<T>,
  ): Promise<{ value: T; hash: string }> => {
    pointer = mergeStagePointer(pointer, name);
    const hash = chainHash(deps.sha256, previousHash, name, params);

    const cached = ledger.cached(name, hash);
    if (cached !== null) {
      emit({ type: "stage:resumed", runId: input.runId, stage: name });
      return { value: cached as T, hash };
    }

    const attempt = ledger.begin(name, hash);
    emit({ type: "stage:start", runId: input.runId, stage: name, attempt });
    const startedAt = deps.now();
    try {
      const value = await run();
      ledger.complete(name, attempt, { status: "done", output: value });
      emit({ type: "stage:done", runId: input.runId, stage: name, ms: deps.now() - startedAt });
      return { value, hash };
    } catch (error) {
      // The failed attempt stays on the record: a retry that erased it would
      // take the only evidence of what went wrong the first time.
      const lirovo = asLirovoError(error, "INTERNAL", { stage: name });
      ledger.complete(name, attempt, { status: "failed", code: lirovo.code, message: lirovo.message });
      throw lirovo;
    }
  };

  try {
    // Ingest deliberately bypasses the ledger.
    //
    // An attempt row references the run, the run references a source, and the
    // source's identity is the content hash that ingest is on its way to
    // computing. Recording this stage would mean writing a row against a run
    // that cannot exist yet — which is exactly the foreign-key failure this
    // comment used to describe while the code did the opposite.
    pointer = mergeStagePointer(pointer, "ingest");
    emit({ type: "stage:start", runId: input.runId, stage: "ingest", attempt: 1 });
    const ingestStartedAt = deps.now();
    const ingestedValue = await deps.stages.ingest({
      runId: input.runId,
      source: input.source,
      signal: input.signal,
    });
    emit({ type: "stage:done", runId: input.runId, stage: "ingest", ms: deps.now() - ingestStartedAt });

    // From here the run row exists, so every later stage is recorded and a
    // crash is resumable.
    deps.onIngested?.(ingestedValue.manifest);
    const ingested = { value: ingestedValue, hash: input.source };

    // Everything downstream chains from the content hash, so re-running the
    // same file resumes and a different file cannot.
    const sourceHash = ingested.value.manifest.content_sha256 ?? ingested.hash;

    const normalized = await stage("normalize", sourceHash, { hasVideo: ingested.value.manifest.has_video }, () =>
      deps.stages.normalize({
        runId: input.runId,
        manifest: ingested.value.manifest,
        mediaPath: ingested.value.mediaPath,
        signal: input.signal,
      }),
    );

    // Transcription and the visual branch are independent, so they run together
    // — on a long recording the frames are ready by the time whisper finishes.
    //
    // Settled, not `all`: `all` rejects the moment transcription fails and
    // leaves the visual branch running behind it, so the caller closes the
    // database while scene-detect is still working and its ledger write lands
    // on a closed handle ("scene-detect degraded: database is not open"). The
    // stage's real outcome is lost and the user is shown a failure that never
    // happened. Waiting for both means nothing is in flight when this returns.
    const asrRun = 
      stage("asr", normalized.hash, null, () =>
        deps.asr.transcribe({
          runId: input.runId,
          sourceKind: ingested.value.manifest.source_type === "file" ? "file" : "url",
          sourceUri: input.source,
          audioPath: normalized.value.audio_path,
          signal: input.signal,
        }),
      );

    const visualRun = (async () => {
        if (normalized.value.video_path === null) {
          for (const skipped of ["scene-detect", "dedup"] as const) {
            emit({ type: "stage:skipped", runId: input.runId, stage: skipped, why: "the source has no video track" });
          }
          return { raw: 0, kept: 0, dropped: 0 };
        }
        const detected = await stage("scene-detect", normalized.hash, { frameCap: input.frameCap }, () =>
          deps.stages.sceneDetect({
            runId: input.runId,
            videoPath: normalized.value.video_path as string,
            frameCap: input.frameCap,
            signal: input.signal,
          }),
        );
        if (detected.value.rawFrameCount === 0) {
          // An uncut recording is a real answer, not a pending stage.
          emit({ type: "stage:skipped", runId: input.runId, stage: "dedup", why: "no scene changes were detected" });
          return { raw: 0, kept: 0, dropped: 0 };
        }
        const deduped = await stage("dedup", detected.hash, null, () =>
          deps.stages.dedup({ runId: input.runId, signal: input.signal }),
        );
        return {
          raw: detected.value.rawFrameCount,
          kept: deduped.value.keptCount,
          dropped: deduped.value.droppedCount,
        };
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
      });

    const [asrSettled, visualSettled] = await Promise.allSettled([asrRun, visualRun]);
    if (visualSettled.status === "rejected") throw visualSettled.reason;
    if (asrSettled.status === "rejected") throw asrSettled.reason;
    const transcribed = asrSettled.value;
    const visual = visualSettled.value;

    const transcript = transcribed.value;
    await deps.store.put(
      input.runId,
      ARTIFACT_PATHS.transcript,
      `${JSON.stringify({ run_id: input.runId, ...transcript }, null, 2)}\n`,
    );

    emit({ type: "run:done", runId: input.runId, ms: deps.now() });
    return {
      manifest: ingested.value.manifest,
      chainTip: transcribed.hash,
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
