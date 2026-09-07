import { hostname } from "node:os";
import { LirovoError } from "@lirovo/contracts";
import type { Db } from "./db.js";
import { assertRunOwnership } from "./runs.js";

/** Unknown permissions/hosts/PID reuse fail closed; only ESRCH establishes absence. */
export function processExists(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
}

export function ownerProcessIsGone(owner: string): boolean {
  const match = /^([^:]+):(\d+)(?::[a-f0-9]+)?$/.exec(owner);
  if (match?.[1] !== hostname()) return false;
  const pid = Number(match[2]);
  return Number.isSafeInteger(pid) && pid > 0 && !processExists(pid);
}

/** Call while holding the same SQLite write lock used to claim/start work. */
export function assertNoExtractionProcesses(db: Db, runId?: string, exceptOwner?: string): void {
  const rows = runId === undefined
    ? db.prepare<[], { run_id: string; owner: string; host: string; process_group: number; owner_released: number }>("SELECT * FROM extraction_processes").all()
    : db.prepare<[string], { run_id: string; owner: string; host: string; process_group: number; owner_released: number }>("SELECT * FROM extraction_processes WHERE run_id = ?").all(runId);
  for (const row of rows) {
    if (exceptOwner !== undefined && row.owner === exceptOwner) continue;
    if (row.host !== hostname() || processExists(-row.process_group) || (row.owner_released === 0 && !ownerProcessIsGone(row.owner))) {
      throw new LirovoError("RUN_ALREADY_CLAIMED", "A previous extraction process is still running. Let it exit before resuming or copying this library. No files were replaced.");
    }
  }
}

/** Persist before the child's startup gate is opened, including pre-ingest work. */
export function createRunProcessJournal(db: Db, runId: string, owner: string): { record(pid: number): void; release(): void; publish(write: () => void): void } {
  let released = false;
  const assertWriter = (): void => {
    if (released) throw new LirovoError("RUN_ALREADY_CLAIMED", "The extraction writer has already stopped.");
    assertNoExtractionProcesses(db, runId, owner);
    if (db.prepare("SELECT id FROM runs WHERE id = ?").get(runId) !== undefined) assertRunOwnership(db, runId, owner);
  };
  return {
    release() {
      released = true;
      db.transaction(() => {
        db.prepare("UPDATE extraction_processes SET owner_released = 1 WHERE run_id = ? AND owner = ?").run(runId, owner);
        // A lost/expired lease may still name this live desktop process. The
        // released attempt is safe to resume once its subprocess groups exit.
        db.prepare("UPDATE runs SET lease_owner=NULL, lease_expires_at=NULL WHERE id=? AND lease_owner=?")
          .run(runId, owner);
      }).immediate();
    },
    publish(write) {
      if (released) throw new LirovoError("RUN_ALREADY_CLAIMED", "The extraction writer has already stopped.");
      db.transaction(() => { assertWriter(); write(); }).immediate();
    },
    record(pid) {
      if (!Number.isSafeInteger(pid) || pid <= 0) throw new LirovoError("INTERNAL", "Invalid extraction process group.");
      db.transaction(() => {
        assertWriter();
        db.prepare("INSERT OR IGNORE INTO extraction_processes (run_id, owner, host, process_group, created_at) VALUES (?, ?, ?, ?, ?)")
          .run(runId, owner, hostname(), pid, Math.floor(Date.now() / 1000));
      }).immediate();
    },
  };
}
