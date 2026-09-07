# Desktop durability validation

## Contract and boundaries

Persist the full extraction request before ingest, run one item at a time, preserve explicit provider choice, retain live review across navigation, and require an explicit resume after process restart. Resume uses the existing core pipeline and SQLite stage ledger, not a second extraction implementation. Original committed values and human decisions are never replaced during a retry.

No production database was modified by these probes. No paid inference or cloud transcription was invoked. Browser/native integration and final independent review are integration gates, not implied by store tests.

## Observed probes before tests

`apps/desktop/spikes/reliability/probe.ts` directly invoked the production queue/store and persistence helpers against a fresh `mkdtemp` SQLite file. The script was compiled using the existing Vite dependency's esbuild, then run with Node 22.

- A request with no source/run row was persisted, claimed, closed and reopened. Recovery returned `interrupted`; `claimNext()` returned `undefined`.
- Explicit `resume()` invoked the worker once and ended in `succeeded`.
- A foreign live-lease claimant returned `false`; the active ASR attempt still read `running`.
- Calling the production persistence helper twice kept one `title` value, not two.
- Selecting an unavailable local adapter threw `NO_INFERENCE_BACKEND`; the adapter probe log contained only `local`, never `remote`.
- SQLite `integrity_check` returned `ok`.

## Automated checks

`pnpm exec vitest run src/main/extraction-queue.test.ts src/main/extraction-recovery.test.ts` from the desktop package: **9 passed**.

- Independent child process writes a running pre-ingest request and exits; a new connection recovers it without executing work. Full schema/source/language/remote-policy JSON survives.
- Sequential execution while new work is enqueued; repeated wake calls share one pump.
- Waiting cancellation never invokes the cancelled item.
- Active cancellation targets the correct controller; later queued work proceeds.
- Unknown, active and successful jobs cannot be resumed via the failed/interrupted transition.
- On restart, only an explicitly selected interrupted item is requeued; unrelated items stay held.
- Re-persistence preserves observation identity, original JSON and the existing human correction event.
- Missing, unselected or unavailable backend never triggers another provider's detection or inference.
- Queue write failure is surfaced without an unhandled discarded promise; the worker stops rather than guessing whether work was saved.
- Dead local process leases are released immediately after checking the PID; live process leases are left untouched. Cancelling interrupted work updates the run and queue atomically.
- A completed reasoning ledger can finalize a legitimate zero-value result without invoking providers again.

`pnpm exec vitest run src/store/ledger.test.ts src/store/runs.test.ts` from node-runtime: **17 passed**, including the live-owner non-mutation regression, explicit cancelled-run reclaim and Map citation round-trip.

Fresh review found a stale writer could finish a run after another owner took its expired lease. Scoped production run stores now fence every database mutation, result persistence and manifest persistence against the live owner within the same immediate write transaction. A direct SQLite probe observed stale finish/stage/result writes rejected with `RUN_ALREADY_CLAIMED`, zero stale values, and the new owner still running and able to renew.

A real SQLite trigger rejecting a success acknowledgement observed the extraction queue stay `running`, the next item stay `queued`, and a surfaced worker fault. Acknowledgement failures are no longer reclassified as extraction failures. The regression removes the trigger and verifies that work remains stopped until explicit recovery.

Node-runtime build and desktop typecheck passed after parallel export declarations became available. The integrator must still run the full final workspace checks.

## Reasoning cache defect found and repaired

The prior SQLite stage ledger used `JSON.stringify` on a `Map` of citations, silently recording `{}`. A resumed final reasoning stage could therefore fail at persistence or lose its evidence. The production ledger now encodes field/evidence pairs and hydrates them back into a Map. Direct invocation against real SQLite observed `Map round-trip true` and the original full quote. Legacy lossy caches are invalidated, not treated as empty evidence. Successful reasoning interrupted before result persistence is finalized without provider calls; its graph artifact can be restored from the recorded graph-stage output.

## Integration scenarios still required

1. Start desktop with an isolated profile, enqueue invalid local media in transcript-only mode, observe the persisted pre-ingest failure and actionable error.
2. Navigate away/back and restart; the queue must remain visible, with no automatic work or provider switch.
3. Enqueue two real local fixtures, cancel waiting/active independently, verify their run identities and one active worker.
4. Interrupt a real staged run, expire its lease, explicitly resume and inspect actual stage invocation/resume events. Unit/store checks alone do not prove external ffmpeg/ASR adapter accuracy or every artifact-validity edge case.
5. Exercise light/dark and keyboard access on queue, resume controls and review. The completed review page must not steal navigation when background work starts or finishes.
6. Verify Electron single-instance supervision before recovery is used against a shared profile: a second desktop process must not mark the first process's pre-ingest work interrupted.

## Filesystem writer recovery

The independent reviewer demonstrated that killing the engine left a detached writer alive: it overwrote a newer artifact after the parent died. Parent PID checks alone therefore failed the oracle. Extraction subprocesses now start behind a dedicated fd-3 gate; their process group is durably journaled before permission is released. Resume refuses live groups or unreleased live/unknown owners. Attempt release is recorded before closing the DB and only clears a matching lease. Artifact `put`/`putFile` publication uses unique temporary files and a synchronous rename within the same ownership transaction; dedup copies use this path too.

Actual production probe: `node spikes/reliability/fencing-probe.mjs` from `apps/desktop` killed a disposable parent after its tracked child signalled readiness. Output: `orphan claim blocked RUN_ALREADY_CLAIMED`; after the old writer exited, `safe claim true`. A separate direct invocation tried a late artifact publication after journal release/DB close: it rejected and the original bytes remained unchanged. The startup primitive's independent tests cover full Unicode stdin, literal argument/environment isolation, crash before grant, denied journal writes, cancellation, timeout and missing executables.

`pnpm exec vitest run src/store/processes.test.ts src/store/runs.test.ts src/store/ledger.test.ts src/store/artifacts.test.ts src/library-backup.test.ts src/library-lifecycle.test.ts src/media/media.test.ts src/exec.test.ts` from `packages/node-runtime` passed **98 tests**, including the backup journal regression. Runtime build, desktop typecheck and CLI typecheck passed. Independent quality review accepted the combined DB/process/publication boundary and the release-state correction.

`node apps/desktop/spikes/reliability/backup-probe.mjs` directly observed an unreleased parent block backup even after its binary exited; releasing the owner allowed the verified backup/restore. The restored profile's process journal was empty while original source URIs and complete French artifact content were preserved.

## Oracle

The checks establish durable request state transitions, serialization/cancellation, restart consent, lease ownership and persistence idempotence against real SQLite. They do not establish model correctness, full video pipeline success, host power-loss behavior, multi-device sync or universal source availability. Those remain explicit validation obligations rather than claims.

## Final integration addendum — 2026-09-07

The final workspace passed 543 tests and all 15 build/typecheck/test tasks. The isolated native probe in [the integrated validation report](knowledge-workspace-validation.md) verified persisted invalid-source failure/cancellation, review persistence across restart, canonical-profile single-instance exclusion, backup/restore and disposable-profile purge. A real spoken video completed through ffmpeg and whisper.cpp after navigation away and back. This closes those specific integration observations; it does not claim a native crash/resume matrix at every media stage or two real simultaneous-video cancellation scenarios. The real SIGKILL/store/process probes above establish the narrower recovery boundary independently of model accuracy.
