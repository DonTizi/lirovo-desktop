# ADR 0008: Review is the live extraction session

- status: accepted
- date: 2026-09-05
- spike: [runtime observations](../../spikes/live-review/NOTES.md)

## Context

Opening a review only after the extraction promise resolves splits progress from results. Artifact reads on mount alone leave open reviews stale. The persisted source/run does not yet exist at run:start.

## Decision and pattern

Use a keyed renderer session cache with serialized polling and cleanup. Open a truthful provisional RunDetail immediately on run:start; replace it with persisted facts when available. Navigation is a user action separate from refreshing data. Final command results update the session but never navigate. Closed sessions reject late updates.

## Implementation and reuse

App owns run IDs, live events and detail snapshots outside RunView. A stable poll loop reads current session IDs without restarting on every snapshot. RunView polls artifacts while active and fetches once more on terminal status; keep last good content/player mounted during refresh. Pending results and frame descriptions use processing-aware copy. Put the approved progress component above the review tabs while working, retain compact notes on completion.

Gate video/audio on completed normalization: file existence alone does not mean an MP4 can play. Keep ordinary refreshes on stable media URLs. Serial reads prevent overlapping responses; cleanup ignores detached views. Final command errors remain authoritative over intermediate pipeline events.

## Alternatives and limits

No duplicate progress route, new store dependency, persistence migration or engine change. Renderer session snapshots are not pre-ingest restart recovery. Reader-local pane/player state may reset on leaving; this decision preserves extraction data and progress, not every viewport interaction. Large artifact polling is limited to the mounted review. Existing desktop build warnings remain.

## Proof

67 tests/build/typecheck/preload guard, independent review acceptance, full-App isolated lifecycle replay, and a native user-started run advancing from graph to reasoning across Library navigation. See spike notes for exact oracle. No paid run initiated, no release.

## References

- [React effect synchronization and cleanup](https://react.dev/learn/synchronizing-with-effects) — followed for polling lifecycle and stale-response guards.
- [Previous progress decision](0007-editorial-extraction-progress.md).
- Vault: `/Users/dontizi/Obsidian/vault/projects/lirovo/lirovo.md`.
