import { randomBytes } from "node:crypto";
import type { Run, RunStatus, SourceManifest, Stage } from "@lirovo/contracts";
import { LirovoError, makeId } from "@lirovo/contracts";
import type { Db } from "./db.js";

/** How long a lease is good for before another process may take the run. */
export const LEASE_MS = 60_000;

export interface RunStore {
  upsertSource(manifest: SourceManifest, uri: string): string;
  /**
   * Create the run row.
   *
   * The id is supplied by the caller because the artifact directory is named
   * after it and is written before the row exists. Minting a second id here
   * would leave the files and the database describing the same run under two
   * different names.
   */
  createRun(id: string, sourceId: string, schemaRevisionId: string | null, owner: string): Run;
  /** Take the run for this process, or refuse if someone else holds it. */
  claim(runId: string, owner: string): boolean;
  renewLease(runId: string, owner: string): boolean;
  finish(runId: string, status: RunStatus, error?: { code: string; message: string }): void;
  setStagePointer(runId: string, stage: Stage): void;
  beginAttempt(runId: string, stage: Stage, inputHash: string): number;
  completeAttempt(
    runId: string,
    stage: Stage,
    attempt: number,
    outcome: { status: "done" | "failed" | "degraded"; output?: unknown; code?: string; message?: string },
  ): void;
  /** The output of the last successful attempt, if the input has not changed. */
  cachedStageOutput(runId: string, stage: Stage, inputHash: string): unknown | null;
  getRun(runId: string): Run | null;
  recordArtifact(runId: string, kind: string, relPath: string, sha256: string, bytes: number, contentType: string): void;
}

const nowS = (): number => Math.floor(Date.now() / 1000);
const newId = (kind: Parameters<typeof makeId>[0]): string => makeId(kind, randomBytes(10));

export const createRunStore = (db: Db): RunStore => ({
  upsertSource(manifest, uri) {
    // Same bytes, same source. Re-ingesting a file the user already annotated
    // should attach the new run to the existing source rather than fork it.
    if (manifest.content_sha256 !== null) {
      const existing = db
        .prepare<[string], { id: string }>("SELECT id FROM sources WHERE content_sha256 = ?")
        .get(manifest.content_sha256);
      if (existing !== undefined) return existing.id;
    }
    const id = newId("source");
    db.prepare(
      `INSERT INTO sources (id, kind, uri, content_sha256, title, duration_s, has_audio, has_video, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      manifest.source_type === "file" ? "file" : "url",
      uri,
      manifest.content_sha256,
      manifest.title,
      manifest.duration_s,
      manifest.has_audio ? 1 : 0,
      manifest.has_video ? 1 : 0,
      nowS(),
    );
    return id;
  },

  createRun(id, sourceId, schemaRevisionId, owner) {
    const at = nowS();
    db.prepare(
      `INSERT INTO runs (id, source_id, schema_revision_id, status, lease_owner, lease_expires_at, created_at, started_at)
       VALUES (?, ?, ?, 'running', ?, ?, ?, ?)`,
    ).run(id, sourceId, schemaRevisionId, owner, at + Math.floor(LEASE_MS / 1000), at, at);
    const run = this.getRun(id);
    if (run === null) throw new LirovoError("INTERNAL", "run vanished immediately after insert");
    return run;
  },

  claim(runId, owner) {
    // An attempt that was in flight when the process died would otherwise stay
    // "running" forever, and any question like "what is still working" would
    // answer with ghosts. Closing them here is the only moment we know for
    // certain that nothing is.
    db.prepare(
      `UPDATE run_stage_attempts
          SET status = 'failed', error_code = 'INTERRUPTED', error_message = 'the process died mid-stage', finished_at = ?
        WHERE run_id = ? AND status = 'running'`,
    ).run(nowS(), runId);

    // One statement, so two processes racing cannot both win: SQLite serialises
    // writers, and the WHERE clause makes the second one match zero rows.
    const result = db
      .prepare(
        `UPDATE runs
            SET status = 'running', lease_owner = ?, lease_expires_at = ?, started_at = COALESCE(started_at, ?)
          WHERE id = ?
            AND status IN ('claimed','running','failed')
            AND (lease_owner IS NULL OR lease_owner = ? OR lease_expires_at < ?)`,
      )
      .run(owner, nowS() + Math.floor(LEASE_MS / 1000), nowS(), runId, owner, nowS());
    return result.changes === 1;
  },

  renewLease(runId, owner) {
    const result = db
      .prepare("UPDATE runs SET lease_expires_at = ? WHERE id = ? AND lease_owner = ?")
      .run(nowS() + Math.floor(LEASE_MS / 1000), runId, owner);
    return result.changes === 1;
  },

  finish(runId, status, error) {
    db.prepare(
      `UPDATE runs SET status = ?, error_code = ?, error_message = ?, finished_at = ?, lease_owner = NULL, lease_expires_at = NULL
        WHERE id = ?`,
    ).run(status, error?.code ?? null, error?.message ?? null, nowS(), runId);
  },

  setStagePointer(runId, stage) {
    db.prepare("UPDATE runs SET stage_pointer = ? WHERE id = ?").run(stage, runId);
  },

  beginAttempt(runId, stage, inputHash) {
    const previous = db
      .prepare<[string, string], { n: number }>(
        "SELECT COALESCE(MAX(attempt), 0) AS n FROM run_stage_attempts WHERE run_id = ? AND stage = ?",
      )
      .get(runId, stage);
    const attempt = (previous?.n ?? 0) + 1;
    db.prepare(
      `INSERT INTO run_stage_attempts (run_id, stage, attempt, input_hash, status, started_at)
       VALUES (?, ?, ?, ?, 'running', ?)`,
    ).run(runId, stage, attempt, inputHash, nowS());
    return attempt;
  },

  completeAttempt(runId, stage, attempt, outcome) {
    db.prepare(
      `UPDATE run_stage_attempts
          SET status = ?, output_json = ?, error_code = ?, error_message = ?, finished_at = ?
        WHERE run_id = ? AND stage = ? AND attempt = ?`,
    ).run(
      outcome.status,
      outcome.output === undefined ? null : JSON.stringify(outcome.output),
      outcome.code ?? null,
      outcome.message ?? null,
      nowS(),
      runId,
      stage,
      attempt,
    );
  },

  cachedStageOutput(runId, stage, inputHash) {
    // The input hash is what makes resume safe. A stage whose inputs changed
    // has to run again, however successful the previous attempt was.
    const row = db
      .prepare<[string, string, string], { output_json: string | null }>(
        `SELECT output_json FROM run_stage_attempts
          WHERE run_id = ? AND stage = ? AND input_hash = ? AND status = 'done'
          ORDER BY attempt DESC LIMIT 1`,
      )
      .get(runId, stage, inputHash);
    if (row?.output_json === undefined || row.output_json === null) return null;
    return JSON.parse(row.output_json) as unknown;
  },

  getRun(runId) {
    const row = db
      .prepare<[string], Record<string, unknown>>("SELECT * FROM runs WHERE id = ?")
      .get(runId);
    return row === undefined ? null : (row as unknown as Run);
  },

  recordArtifact(runId, kind, relPath, sha256, bytes, contentType) {
    db.prepare(
      `INSERT INTO artifacts (id, run_id, kind, rel_path, sha256, bytes, content_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (run_id, rel_path) DO UPDATE SET
         sha256 = excluded.sha256, bytes = excluded.bytes, created_at = excluded.created_at`,
    ).run(newId("artifact"), runId, kind, relPath, sha256, bytes, contentType, nowS());
  },
});
