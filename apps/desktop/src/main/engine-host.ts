import { createHash, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { hostname } from "node:os";
import type { PipelineEvent, SourceManifest } from "@lirovo/contracts";
import { asLirovoError, makeId } from "@lirovo/contracts";
import { DEPENDENCIES, planForBudget, runDoctor, runExtraction, runMediaPipeline } from "@lirovo/core";
import {
  DEFAULT_VISION_BATCH,
  DEFAULT_VISION_CONCURRENCY,
  buildAsrChain,
  buildAsrStrategies,
  buildBackends,
  buildInferenceStages,
  buildMediaStages,
  createFsArtifactStore,
  createRunStore,
  createStageLedger,
  isUrl,
  makeAsrProbe,
  makeBinaryProbe,
  openDatabase,
  persistExtraction,
  probeMedia,
  realExec,
  resolveBinary,
  resolvePaths,
  selectBackend,
  sourceTypeOf,
} from "@lirovo/node-runtime";
import type { ExtractRequest, RunDetail, RunSummary, SourceInspection, ValueRow } from "./ipc.js";

/**
 * The engine, in its own process.
 *
 * Everything runs out here, including the database reads — not just the heavy
 * stages. `better-sqlite3` is synchronous, the perceptual hash is a CPU loop
 * over every frame, and ffmpeg is spawned repeatedly; any one of those stalls a
 * main process, and a native crash takes the window down with it. Keeping the
 * reads out here too is what makes "the main process only supervises" a
 * property rather than a slogan.
 */

type Inbound =
  | { id: string; type: "extract"; request: ExtractRequest }
  | { id: string; type: "cancel" }
  | { id: string; type: "doctor" }
  | { id: string; type: "listRuns" }
  | { id: string; type: "runDetail"; runId: string }
  | { id: string; type: "inspect"; source: string };

type Outbound =
  | { kind: "event"; event: PipelineEvent }
  | { kind: "result"; id: string; value: unknown }
  | { kind: "error"; id: string; error: { code: string; message: string } };

const send = (message: Outbound): void => {
  process.parentPort.postMessage(message);
};

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const paths = resolvePaths();

let controller: AbortController | null = null;

const withDb = <T>(fn: (db: ReturnType<typeof openDatabase>) => T): T => {
  const db = openDatabase(paths.dbFile);
  try {
    return fn(db);
  } finally {
    db.close();
  }
};

const listRuns = (): RunSummary[] =>
  withDb((db) =>
    db
      .prepare(
        `SELECT r.id AS runId, r.status, s.title, r.created_at AS createdAt,
                (SELECT COUNT(*) FROM extracted_values v WHERE v.run_id = r.id) AS valueCount
           FROM runs r JOIN sources s ON s.id = r.source_id
          ORDER BY r.created_at DESC LIMIT 50`,
      )
      .all() as unknown as RunSummary[],
  );

const runDetail = (runId: string): RunDetail | null =>
  withDb((db) => {
    const head = db
      .prepare(
        `SELECT r.id AS runId, r.status, s.title, s.duration_s AS durationS, s.uri AS sourcePath
           FROM runs r JOIN sources s ON s.id = r.source_id WHERE r.id = ?`,
      )
      .get(runId) as Omit<RunDetail, "values" | "transcriptEngine"> | undefined;
    if (head === undefined) return null;

    const engine = db.prepare("SELECT asr_engine FROM run_manifests WHERE run_id = ?").get(runId) as
      | { asr_engine: string | null }
      | undefined;

    const rows = db
      .prepare(
        `SELECT v.observation_id AS observationId, v.field_path AS fieldPath, v.value_json AS value,
                COALESCE(sg.review_priority, 0) AS reviewPriority
           FROM extracted_values v
           LEFT JOIN review_signals sg ON sg.observation_id = v.observation_id
          WHERE v.run_id = ? ORDER BY v.field_path`,
      )
      .all(runId) as Omit<ValueRow, "evidence">[];

    const evidence = db.prepare(
      `SELECT e.source_ref AS sourceRef, e.modality, e.t_start AS tStart, e.t_end AS tEnd, e.quote
         FROM value_evidence ve JOIN evidence e ON e.id = ve.evidence_id
        WHERE ve.observation_id = ? ORDER BY e.t_start`,
    );

    return {
      ...head,
      transcriptEngine: engine?.asr_engine ?? null,
      values: rows.map((row) => ({ ...row, evidence: evidence.all(row.observationId) as unknown as ValueRow["evidence"] })),
    };
  });

/**
 * Recognise a source without downloading or transcoding it.
 *
 * Two speeds on purpose. A local file is probed straight away — ffprobe reads a
 * header in milliseconds. A URL is classified from its hostname instantly and
 * its title fetched after, because that costs a network round trip and the
 * field should acknowledge the paste immediately rather than sit blank for five
 * seconds looking broken.
 */
const inspect = async (source: string): Promise<SourceInspection> => {
  const { stat } = await import("node:fs/promises");
  const path = await import("node:path");

  if (isUrl(source)) {
    const label = sourceTypeOf(source);
    const ytDlp = await resolveBinary("yt-dlp", paths);
    if (ytDlp === null) {
      return { kind: "url", label, title: null, durationS: null, bytes: null, problem: "yt-dlp is not installed" };
    }
    try {
      const { stdout } = await realExec(
        ytDlp.path,
        ["--skip-download", "--no-playlist", "--no-warnings", "--no-update", "--print", "%(title)s|%(duration)s", source],
        { timeoutMs: 20_000 },
      );
      const [title = "", duration = ""] = (stdout.trim().split("\n").pop() ?? "").split("|");
      const seconds = Number(duration);
      return {
        kind: "url",
        label,
        title: title === "" || title === "NA" ? null : title,
        durationS: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
        bytes: null,
        problem: null,
      };
    } catch (error) {
      return {
        kind: "url",
        label,
        title: null,
        durationS: null,
        bytes: null,
        problem: error instanceof Error ? error.message.split("\n")[0] ?? "unreachable" : "unreachable",
      };
    }
  }

  const resolved = path.resolve(source);
  const ffprobe = await resolveBinary("ffprobe", paths);
  try {
    const info = await stat(resolved);
    const probe = ffprobe === null ? null : await probeMedia(realExec, ffprobe.path, resolved).catch(() => null);
    return {
      kind: "file",
      label: (path.extname(resolved).replace(".", "") || "file").toUpperCase(),
      title: path.basename(resolved),
      durationS: probe?.durationS ?? null,
      bytes: info.size,
      problem: probe === null ? "this file is not readable media" : null,
    };
  } catch {
    return { kind: "file", label: "file", title: null, durationS: null, bytes: null, problem: "no such file" };
  }
};

const doctor = async (): Promise<unknown> => {
  const probe = makeBinaryProbe(paths, realExec);
  return runDoctor({
    paths,
    dependencies: DEPENDENCIES,
    probeBinary: probe,
    backends: buildBackends({ exec: realExec, paths }),
    probeAsr: makeAsrProbe(buildAsrStrategies({ exec: realExec, paths }), paths),
  });
};

const extract = async (request: ExtractRequest): Promise<unknown> => {
  await mkdir(paths.runs, { recursive: true });
  const store = createFsArtifactStore(paths.runs);
  const db = openDatabase(paths.dbFile);
  const runs = createRunStore(db);
  const runId: string = makeId("run", randomBytes(10));
  const owner = `${hostname()}:${process.pid}`;

  controller = new AbortController();
  const signal = controller.signal;

  try {
    const stages = await buildMediaStages({ exec: realExec, store, paths });
    const asr = buildAsrChain({ exec: realExec, paths });
    const onEvent = (event: PipelineEvent): void => send({ kind: "event", event });

    const deps = {
      stages,
      asr,
      store,
      now: () => Date.now(),
      onEvent,
      sha256,
      ledger: createStageLedger(runs, runId),
      onIngested: (manifest: SourceManifest) => {
        const sourceId = runs.upsertSource(manifest, request.source);
        runs.createRun(runId, sourceId, null, owner);
      },
    };

    const input = { runId, source: request.source, frameCap: 2000, signal };

    if (request.schemaJson === null) {
      const media = await runMediaPipeline(input, deps);
      runs.finish(runId, "succeeded");
      return { runId, frames: media.keptFrameCount, values: 0, grounded: 0 };
    }

    const tuning = { effort: "low" as const };
    const backends = buildBackends({ exec: realExec, paths, tuning });
    const backend =
      request.backendId === null
        ? await selectBackend(backends, { images: false })
        : (backends.find((b) => b.id === request.backendId) ?? null);
    if (backend === null) {
      throw asLirovoError(new Error("no inference backend available"), "NO_INFERENCE_BACKEND");
    }

    const budget = planForBudget(15 * 60, DEFAULT_VISION_BATCH, DEFAULT_VISION_CONCURRENCY);
    const result = await runExtraction(
      { ...input, dataSchema: JSON.parse(request.schemaJson) as Record<string, unknown> },
      {
        ...deps,
        inference: buildInferenceStages({
          backend,
          store,
          frameBudget: budget.frameBudget,
          onVisionBatch: (done, total) =>
            onEvent({ type: "stage:progress", runId, stage: "vision", done, total, note: "sessions" }),
        }),
      },
    );

    const persisted = persistExtraction(db, {
      runId,
      data: result.data,
      evidenceByField: result.evidenceByField,
    });
    runs.finish(runId, "succeeded");
    return { runId, frames: result.frameAnalyses, values: persisted.values, grounded: persisted.grounded };
  } catch (error) {
    const lirovo = asLirovoError(error);
    // The row may not exist yet if this died during ingest, in which case
    // finishing it updates nothing rather than raising a second failure.
    runs.finish(runId, lirovo.code === "CANCELLED" ? "cancelled" : "failed", {
      code: lirovo.code,
      message: lirovo.message,
    });
    throw lirovo;
  } finally {
    controller = null;
    db.close();
  }
};

const handle = async (message: Inbound): Promise<unknown> => {
  switch (message.type) {
    case "extract":
      return extract(message.request);
    case "cancel":
      controller?.abort();
      return { cancelled: controller !== null };
    case "doctor":
      return doctor();
    case "listRuns":
      return listRuns();
    case "runDetail":
      return runDetail(message.runId);
    case "inspect":
      return inspect(message.source);
  }
};

process.parentPort.on("message", (wrapper) => {
  const message = wrapper.data as Inbound;
  handle(message)
    .then((value) => send({ kind: "result", id: message.id, value }))
    .catch((error: unknown) => {
      const lirovo = asLirovoError(error);
      send({ kind: "error", id: message.id, error: { code: lirovo.code, message: lirovo.message } });
    });
});
