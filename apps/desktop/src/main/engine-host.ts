import { createHash, randomBytes } from "node:crypto";
import { recordRunSchema, runCategory } from "./run-category";
import { createExtractionQueue, createQueueWorker } from "./extraction-queue";
import { recoverFinishedReason, persistRecoveredExtraction, requireChosenBackend } from "./extraction-recovery";
import { mkdir, readdir } from "node:fs/promises";
import { hostname } from "node:os";
import { join as pathJoin } from "node:path";
import type { PipelineEvent, RunStatus, SourceManifest } from "@lirovo/contracts";
import { ARTIFACT_PATHS, asLirovoError, makeId, linkedSignal } from "@lirovo/contracts";
import {
  DEFAULT_WHISPER_MODEL_ID,
  DEPENDENCIES,
  YT_DLP,
  planFor,
  planForBudget,
  runDoctor,
  runExtraction,
  runMediaPipeline,
  whisperModelInstallable,
} from "@lirovo/core";
import {
  DEFAULT_VISION_BATCH,
  DEFAULT_VISION_CONCURRENCY,
  buildAsrChain,
  buildAsrStrategies,
  buildBackends,
  buildInferenceStages,
  buildMediaStages,
  createFsArtifactStore,
  createLibraryBackup,
  restoreLibraryBackup,
  setRunArchived,
  archivedRuns,
  createRunStore,
  createRunProcessJournal,
  createTrackedExec,
  createSchemaStore,
  createSettingsStore,
  createStageLedger,
  holdLease,
  installArtifact,
  purgeEverything,
  purgeRuns,
  storageReport,
  isUrl,
  makeAsrProbe,
  makeBinaryProbe,
  observedStatus,
  openDatabase,
  buildRunExport,
  createRunExportFolder,
  reviewValue,
  reviewHistory,
  runReviewSnapshots,
  searchKnowledge,
  compareKnowledge,
  askKnowledge,
  probeMedia,
  realExec,
  resolveBinary,
  resolvePaths,
  runFix,
  sourceTypeOf,
} from "@lirovo/node-runtime";
import type {
  ExtractRequest,
  InstallOutcome,
  Preferences,
  StorageReport,
  RunArtifacts,
  RunDetail,
  RunSummary,
  SourceInspection,
  ValueRow,
} from "./ipc.js";
import { mediaUrl } from "./media-protocol.js";
import type { EngineMessage, EngineRequest } from "./engine-protocol.js";

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

const send = (message: EngineMessage): void => {
  process.parentPort.postMessage(message);
};

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
/**
 * The bundled tools, when this is a packaged app.
 *
 * `resolveBinary` has looked in `paths.bundledBin` since it was written and
 * has never had a value to look in. This is that value: `Contents/Resources/bin`
 * inside the .app, which electron-builder fills from `resources/bin` and signs
 * with the same identity as everything else in the bundle.
 *
 * Null in development, where the tools come from Homebrew and a stale copy
 * under `resources/` would silently shadow the one being worked on.
 * `resolvePaths` still honours `LIROVO_BUNDLED_BIN` over this.
 */
const bundledBin =
  process.resourcesPath !== undefined && !process.resourcesPath.includes("node_modules/electron")
    ? pathJoin(process.resourcesPath, "bin")
    : null;

const paths = resolvePaths(process.env, bundledBin);
let maintenance = false;
const knowledgeRequests = new Map<string, AbortController>();

/**
 * Is an extraction in flight in this process?
 *
 * The durable queue owns the worker's lifetime. Purge deletes the run directory that a
 * live extraction is writing frames into, which leaves artifacts orphaned from
 * their rows in one direction and rows pointing at deleted files in the other.
 */
const extracting = (): boolean => queueWorker.busy();

const withDb = <T>(fn: (db: ReturnType<typeof openDatabase>) => T): T => {
  const db = openDatabase(paths.dbFile);
  try {
    return fn(db);
  } finally {
    db.close();
  }
};
const withDbAsync = async <T>(fn:(db:ReturnType<typeof openDatabase>)=>Promise<T>):Promise<T> => {
  const db = openDatabase(paths.dbFile);
  try { return await fn(db); } finally { db.close(); }
};

const listRuns = (): RunSummary[] =>
  withDb((db) => {
    const rows = db
      .prepare(
        `SELECT r.id AS runId, r.status, s.title, r.created_at AS createdAt,
                r.lease_expires_at AS leaseExpiresAt,
                s.duration_s AS durationS, s.kind AS sourceType,
                sr.name AS schemaName,
                sr.id AS savedSchemaId, m.schema_json AS schemaJson, m.settings_json AS settingsJson,
                (SELECT json_group_array(DISTINCT field_path) FROM extracted_values WHERE run_id = r.id) AS fieldPathsJson,
                (SELECT COUNT(*) FROM extracted_values v WHERE v.run_id = r.id) AS valueCount,
                (SELECT COUNT(DISTINCT ve.observation_id)
                   FROM extracted_values v2
                   JOIN value_evidence ve ON ve.observation_id = v2.observation_id
                  WHERE v2.run_id = r.id) AS groundedCount,
                -- From the stage's own recorded output rather than by counting
                -- files: the frames are written straight to disk and never
                -- registered as artifact rows, so counting rows returns zero
                -- for every run that actually produced hundreds.
                (SELECT json_extract(a.output_json, '$.keptCount')
                   FROM run_stage_attempts a
                  WHERE a.run_id = r.id AND a.stage = 'dedup' AND a.status = 'done'
                  ORDER BY a.attempt DESC LIMIT 1) AS frameCount
           FROM runs r
           JOIN sources s ON s.id = r.source_id
           LEFT JOIN schema_revisions rev ON rev.id = r.schema_revision_id
           LEFT JOIN schemas sr ON sr.id = rev.schema_id
           LEFT JOIN run_manifests m ON m.run_id = r.id
          WHERE NOT EXISTS (SELECT 1 FROM run_archives archive WHERE archive.run_id = r.id)
          ORDER BY r.created_at DESC LIMIT 200`,
      )
      .all() as unknown as (RunSummary & {
        status: RunStatus;
        leaseExpiresAt: number | null;
        savedSchemaId: string | null;
        schemaJson: string | null;
        settingsJson: string | null;
        fieldPathsJson: string;
      })[];
    // Derived on read, never written: a row that says running an hour after its
    // process died is the single most misleading thing this list can show.
    return rows.map(
      ({ leaseExpiresAt, savedSchemaId, schemaJson, settingsJson, fieldPathsJson, ...row }) => ({
        ...row,
        ...runCategory({
          savedSchemaId,
          savedName: row.schemaName,
          schemaJson,
          settingsJson,
          fieldPaths: JSON.parse(fieldPathsJson) as string[],
        }),
        status: observedStatus(row.status, leaseExpiresAt),
      }),
    );
  });

const runDetail = (runId: string): RunDetail | null =>
  withDb((db) => {
    const head = db
      .prepare(
        `SELECT r.id AS runId, r.status, s.title, s.duration_s AS durationS, s.uri AS sourcePath,
                r.error_code AS errorCode, r.error_message AS errorMessage,
                r.lease_expires_at AS leaseExpiresAt
           FROM runs r JOIN sources s ON s.id = r.source_id WHERE r.id = ?`,
      )
      .get(runId) as
      | (Omit<RunDetail, "values" | "transcriptEngine" | "stages" | "status"> & {
          status: RunStatus;
          leaseExpiresAt: number | null;
        })
      | undefined;
    if (head === undefined) return null;

    // Every attempt, not the latest: a stage that failed twice and then passed
    // is a different story from one that passed first time, and the retry is
    // exactly what someone troubleshooting needs to see.
    const stages = db
      .prepare(
        `SELECT stage, attempt, status, error_code AS errorCode, error_message AS errorMessage,
                started_at AS startedAt, finished_at AS finishedAt
           FROM run_stage_attempts WHERE run_id = ? ORDER BY started_at, attempt`,
      )
      .all(runId) as unknown as RunDetail["stages"];

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

    const { leaseExpiresAt, ...rest } = head;
    const reviews = runReviewSnapshots(db, runId);
    return {
      ...rest,
      status: observedStatus(head.status, leaseExpiresAt),
      stages,
      transcriptEngine: engine?.asr_engine ?? null,
      values: rows.map((row) => {
        const review = reviews.get(row.observationId);
        return { ...row, ...(review ? { value: JSON.stringify(review.value), originalValue: review.originalValue, review } : {}),
          evidence: evidence.all(row.observationId) as unknown as ValueRow["evidence"] };
      }),
    };
  });

/**
 * Everything the run wrote, read back for the review surface.
 *
 * Each artifact is optional on purpose. A run that failed at scene-detect still
 * has a transcript worth reading, and a run with no model backend still has
 * frames worth looking at — so a missing file is an absent section, never an
 * error that hides the parts that did survive.
 */
const runArtifacts = async (runId: string): Promise<RunArtifacts> => {
  const store = createFsArtifactStore(paths.runs);
  const readJson = async <T>(key: string): Promise<T | null> => {
    const text = await store.getText(runId, key);
    if (text === null) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      // A half-written artifact is missing, not fatal: the run may have been
      // killed mid-write and every other section still reads.
      return null;
    }
  };

  const [manifest, transcript, framesManifest, vision, graph] = await Promise.all([
    readJson<{ duration_s?: number }>(ARTIFACT_PATHS.sourceManifest),
    readJson<RunArtifacts["transcript"]>(ARTIFACT_PATHS.transcript),
    readJson<{ dedup?: { idx: number; t_ms: number; kept: boolean }[]; raw?: { idx: number; t_ms: number }[] }>(
      ARTIFACT_PATHS.framesManifest,
    ),
    readJson<{ analyses?: RunArtifacts["analyses"] }>(ARTIFACT_PATHS.vision),
    readJson<{ nodes?: Record<string, unknown>[]; edges?: Record<string, unknown>[] }>(ARTIFACT_PATHS.graph),
  ]);

  const videoPath = store.resolve(runId, ARTIFACT_PATHS.video);
  const hasVideo = await store.exists(runId, ARTIFACT_PATHS.video);
  const hasAudio = await store.exists(runId, ARTIFACT_PATHS.audio);

  // Dedup is the list worth showing — the kept frames are the ones the model
  // was actually given — but a run that failed before dedup only has raw.
  const dedup = framesManifest?.dedup ?? [];
  const source = dedup.length > 0 ? dedup : (framesManifest?.raw ?? []).map((f) => ({ ...f, kept: true }));
  const frames = source.map((frame) => ({
    idx: frame.idx,
    tMs: frame.t_ms,
    kept: frame.kept !== false,
    url: mediaUrl(
      store.resolve(runId, dedup.length > 0 ? ARTIFACT_PATHS.dedupFrame(frame.idx) : ARTIFACT_PATHS.rawFrame(frame.idx)),
    ),
  }));

  const qualityReports: NonNullable<RunArtifacts["qualityReports"]>[number][] = [];
  const files = await readdir(store.resolve(runId, ".")).catch((error:NodeJS.ErrnoException) => {
    if(error.code === "ENOENT") return [];
    throw error;
  });
  for (const name of files.filter(name => /^asr-quality-[0-9a-f-]+\.json$/.test(name))) {
    const report = await readJson<{createdAt?:unknown;issues?:unknown;transcript?:{text?:unknown}}>(name);
    if (report && typeof report.createdAt === "string" && Array.isArray(report.issues)
      && report.issues.every(issue => typeof issue === "string") && typeof report.transcript?.text === "string") {
      qualityReports.push({createdAt:report.createdAt,issues:report.issues,text:report.transcript.text});
    }
  }
  qualityReports.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return {
    qualityReports,
    videoUrl: hasVideo ? mediaUrl(videoPath) : null,
    audioUrl: hasAudio ? mediaUrl(store.resolve(runId, ARTIFACT_PATHS.audio)) : null,
    durationS: manifest?.duration_s ?? transcript?.durationS ?? null,
    transcript,
    frames,
    analyses: vision?.analyses ?? [],
    graph: graph === null ? null : { nodes: graph.nodes ?? [], edges: graph.edges ?? [] },
  };
};

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

/**
 * Fetch one of the two dependencies with an official, checksummed artifact.
 *
 * The verification lives in `installArtifact`; this only names what to fetch
 * and forwards the byte count so a 60MB model is not a frozen button.
 */
const install = async (what: "whisper-model" | "yt-dlp", model?: string): Promise<InstallOutcome> => {
  const id = model ?? DEFAULT_WHISPER_MODEL_ID;
  const item = what === "yt-dlp" ? YT_DLP : whisperModelInstallable(id);
  if (item === null) throw asLirovoError(new Error(`nothing known as ${what} ${id}`), "INTERNAL");
  const result = await installArtifact(item, paths, {
    onProgress: (p) => send({ kind: "install-progress", progress: { what, received: p.received, total: p.total } }),
  });
  // A model that was downloaded and then not used is a 574MB no-op. Choosing
  // it IS installing it, so the setting moves with the file.
  if (what === "whisper-model") setWhisperModel(id);
  return { what, path: result.path, bytes: result.bytes, alreadyPresent: result.alreadyPresent };
};

/**
 * Point the loader at the chosen model.
 *
 * `resolveModelPath` reads `LIROVO_WHISPER_MODEL` first, so writing it here is
 * what makes the choice take effect in this process — the setting is the
 * durable record, the variable is how it reaches the code that opens the file.
 */
const setWhisperModel = (id: string): void => {
  withDb((db) => createSettingsStore(db).set("whisper_model", id));
  const spec = whisperModelInstallable(id);
  if (spec !== null) process.env["LIROVO_WHISPER_MODEL"] = pathJoin(paths.data, spec.relPath);
};

const storage = async (): Promise<StorageReport> => withDbAsync((db) => storageReport(paths, db));

/**
 * Delete, for real.
 *
 * Both live in node-runtime so they can be tested against a real filesystem
 * and a real database, which is not something a module that talks to
 * `process.parentPort` can be.
 */
const purge = async (what: "runs" | "everything"): Promise<{ freedBytes: number }> => {
  if (extracting() || knowledgeRequests.size > 0 || queue.list().some((item) => item.status === "queued")) {
    throw asLirovoError(
      new Error("An extraction or knowledge request is active. Stop it before deleting its source data."),
      "STORE_BUSY",
    );
  }
  maintenance = true;
  queueDb.close();
  try {
    return await withDbAsync((db) => what === "everything" ? purgeEverything(paths, db) : purgeRuns(paths, db));
  } finally {
    queueDb = openDatabase(paths.dbFile);
    queue = createExtractionQueue(queueDb);
    queueWorker = createQueueWorker(queue, executeExtraction);
    maintenance = false;
  }
};

const preferences = (): Preferences =>
  withDb((db) => {
    const settings = createSettingsStore(db);
    return {
      defaultBackendId: settings.get("default_backend"),
      whisperModelId: settings.get("whisper_model"),
      // Stable unless someone opted in. A preview build is a thing you choose,
      // never a thing you are moved onto.
      updateChannel: settings.get("update_channel") === "beta" ? "beta" : "latest",
      onboarded: settings.get("onboarded") === "1",
      // Anything unrecognised — a row from a later version, a corrupted one —
      // reads as `system`. Following the machine is the answer that is never
      // surprising; guessing a palette would be.
      theme: readTheme(settings.get("theme")),
    };
  });

/** The stored string, narrowed. Unknown values follow the machine. */
const readTheme = (raw: string | null): Preferences["theme"] =>
  raw === "light" || raw === "dark" ? raw : "system";

/** Set once, by the first-run screen, and never unset from the UI. */
const markOnboarded = (): Preferences => {
  withDb((db) => createSettingsStore(db).set("onboarded", "1"));
  return preferences();
};

/**
 * Install one of the things this app knows about, named by id.
 *
 * The id is resolved to a command HERE, against `FIXES`, and never carried
 * across the bridge. An unknown id runs nothing: the window can name what this
 * app ships and nothing else, which is the whole reason this is safe to have
 * at all.
 */
const installByFixId = async (fixId: string): Promise<{
  readonly ok: boolean;
  readonly code: number | null;
  readonly output: string;
  readonly homepage: string | null;
}> => {
  const plan = planFor(fixId);
  if (plan === null) {
    throw asLirovoError(new Error(`nothing known to install for "${fixId}"`), "HARNESS_NOT_FOUND");
  }
  const outcome = await runFix(plan.command);
  return { ...outcome, homepage: plan.homepage };
};

// On boot, honour the model the user chose last time.
{
  const chosen = preferences().whisperModelId;
  if (chosen !== null) setWhisperModel(chosen);
}

const setDefaultBackend = (backendId: string | null): Preferences => {
  withDb((db) => createSettingsStore(db).set("default_backend", backendId));
  return preferences();
};

const doctor = async (): Promise<unknown> => {
  const probe = makeBinaryProbe(paths, realExec);
  const report = await runDoctor({
    paths,
    dependencies: DEPENDENCIES,
    probeBinary: probe,
    backends: buildBackends({ exec: realExec, paths }),
    probeAsr: makeAsrProbe(buildAsrStrategies({ exec: realExec, paths }), paths),
  });
  // The choice rides along with the probe that found the candidates: two round
  // trips would let the panel paint a default that the next answer contradicts.
  return { ...report, ...preferences() };
};

const executeExtraction = async (runId: string, request: ExtractRequest, parentSignal: AbortSignal): Promise<unknown> => {
  await mkdir(paths.runs, { recursive: true });
  const db = openDatabase(paths.dbFile);
  const owner = `${hostname()}:${process.pid}:${randomBytes(8).toString("hex")}`;
  const runs = createRunStore(db, owner);
  const journal = createRunProcessJournal(db, runId, owner);
  const store = createFsArtifactStore(paths.runs, journal.publish);
  const exec = createTrackedExec({ onSpawn: journal.record });
  let ownsRun = false;
  const existing = runs.getRun(runId);
  const cancellation = linkedSignal(parentSignal);
  const signal = cancellation.signal;
  const lostLease = (): void => { ownsRun = false; cancellation.abort(); };
  // A holder, not a `let`: the assignment happens inside `onIngested`, and
  // TypeScript will not carry a closure's assignment out to the `finally`.
  const lease: { release: (() => void) | null } = { release: null };

  try {
    if (signal.aborted) throw asLirovoError(new Error("Extraction cancelled."), "CANCELLED");
    if (existing !== null) {
      if (!runs.claim(runId, owner)) throw asLirovoError(new Error("This extraction is still held by another process. Wait for its lease to expire before resuming."), "RUN_ALREADY_CLAIMED");
      ownsRun = true;
      lease.release = holdLease(runs, runId, owner, lostLease);
      // Final values commit atomically; recovering the acknowledgement does
      // not require ingest, speech or model calls, nor new observation IDs.
      const committed = recoverFinishedReason(db, runId, owner);
      if (committed !== null) {
        // The graph file is written after reasoning, so a crash immediately
        // after the reason ledger commit can leave only its SQLite copy.
        if (!(await store.exists(runId, ARTIFACT_PATHS.graph))) {
          const recorded = db.prepare<[string], { output_json: string | null }>(
            "SELECT output_json FROM run_stage_attempts WHERE run_id = ? AND stage = 'graph' AND status = 'done' ORDER BY attempt DESC LIMIT 1",
          ).get(runId);
          if (recorded?.output_json) {
            const graph = JSON.parse(recorded.output_json) as { kg?: unknown };
            if (graph.kg !== undefined) await store.put(runId, ARTIFACT_PATHS.graph, `${JSON.stringify(graph.kg, null, 2)}\n`);
          }
        }
        if (signal.aborted) throw asLirovoError(new Error("Extraction cancelled."), "CANCELLED");
        runs.finish(runId, "succeeded");
        return { runId, ...committed };
      }
    }
    const stages = await buildMediaStages({ exec, store, paths });
    const asr = buildAsrChain({ exec, paths, language: request.language ?? "auto", allowRemote: request.allowRemoteAsr === true });
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
        if (existing !== null) {
          const prior = db.prepare<[string], { content_sha256: string | null }>(
            "SELECT s.content_sha256 FROM sources s JOIN runs r ON r.source_id = s.id WHERE r.id = ?",
          ).get(runId);
          if (prior?.content_sha256 !== null && prior?.content_sha256 !== manifest.content_sha256)
            throw new Error("The source changed since this extraction. Start a new extraction to keep its evidence intact.");
          return;
        }
        const sourceId = runs.upsertSource(manifest, request.source);
        // The revision is what makes the result explainable later: without it a
        // run cannot say what it was asked for.
        runs.createRun(runId, sourceId, request.schemaRevisionId ?? null, owner);
        ownsRun = true;
        recordRunSchema(db, runId, request);
        // The lease is good for a minute and a run takes six. Held from the
        // moment the row exists until the `finally` below, or the library
        // reads a working extraction as stopped and another process is free
        // to claim it.
        lease.release = holdLease(runs, runId, owner, lostLease);
      },
    };

    const input = { runId, source: request.source, frameCap: 2000, signal, language: request.language ?? "auto" };

    if (request.schemaJson === null) {
      const media = await runMediaPipeline(input, deps);
      if (signal.aborted) throw asLirovoError(new Error("Extraction cancelled."), "CANCELLED");
      runs.finish(runId, "succeeded");
      return { runId, frames: media.keptFrameCount, values: 0, grounded: 0 };
    }

    const tuning = { effort: "low" as const };
    const backends = buildBackends({ exec, paths, tuning });
    // The selection is frozen when enqueued; recovery never changes providers.
    const backend = await requireChosenBackend(backends, request.backendId);

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

    if (signal.aborted) throw asLirovoError(new Error("Extraction cancelled before saving results."), "CANCELLED");

    // persistExtraction commits all values atomically. A crash between that
    // commit and finish must not add another copy or discard human corrections.
    const persisted = persistRecoveredExtraction(db, {
        runId, owner, data: result.data, evidenceByField: result.evidenceByField,
      });
    runs.finish(runId, "succeeded");
    return { runId, frames: result.frameAnalyses, values: persisted.values, grounded: persisted.grounded };
  } catch (error) {
    const lirovo = asLirovoError(error);
    // The row may not exist yet if this died during ingest, in which case
    // finishing it updates nothing rather than raising a second failure.
    if (ownsRun) runs.finish(runId, lirovo.code === "CANCELLED" ? "cancelled" : "failed", {
      code: lirovo.code,
      message: lirovo.message,
    });
    throw lirovo;
  } finally {
    cancellation.abort();
    lease.release?.();
    cancellation.dispose();
    try { journal.release(); } finally { db.close(); }
  }
};

// Keep one queue connection. All requests are committed before a worker starts,
// including failures before ingest (when no runs row can exist yet).
let queueDb = openDatabase(paths.dbFile);
let queue = createExtractionQueue(queueDb);
queue.recover();
let queueWorker = createQueueWorker(queue, executeExtraction);
const extract = (request: ExtractRequest): { runId: string } => {
  const runId = makeId("run", randomBytes(10));
  const backendId = request.backendId ?? preferences().defaultBackendId;
  if (request.schemaJson !== null && backendId === null)
    throw asLirovoError(new Error("Choose an inference backend in Settings first. Lirovo never selects a remote provider for you."), "NO_INFERENCE_BACKEND");
  queue.enqueue(runId, { ...request, backendId });
  void queueWorker.wake();
  return { runId };
};

const resumeRun = (runId: string): { runId: string } => {
  if (queue.get(runId) !== undefined) queue.resume(runId);
  else {
    // Older desktop runs predate the queue. Recover only a recorded contract,
    // never guess a schema from the output fields.
    const saved = withDb((db) => db.prepare<[string], { source: string; schemaJson: string | null;
      schemaRevisionId: string | null; settingsJson: string; backendId: string | null; status: string }>(
      `SELECT s.uri AS source, m.schema_json AS schemaJson, r.schema_revision_id AS schemaRevisionId,
        m.settings_json AS settingsJson, m.inference_backend AS backendId, r.status
        FROM runs r JOIN sources s ON s.id = r.source_id JOIN run_manifests m ON m.run_id = r.id WHERE r.id = ?`,
    ).get(runId));
    if (!saved || saved.status === "succeeded") throw new Error("This extraction cannot be resumed. Start a new extraction with its source and schema.");
    const settings = JSON.parse(saved.settingsJson) as Record<string, unknown>;
    if (saved.schemaJson === null && settings.transcriptOnly !== true)
      throw new Error("The original schema was not recorded. Choose the source and schema for a new extraction.");
    const backendId = saved.backendId ?? preferences().defaultBackendId;
    if (saved.schemaJson !== null && backendId === null)
      throw new Error("Choose a backend in Settings before resuming this extraction.");
    queue.enqueue(runId, { source: saved.source, schemaJson: saved.schemaJson, schemaRevisionId: saved.schemaRevisionId,
      backendId, schemaName: typeof settings.schemaName === "string" ? settings.schemaName : null,
      language: typeof settings.language === "string" ? settings.language : "auto", allowRemoteAsr: false });
  }
  void queueWorker.wake();
  return { runId };
};

const handle = async (message: EngineRequest): Promise<unknown> => {
  if (maintenance) throw asLirovoError(new Error("Storage maintenance is in progress. Try again after it finishes."), "STORE_BUSY");
  switch (message.type) {
    case "archiveRun":
      withDb(db=>setRunArchived(db,message.runId,message.archived));
      return {saved:true};
    case "archivedRuns":
      return withDb(archivedRuns);
    case "backupLibrary":
    case "exportRunFolder":
    case "restoreLibrary": {
      if (extracting() || knowledgeRequests.size > 0 || queue.list().some(item=>item.status==="queued")) {
        throw new Error("Stop active extractions and knowledge requests before transferring the library.");
      }
      maintenance = true;
      try {
        if (message.type === "exportRunFolder") return await createRunExportFolder(paths, message.runId, message.destination, message.protectedRoots);
        return message.type === "backupLibrary"
          ? await createLibraryBackup(paths,message.destination)
          : await restoreLibraryBackup(message.backupDirectory,message.destination);
      } finally { maintenance = false; }
    }
    case "askKnowledge": {
      if (knowledgeRequests.size > 0) throw asLirovoError(new Error("A knowledge answer is already in progress. Cancel it or wait before asking again."), "STORE_BUSY");
      const controller = new AbortController();
      // Register before the first await so cancellation during detection is not lost.
      knowledgeRequests.set(message.input.requestId, controller);
      let db: ReturnType<typeof openDatabase> | null = null;
      try {
        const backend = await requireChosenBackend(buildBackends({ exec: realExec, paths, tuning: { effort: "low" } }), message.input.backendId);
        if (controller.signal.aborted) throw asLirovoError(new Error("Knowledge answer cancelled."), "CANCELLED");
        db = openDatabase(paths.dbFile);
        return await askKnowledge(db, message.input, { backend, signal: controller.signal });
      } finally {
        db?.close();
        knowledgeRequests.delete(message.input.requestId);
      }
    }
    case "cancelKnowledge": {
      const controller = knowledgeRequests.get(message.requestId);
      controller?.abort();
      return { cancelled: controller !== undefined };
    }
    case "extract":
      return extract(message.request);
    case "cancel":
      return { cancelled: queueWorker.cancel() };
    case "listQueue":
      if (queueWorker.failure() !== null) throw new Error(queueWorker.failure()!);
      return queue.list();
    case "reviewValue":
      return withDb((db) => reviewValue(db, message.input));
    case "reviewHistory":
      return withDb((db) => reviewHistory(db, message.runId, message.observationId));
    case "searchKnowledge":
      return withDb((db) => searchKnowledge(db, message.input));
    case "compareKnowledge":
      return withDb((db) => compareKnowledge(db, message.runIds, message.approvedOnly));
    case "exportRun":
      return withDb((db) => buildRunExport(db, message.runId, message.options));
    case "cancelQueuedRun":
      if (!queueWorker.cancel(message.runId)) throw asLirovoError(new Error("This extraction cannot be cancelled here. It may still be held by another process; wait for it to stop."), "STORE_BUSY");
      return { cancelled: true };
    case "resumeRun":
      return resumeRun(message.runId);
    case "doctor":
      return doctor();
    case "listRuns":
      return listRuns();
    case "runDetail":
      return runDetail(message.runId);
    case "inspect":
      return inspect(message.source);
    case "listSchemas":
      return withDb((db) => createSchemaStore(db).list());
    case "saveSchema":
      return withDb((db) => createSchemaStore(db).save(message.input));
    case "schemaRevisions":
      return withDb((db) => createSchemaStore(db).revisions(message.schemaId));
    case "runArtifacts":
      return runArtifacts(message.runId);
    case "install":
      return install(message.what, message.model);
    case "storage":
      return storage();
    case "purge":
      return purge(message.what);
    case "markOnboarded":
      return markOnboarded();
    case "runFix":
      return installByFixId(message.fixId);
    case "preferences":
      return preferences();
    case "setUpdateChannel":
      withDb((db) => createSettingsStore(db).set("update_channel", message.channel));
      return preferences();
    case "setTheme":
      // The choice, not the palette it resolves to. Storing "dark" for someone
      // on `system` would pin them there the first time their Mac was dark.
      withDb((db) => createSettingsStore(db).set("theme", message.theme));
      return preferences();
    case "setDefaultBackend":
      return setDefaultBackend(message.backendId);
    case "archiveSchema":
      return withDb((db) => {
        createSchemaStore(db).archive(message.schemaId);
        return { archived: true };
      });
  }
};

process.parentPort.on("message", (wrapper) => {
  const message = wrapper.data as EngineRequest;
  handle(message)
    .then((value) => send({ kind: "result", id: message.id, value }))
    .catch((error: unknown) => {
      const lirovo = asLirovoError(error);
      send({ kind: "error", id: message.id, error: { code: lirovo.code, message: lirovo.message } });
    });
});
