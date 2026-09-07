# ADR 0014: Deterministic purge checks and recoverable media reads

- status: accepted
- date: 2026-09-07
- spike: [release readiness](../../spikes/release-readiness/NOTES.md)

## Context

A purge regression used 3,000 files to force overlap and timed out under full-suite contention. Separately, a historical native playback error was not reproduced on clean AV1 playback; a genuine scratch-file 404 exposed missing recovery after restoration.

## Decision and why

Use an explicit process handshake rather than filesystem timing ballast. Keep the existing native decoder/protocol and immutable media. Give user-triggered retries a fresh URL query identity for the same artifact; calling `load()` on the failed identity was measured ineffective.

## Implementation

The runtime library test signals a child after the real write transaction begins. SQLITE_BUSY must be observed before commit; the same child's connection then writes successfully, with unchanged DB inode and integrity. Bounded handshake deadlines and child cleanup prevent leaked writers.

The renderer shares `playbackSource` for video/audio retries. Actual media errors, not every rejected `play()` promise, drive the video warning. Existing Electron and ffmpeg run a portable production-component regression via `apps/desktop/scripts/verify-playback.mjs`; CI covers persistent error, successful retry, decoding, seek and interrupted-play classification.

## Applying correctly

Assert the critical interleaving explicitly, with real independent connections and the production operation. Avoid global timeout inflation or retries that hide a race. Test native resource recovery, not just a button's presence or a resolved play promise. Keep all source bytes unchanged, preserve path confinement and use a scratch profile. Build first, then run native checks against stable bundles.

## Limits

The original screenshot's root cause remains unproven. This is measured defensive recovery, not an AV1 incompatibility fix. Retry restarts at the beginning and requires playback to be resumed; unsupported/corrupt/missing media still fails visibly. One concurrent writer and selected macOS codecs do not establish all scheduling, platform or power-loss behavior. Unsigned native checks do not prove notarized installer or update delivery.

## References

- [Vitest explicit test deadlines](https://vitest.dev/api/test): per-test bound, not a global timeout change.
- [Electron protocol](https://www.electronjs.org/docs/latest/api/protocol): preserve the existing streaming scheme; no security relaxation.
- Project knowledge: `/Users/dontizi/Obsidian/vault/projects/lirovo/lirovo.md`.
