# Library safety addendum

Create a verifiable copy of a quiescent library and make individual extractions reversible to archive. Never overwrite or silently activate a restored profile.

```text
idle library -- write lock + SQLite backup --> NEW incomplete directory
  recorded run files -- stream + SHA256 --> verify DB and complete inventory
                                        --> remove incomplete marker
backup -- full verification --> NEW restored profile --> explicit relaunch choice
run -- archive marker --> hidden in library -- unarchive --> visible again
```

Pattern: SQLite consistent snapshot plus a complete checksummed file inventory; reversible archive overlay. Spike: yes, because SQLite WAL snapshots, filesystem containment and partial restore need real runtime evidence.

Acceptance: no active run leases or queued/running desktop jobs; no symlink traversal; exclusive creation refuses existing destinations including empty directories. The backup includes the SQLite library and files under recorded run IDs, not models, binaries or credential files. Unknown settings are removed from the snapshot; source content may itself be sensitive. External originals are not included. Files are streamed, never loaded wholesale or truncated. A failed/crashed operation leaves a marked incomplete folder which restore refuses. Restore checks checksums, exact inventory, SQLite integrity/foreign keys/schema version before removing its incomplete marker; it never writes into the active library. Archive keeps rows, evidence, review history and files.

Files: new node-runtime library-backup and library-lifecycle modules/tests, desktop LibrarySafety component; shared migration/IPC/engine/Settings integration belongs to the integrator. Non-goals: encryption, scheduled remote backups, profile switching, sync, permanent deletion, ownership guarantees against another hostile process running as the same OS user.

Verification: direct scratch SQLite WAL snapshot while a separate write lock is held; actual file backup/restore round-trip; existing destination, tampering, extra files, incomplete marker, symlink, unsafe relative path, future DB version and live lease cases. Full package checks and native chooser/UI smoke are required. Oracle: byte-level integrity and correct lifecycle effects, not physical-disk durability under power loss or media/model correctness. Rollback removes only scoped code after approval, never restores over the user's active data.

Research: Node 22 `node:sqlite.backup` documents a consistent database backup (not a raw `.db` file copy); actual scratch probe returned the WAL-written value and `integrity_check=ok` while the separate connection held `BEGIN IMMEDIATE`. Vault prior art `verified-prune-before-delete` requires fresh-connection verification; `soft-delete-everywhere` preserves audit/FK history. A backup is not deletion authorization.

## Existing destructive reset: exclusion contract

Keep the metadata database inode stable and hold one SQLite writer exclusion across idle checks, named-directory deletion and logical reset. An external extraction startup must wait on that same database, never open a newly recreated parallel database while an older handle remains active.

```text
BEGIN IMMEDIATE -> reject active owners/groups/queue -> validate named trees
                -> clear logical rows + delete named content -> COMMIT
external writer ---------------- waits -----------------------> starts safely
```

Pattern: shared write exclusion, not a separate best-effort preflight. Spike: yes, deletion and cross-process startup form an irreversible race. Runs-only preserves schema/settings/models; full reset removes their logical rows and the named runs/models/bin trees but preserves the empty SQLite schema/inode and unrelated files. Database/WAL/SHM are never unlinked. Freed-byte reporting counts only removed named content, not unrelated files or retained DB storage. Symlinked layouts/trees fail closed.

Files: runtime library.ts/tests, desktop engine purge handler, Settings reset wording. Verification: actual temporary SQLite/file reset with a gated external writer; marker shows the writer attempted but could not finish before COMMIT, then its inserted row survives on the original inode. Relevant tests and package typechecks required. Oracle: concurrent-writer exclusion and scoped deletion; not a distributed transaction between SQLite and the filesystem, power-loss atomicity, secure erasure, or coordination with unrelated external installers. Errors after deletion begins explicitly report a partial reset and retain the logical clear rather than resurrecting rows with missing files. Recovery from physical deletion requires a prior backup; no automatic rollback is promised.

Observed command: `node apps/desktop/spikes/reliability/purge-probe.mjs`. Output: attempted writer `true`, finished writer before unlock `false`; `freedBytes: 12000`, same database inode `true`, new writer row `{key: "new_writer", value: "safe"}`, unrelated file preserved. `pnpm exec vitest run src/library.test.ts` passed 17 tests including that race, active-work refusal, symlink refusal, scopes and exact freed bytes. A real scratch permission-denial probe (`chmod` on its temporary data directory) produced an explicit partial-reset error at `rmdir` and retained zero run rows; the regression restores permissions and confirms a retry is safe.
