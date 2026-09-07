import type { Db } from "@lirovo/node-runtime";
import { asLirovoError } from "@lirovo/contracts";
import type { ExtractRequest, QueueItem } from "../bridge/contract";
import { runCategory } from "./run-category";
import { hostname } from "node:os";

type StoredItem = Omit<QueueItem, "source" | "schemaName" | "schemaKey"> & { requestJson: string };

/** Requests exist before ingest creates a source. Never foreign-key them to runs. */
export function createExtractionQueue(db: Db) {
  const get = (runId: string): StoredItem | undefined => db.prepare<[string], StoredItem>(
    `SELECT run_id AS runId, request_json AS requestJson, status, created_at AS createdAt,
      updated_at AS updatedAt, error FROM extraction_queue WHERE run_id = ?`,
  ).get(runId);
  const list = (): QueueItem[] => db.prepare<[], StoredItem>(
    `SELECT run_id AS runId, request_json AS requestJson, status, created_at AS createdAt,
      updated_at AS updatedAt, error FROM extraction_queue q
      WHERE NOT EXISTS (SELECT 1 FROM run_archives a WHERE a.run_id = q.run_id)
      ORDER BY created_at, rowid`,
  ).all().map(({ requestJson, ...item }) => {
    const request = JSON.parse(requestJson) as ExtractRequest;
    const saved = request.schemaRevisionId ? db.prepare<[string], { id: string; name: string }>(
      "SELECT s.id, s.name FROM schemas s JOIN schema_revisions r ON r.schema_id = s.id WHERE r.id = ?",
    ).get(request.schemaRevisionId) : undefined;
    return { ...item, source: request.source, ...runCategory({ savedSchemaId: saved?.id ?? null,
      savedName: saved?.name ?? null, schemaJson: request.schemaJson, fieldPaths: [],
      settingsJson: JSON.stringify({ schemaName: request.schemaName, transcriptOnly: request.schemaJson === null }) }) };
  });
  return {
    get,
    list,
    enqueue(runId: string, request: ExtractRequest): void {
      const now = Date.now();
      db.prepare(`INSERT INTO extraction_queue (run_id, request_json, status, created_at, updated_at, error)
        VALUES (?, ?, 'queued', ?, ?, NULL)`).run(runId, JSON.stringify(request), now, now);
    },
    /** A restart never grants permission to invoke a provider. Even waiting work is held. */
    recover(): void {
      db.prepare(`UPDATE extraction_queue SET status = 'interrupted', updated_at = ?,
        error = 'Lirovo stopped. Resume when you are ready.' WHERE status IN ('running', 'queued')`).run(Date.now());
      // The process can die between the durable run commit and queue acknowledgement.
      db.prepare(`UPDATE extraction_queue SET status = 'succeeded', error = NULL
        WHERE status = 'interrupted' AND run_id IN (SELECT id FROM runs WHERE status = 'succeeded')`).run();
      for (const row of db.prepare<[], { id: string; lease_owner: string }>(
        `SELECT r.id, r.lease_owner FROM runs r JOIN extraction_queue q ON q.run_id = r.id
          WHERE q.status = 'interrupted' AND r.lease_owner IS NOT NULL`,
      ).all()) {
        const prefix = `${hostname()}:`;
        if (!row.lease_owner.startsWith(prefix)) continue;
        const pid = Number(row.lease_owner.replace(prefix, "").split(":")[0]);
        if (!Number.isInteger(pid) || pid <= 0) continue;
        let dead = false;
        try { process.kill(pid, 0); } catch (error) { dead = (error as NodeJS.ErrnoException).code === "ESRCH"; }
        if (dead) db.prepare("UPDATE runs SET lease_expires_at = 0 WHERE id = ? AND lease_owner = ?")
          .run(row.id, row.lease_owner);
      }
    },
    claimNext(): StoredItem | undefined {
      let claimed: StoredItem | undefined;
      db.transaction(() => {
        const row = db.prepare<[], { run_id: string }>(
          "SELECT run_id FROM extraction_queue WHERE status = 'queued' ORDER BY created_at, rowid LIMIT 1",
        ).get();
        if (row === undefined) return;
        db.prepare("UPDATE extraction_queue SET status = 'running', updated_at = ?, error = NULL WHERE run_id = ?")
          .run(Date.now(), row.run_id);
        claimed = get(row.run_id);
      }).immediate();
      return claimed;
    },
    finish(runId: string, status: "succeeded" | "failed" | "cancelled", error: string | null = null): void {
      db.prepare("UPDATE extraction_queue SET status = ?, updated_at = ?, error = ? WHERE run_id = ? AND status = 'running'")
        .run(status, Date.now(), error, runId);
    },
    cancelWaiting(runId: string): boolean {
      let cancelled = false;
      db.transaction(() => {
        const lease = db.prepare<[string], { lease_expires_at: number | null }>("SELECT lease_expires_at FROM runs WHERE id = ?").get(runId);
        if ((lease?.lease_expires_at ?? 0) > Date.now() / 1000) return;
        cancelled = db.prepare(`UPDATE extraction_queue SET status = 'cancelled', updated_at = ?, error = NULL
          WHERE run_id = ? AND status IN ('queued', 'interrupted', 'failed')`).run(Date.now(), runId).changes === 1;
        if (cancelled) db.prepare(`UPDATE runs SET status = 'cancelled', lease_owner = NULL, lease_expires_at = NULL,
          finished_at = ?, error_code = NULL, error_message = NULL WHERE id = ? AND status != 'succeeded'`)
          .run(Math.floor(Date.now() / 1000), runId);
      }).immediate();
      return cancelled;
    },
    resume(runId: string): void {
      const changed = db.prepare(`UPDATE extraction_queue SET status = 'queued', updated_at = ?, error = NULL
        WHERE run_id = ? AND status IN ('interrupted', 'failed', 'cancelled')`).run(Date.now(), runId);
      if (changed.changes !== 1) throw new Error("This extraction is not available to resume.");
    },
  };
}

/** One promise owns the pump; enqueuing during a run cannot steal its cancellation. */
export function createQueueWorker(
  queue: ReturnType<typeof createExtractionQueue>,
  execute: (runId: string, request: ExtractRequest, signal: AbortSignal) => Promise<unknown>,
  changed: () => void = () => {},
) {
  let active: { runId: string; controller: AbortController } | null = null;
  let pump: Promise<void> | null = null;
  let failure: string | null = null;
  const wake = (): Promise<void> => {
    if (pump !== null) return pump;
    if (failure !== null) return Promise.resolve();
    pump = (async () => {
      for (;;) {
        const item = queue.claimNext();
        if (item === undefined) break;
        active = { runId: item.runId, controller: new AbortController() };
        changed();
        let status: "succeeded" | "failed" | "cancelled" = "succeeded";
        let message: string | null = null;
        try {
          try {
            await execute(item.runId, JSON.parse(item.requestJson) as ExtractRequest, active.controller.signal);
          } catch (error) {
            const failure = asLirovoError(error);
            status = active.controller.signal.aborted || failure.code === "CANCELLED" ? "cancelled" : "failed";
            message = failure.message;
          }
          // An acknowledgement failure is a queue fault, never evidence that
          // successfully committed extraction work itself failed.
          queue.finish(item.runId, status, message);
        } finally {
          active = null;
          changed();
        }
      }
    })().catch((error: unknown) => {
      // A failed queue write is not an extraction failure we can safely mark
      // complete. Keep its durable request, stop the pump, surface the fault.
      failure = `The queue could not save its state. Restart Lirovo to recover safely. ${String(error)}`;
    }).finally(() => { pump = null; });
    return pump;
  };
  return {
    wake,
    busy: () => active !== null,
    failure: () => failure,
    cancel(runId?: string): boolean {
      if (active !== null && (runId === undefined || active.runId === runId)) {
        active.controller.abort();
        return true;
      }
      const cancelled = runId !== undefined && queue.cancelWaiting(runId);
      if (cancelled) changed();
      return cancelled;
    },
  };
}
