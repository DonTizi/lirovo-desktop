import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";
import type { InferenceBackend, PipelineEvent } from "@lirovo/contracts";
import { ARTIFACT_PATHS, isLirovoError, makeId, LirovoError } from "@lirovo/contracts";
import {
  planForBudget,
  runExtraction,
  runMediaPipeline,
  type ExtractionResult,
  type MediaPipelineResult,
} from "@lirovo/core";
import {
  DEFAULT_VISION_BATCH,
  DEFAULT_VISION_CONCURRENCY,
  buildAsrChain,
  createStageLedger,
  buildBackends,
  buildInferenceStages,
  buildMediaStages,
  createFsArtifactStore,
  createRunStore,
  openDatabase,
  persistExtraction,
  persistManifest,
  realExec,
  resolvePaths,
  selectBackend,
} from "@lirovo/node-runtime";
import { EXIT, type ExitCode } from "../exit-codes.js";

export const DEFAULT_FRAME_CAP = 2000;

export interface ExtractOptions {
  readonly source: string;
  readonly json: boolean;
  readonly frameCap: number;
  readonly schemaPath: string | null;
  readonly backendId: string | null;
  readonly model: string | null;
  readonly effort: "low" | "medium" | "high" | null;
  /** Wall-clock ceiling for frame description, in seconds. */
  readonly visionBudgetS: number;
  readonly concurrency: number | null;
  /** Continue a run that was interrupted, reusing every stage that finished. */
  readonly resumeRunId: string | null;
}

const humanMs = (ms: number): string => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

/**
 * Progress on stderr, result on stdout.
 *
 * That split is what makes `lirovo extract --json | jq` work while the user
 * still watches the stages go by.
 */
const renderEvent = (event: PipelineEvent): string | null => {
  switch (event.type) {
    case "stage:start":
      return `  ${event.stage} …`;
    case "stage:done":
      return `  ${event.stage} done in ${humanMs(event.ms)}`;
    case "stage:degraded":
      return `  ${event.stage} degraded: ${event.message}`;
    case "stage:resumed":
      return `  ${event.stage} resumed from an earlier attempt`;
    case "stage:progress":
      return `  ${event.stage} ${event.done}/${event.total}${event.note === undefined ? "" : ` ${event.note}`}`;
    default:
      return null;
  }
};

const renderResult = (runId: string, result: MediaPipelineResult): string => {
  const lines: string[] = [];
  lines.push(`run ${runId}`);
  lines.push(`  source     ${result.manifest.source_type}  ${result.manifest.title ?? "(untitled)"}`);
  lines.push(`  duration   ${result.manifest.duration_s.toFixed(1)}s`);
  lines.push(`  transcript ${result.transcript.engine}  ${result.transcript.segments.length} segments  ${result.transcript.text.length} chars`);
  lines.push(
    result.rawFrameCount === 0
      ? "  frames     none"
      : `  frames     ${result.rawFrameCount} detected → ${result.keptFrameCount} kept (${result.droppedFrameCount} near-duplicates dropped)`,
  );
  for (const d of result.degraded) lines.push(`  degraded   ${d.stage}: ${d.message}`);
  return lines.join("\n");
};

/**
 * Did the model stages run?
 *
 * A named guard rather than an inline `in` check: `in` narrows to an
 * intersection that keeps the media type's shape, so every field the
 * extraction adds still reads as missing.
 */
const isExtraction = (result: MediaPipelineResult | ExtractionResult): result is ExtractionResult =>
  "kg" in result;

/**
 * Failures a second attempt could get past.
 *
 * Everything else is a property of the input — a truncated download, an
 * unreadable source, a schema nothing can satisfy — and will fail the same way
 * however many times it runs.
 */
const RESUMABLE: ReadonlySet<string> = new Set([
  "CANCELLED",
  "TIMED_OUT",
  "INFERENCE_FAILED",
  "INFERENCE_TRUNCATED",
  "INFERENCE_QUOTA_EXCEEDED",
  "TRANSCRIBE_FAILED",
  "DOWNLOAD_FAILED",
  "STORE_BUSY",
  "INTERNAL",
]);

const resolveInferenceBackend = async (
  backends: readonly InferenceBackend[],
  wanted: string | null,
): Promise<InferenceBackend> => {
  if (wanted !== null) {
    const chosen = backends.find((b) => b.id === wanted);
    if (chosen === undefined) {
      throw new LirovoError(
        "NO_INFERENCE_BACKEND",
        `no backend called "${wanted}" — run \`lirovo doctor\` to see what this machine has`,
      );
    }
    const probe = await chosen.detect();
    if (!probe.available) {
      throw new LirovoError("NO_INFERENCE_BACKEND", `${wanted} is not available: ${probe.reason ?? "unknown"}`);
    }
    return chosen;
  }
  const auto = await selectBackend(backends, { images: false });
  if (auto === null) {
    throw new LirovoError(
      "NO_INFERENCE_BACKEND",
      "no inference backend available — start a local OpenAI-compatible server or install a supported agent CLI",
    );
  }
  return auto;
};

export const extractCommand = async (
  opts: ExtractOptions,
  out: (s: string) => void,
  errOut: (s: string) => void,
): Promise<ExitCode> => {
  const paths = resolvePaths();
  await mkdir(paths.runs, { recursive: true });
  const store = createFsArtifactStore(paths.runs);
  const db = openDatabase(paths.dbFile);
  const runs = createRunStore(db);
  // The lease owner has to identify a PROCESS, not a machine: the CLI and the
  // desktop app on one laptop are two writers, and "same host" would let them
  // take each other's runs.
  const owner = `${hostname()}:${process.pid}`;

  const controller = new AbortController();
  const onSigint = (): void => {
    errOut("\ncancelling…");
    controller.abort();
  };
  process.once("SIGINT", onSigint);

  const runId: string = opts.resumeRunId ?? makeId("run", randomBytes(10));
  const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

  try {
    if (opts.resumeRunId !== null) {
      if (runs.getRun(opts.resumeRunId) === null) {
        throw new LirovoError("SOURCE_NOT_FOUND", `no run called ${opts.resumeRunId}`);
      }
      // Refuse rather than race: another process may still be working on it,
      // and two pipelines writing one artifact directory corrupt both.
      if (!runs.claim(opts.resumeRunId, owner)) {
        throw new LirovoError("RUN_ALREADY_CLAIMED", `${opts.resumeRunId} is held by another process`);
      }
    }

    const stages = await buildMediaStages({ exec: realExec, store, paths });
    const asr = buildAsrChain({ exec: realExec, paths });

    const onEvent = (event: PipelineEvent): void => {
      const line = renderEvent(event);
      if (line !== null && !opts.json) errOut(line);
    };

    const mediaOnly = opts.schemaPath === null;
    let backend: InferenceBackend | null = null;
    let dataSchema: Record<string, unknown> | null = null;

    const tuning = {
      ...(opts.model !== null ? { model: opts.model } : {}),
      // Describing a frame is perception, not reasoning. The default is the
      // cheapest setting because the measured runs read frames accurately at
      // it, and anything more is billed against the quota the user codes with.
      effort: opts.effort ?? ("low" as const),
    };

    if (!mediaOnly) {
      // Resolve the backend BEFORE any download: discovering there is nothing
      // to reason with after a twenty-minute ingest is the worst moment to
      // find out.
      backend = await resolveInferenceBackend(buildBackends({ exec: realExec, paths, tuning }), opts.backendId);
      dataSchema = JSON.parse(await readFile(opts.schemaPath as string, "utf8")) as Record<string, unknown>;
    }

    const concurrency = opts.concurrency ?? DEFAULT_VISION_CONCURRENCY;
    const budget = planForBudget(opts.visionBudgetS, DEFAULT_VISION_BATCH, concurrency);

    const ledger = createStageLedger(runs, runId);
    const deps = {
      stages,
      asr,
      store,
      now: () => Date.now(),
      onEvent,
      sha256,
      ledger,
      // The run row cannot exist before this: it references a source whose
      // identity is the content hash, which is what ingest computes. From here
      // on every stage is recorded, so a crash is resumable.
      onIngested: (manifest: import("@lirovo/contracts").SourceManifest) => {
        if (opts.resumeRunId !== null) return;
        const sourceId = runs.upsertSource(manifest, opts.source);
        runs.createRun(runId, sourceId, null, owner);
      },
    };
    const input = { runId, source: opts.source, frameCap: opts.frameCap, signal: controller.signal };

    const result: MediaPipelineResult | ExtractionResult = mediaOnly
      ? await runMediaPipeline(input, deps)
      : await runExtraction(
          { ...input, dataSchema: dataSchema as Record<string, unknown> },
          {
            ...deps,
            inference: buildInferenceStages({
              backend: backend as InferenceBackend,
              store,
              // Only when the user did not pick a model themselves.
              ...(opts.model === null
                ? {
                    withModel: (id: string, model: string) =>
                      buildBackends({ exec: realExec, paths, tuning: { ...tuning, model } }).find(
                        (b) => b.id === id,
                      ) ?? null,
                  }
                : {}),
              frameBudget: budget.frameBudget,
              concurrency,
              onVisionBatch: (done, total) =>
                onEvent({ type: "stage:progress", runId, stage: "vision", done, total, note: "sessions" }),
              onWindow: (done, total) =>
                onEvent({ type: "stage:progress", runId, stage: "graph", done, total, note: "windows" }),
            }),
          },
        );

    let persisted = { values: 0, grounded: 0, evidenceRows: 0 };
    if (isExtraction(result)) {
      persisted = persistExtraction(db, {
        runId,
        data: result.data,
        evidenceByField: result.evidenceByField,
      });
      await store.put(runId, ARTIFACT_PATHS.graph, `${JSON.stringify(result.kg, null, 2)}\n`);
      persistManifest(db, {
        runId,
        sourceSha256: result.manifest.content_sha256,
        schemaRevisionId: null,
        schemaJson: JSON.stringify(dataSchema),
        prompts: result.prompts,
        asrEngine: result.transcript.engine,
        asrModel: result.transcript.model,
        inferenceBackend: backend?.id ?? null,
        inferenceModel: null,
        backendVersion: (await backend?.detect())?.version ?? null,
        dependencyVersions: {},
        settings: { frameCap: opts.frameCap },
        createdAt: Math.floor(Date.now() / 1000),
      });
    }
    runs.finish(runId, "succeeded");

    const artifactsDir = path.join(paths.runs, runId);
    if (opts.json) {
      out(
        JSON.stringify(
          {
            ok: true,
            run_id: runId,
            artifacts_dir: artifactsDir,
            source: result.manifest,
            transcript: {
              engine: result.transcript.engine,
              model: result.transcript.model,
              segments: result.transcript.segments.length,
              chars: result.transcript.text.length,
            },
            frames: { detected: result.rawFrameCount, kept: result.keptFrameCount, dropped: result.droppedFrameCount },
            ...(isExtraction(result)
              ? {
                  vision: {
                    frames_described: result.frameAnalyses,
                    sessions: result.visionSessions,
                    frames_skipped_for_budget: result.framesSkippedForBudget,
                  },
                  graph: { nodes: result.kg.nodes.length, edges: result.kg.edges.length, windows: result.graphWindows },
                  values: persisted,
                  data: result.data,
                }
              : {}),
            degraded: result.degraded,
          },
          null,
          2,
        ),
      );
    } else {
      out(renderResult(runId, result));
      if (isExtraction(result)) {
        if (result.visionSessions > 0) {
          const skipped =
            result.framesSkippedForBudget > 0
              ? `, ${result.framesSkippedForBudget} left out for the ${Math.round(opts.visionBudgetS / 60)}min budget — raise with --time-budget`
              : "";
          out(
            `  vision     ${result.frameAnalyses} frames described in ${result.visionSessions} session${result.visionSessions === 1 ? "" : "s"}${skipped}`,
          );
        }
        out(`  graph      ${result.kg.nodes.length} nodes, ${result.kg.edges.length} edges (${result.graphWindows} window${result.graphWindows === 1 ? "" : "s"})`);
        out(`  values     ${persisted.values} extracted, ${persisted.grounded} grounded in ${persisted.evidenceRows} evidence spans`);
      }
      out(`  artifacts  ${artifactsDir}`);
    }
    return EXIT.ok;
  } catch (error) {
    const payload = isLirovoError(error)
      ? error.toJSON()
      : { code: "INTERNAL" as const, message: String(error), context: {} };
    if (opts.json) {
      out(JSON.stringify({ ok: false, run_id: runId, error: payload }, null, 2));
    } else {
      errOut(`${payload.code}: ${payload.message}`);
      // Only when resuming could actually help. A truncated source or a schema
      // the model cannot satisfy will fail identically the second time, and
      // offering a command that cannot work sends the user round a loop.
      if (RESUMABLE.has(payload.code) && runs.getRun(runId) !== null) {
        errOut(`run ${runId} — resume with:  lirovo extract ${opts.source} --resume ${runId}`);
      }
    }
    return payload.code === "CANCELLED"
      ? EXIT.cancelled
      : payload.code === "NO_INFERENCE_BACKEND"
        ? EXIT.unavailable
        : EXIT.failed;
  } finally {
    process.removeListener("SIGINT", onSigint);
    db.close();
  }
};
