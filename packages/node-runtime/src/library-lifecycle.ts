import { LirovoError } from "@lirovo/contracts";
import type { Db } from "./store/db.js";
import { assertNoExtractionProcesses } from "./store/processes.js";

export interface ArchivedRun { runId: string; title: string | null; archivedAt: number }

export const archivedRuns = (db: Db): ArchivedRun[] => db.prepare<[], ArchivedRun>(
  `SELECT a.run_id AS runId, s.title, a.archived_at AS archivedAt FROM run_archives a
    JOIN runs r ON r.id = a.run_id JOIN sources s ON s.id = r.source_id ORDER BY a.archived_at DESC, a.run_id`,
).all();

/** A visibility marker, never a data or artifact deletion. */
export function setRunArchived(db: Db, runId: string, archived: boolean): void {
  db.transaction(() => {
    if (archived) assertNoExtractionProcesses(db, runId);
    const run = db.prepare<[string], { status: string; lease_expires_at: number | null }>(
      "SELECT status, lease_expires_at FROM runs WHERE id = ?",
    ).get(runId);
    if (!run) throw new LirovoError("SOURCE_NOT_FOUND", "This extraction no longer exists.");
    const queued = db.prepare<[string], { status: string }>("SELECT status FROM extraction_queue WHERE run_id = ?").get(runId);
    if (archived && ((run.lease_expires_at ?? 0) > Date.now() / 1000 || queued?.status === "queued" || queued?.status === "running"))
      throw new LirovoError("STORE_BUSY", "Stop this extraction before archiving it.");
    if (archived) db.prepare("INSERT INTO run_archives (run_id, archived_at) VALUES (?, ?) ON CONFLICT (run_id) DO NOTHING")
      .run(runId, Math.floor(Date.now() / 1000));
    else db.prepare("DELETE FROM run_archives WHERE run_id = ?").run(runId);
  }).immediate();
}
