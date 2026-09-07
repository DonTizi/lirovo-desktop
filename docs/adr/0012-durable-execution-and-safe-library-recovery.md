# ADR 0012: Durable execution and safe library recovery

- status: accepted
- date: 2026-09-07
- spike: [direct invocation evidence](../design/reliability-validation.md), [library safety contract](../design/library-safety-contract.md)

## Context

Navigation and process restart must not lose extraction requests or silently invoke another paid provider. SQLite leases alone did not fence stale writers: a delayed process could finish another owner's run. A killed engine could also leave detached ffmpeg or yt-dlp processes writing canonical artifact paths after its lease expired. Library copies need SQLite WAL consistency and complete artifact verification, not a raw database file copy.

## Decision

Use a durable sequential request queue with explicit restart consent, a scoped write-owner fence, a journaled subprocess startup gate, and a verified new-directory backup protocol. Archive is a reversible visibility overlay, never artifact deletion.

```text
request -> SQLite queue -> one scoped attempt -> journal process group -> grant startup
                              |                         |
                              +-- SQL owner fence       +-- liveness blocks reclaim
                              +-- fenced artifact rename
restart -> hold queued work -> explicit resume -> reuse validated stage outputs
idle library -> consistent SQLite snapshot + artifacts -> hash/integrity check -> publish marker
```

## Why

A lease heartbeat is advisory until every write is fenced. PID checks alone were insufficient: a real crash probe demonstrated a detached child surviving its killed parent and overwriting another writer's artifact. Startup gating makes the subprocess journal durable before the target may execute. Resume refuses while a recorded process group or unreleased parent remains alive; it never kills potentially reused PIDs during recovery. This is less invasive than relocating every media tool and cache into attempt-specific namespaces.

## How it was implemented

- Migration 4 stores complete pre-ingest requests. Restart holds work; completion acknowledgements are separate from execution outcomes.
- Scoped run stores and result/manifest persistence verify the current unexpired owner within the same immediate SQLite transaction as each write.
- Migrations 6–7 journal subprocess groups and owner release. `createTrackedExec` holds a dedicated fd-3 gate until its synchronous journal callback commits. Original stdin and argument contents remain intact.
- Parent process identity includes a per-attempt nonce. Released attempts clear only their matching lease. Unknown hosts and live process groups fail closed.
- Artifact publication uses a unique temporary file and synchronous rename within a fenced write transaction. Dedup copies use that same publication route. External binaries remain journaled until their process groups actually exit, including after cancellation.
- Reason-stage Maps are encoded as field/evidence pairs and rehydrated; legacy lossy caches are invalidated. Already committed values retain original observation identities and review history on resume.
- Backups use SQLite's backup API while a separate write lock holds the library quiescent. Full recorded run files are streamed with SHA-256 verification, exact inventory and database integrity checks. Restore exclusively creates a new profile, relocates internal normalized paths and clears copied execution ownership. External source URIs remain unchanged.

## How to implement it correctly

Keep startup permission separate from stdin and shell source text. Never release permission before the durable journal commit. Group liveness must cover descendants, not just the initial child PID. Do not access a closed database from child-close callbacks: retain journal rows and inspect them during recovery. Mark owner release before closing the database, while retaining group records until liveness checks prove absence. Ensure direct binary writes and asynchronous JavaScript publication both have a boundary. Never classify a failed queue acknowledgement as failed inference.

For backups, use exclusive new-directory creation and an incomplete marker. Verify from a fresh connection, reject symlinks, path traversal, unknown files, unsupported schema versions and checksum failures, and never overwrite the active profile. Backup does not authorize deletion.

## Limitations and edge cases

- Tracked extraction execution currently supports macOS/Linux. Windows fails closed rather than using an unsafe startup path.
- A stopped-but-live process, unknown host or reused process-group identifier may conservatively block resume until operator resolution. No remote/shared-profile ownership protocol is claimed.
- Pre-upgrade detached processes without journal records cannot be reconstructed; legacy unknown owners require manual resolution.
- A failed backup/restore leaves an explicitly incomplete new directory; there is no promise of atomic whole-directory publication or physical-disk durability under power loss.
- Backups are not encrypted; source content may itself be sensitive. Models, binaries, credential files and external original media are not included.
- Store/crash probes prove ownership and byte integrity, not model accuracy or universal video codec support. Native UI and whole-workspace checks remain integration gates.

## Links

- [Reliability validation](../design/reliability-validation.md)
- [Library safety contract](../design/library-safety-contract.md)
