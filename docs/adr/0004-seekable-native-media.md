# ADR 0004: Seekable native media adapter

- status: accepted locally; uncommitted
- date: 2026-09-05
- spike: ../../spikes/desktop-media-seeking/NOTES.md

## Context

Evidence clicks could not seek an existing 667.5-second recording. Electron 44 file fetch returned partial bytes with a 200 response and no range/length headers. The normalized MP4 is intentionally silent, with audio retained separately as FLAC.

## Decision and why

Use a narrow protocol adapter: stat the existing file, normalize one inclusive byte range, emit 206/Content-Range/Content-Length/Accept-Ranges, and delegate the body to native net.fetch. Do not buffer or transcode the video, modify artifacts, add a dependency, or weaken CSP/sandbox/containment. Ignoring unsupported or conditional ranges safely returns the full representation; HEAD has no body and unsatisfiable ranges return 416.

## Implementation and reuse

`media-protocol.ts` owns response framing; pure `byte-range.ts` owns parsing. `runArtifacts` adds the existing audio URL to the internal bridge. `sync-audio.ts` follows the shared video clock for play, seek, buffering, pause, rate and end, with listener cleanup and drift correction. The reader exposes mute and recovery controls; successful audio playback clears earlier errors.

Reproduce real runtime behavior before adapting it, compare exact response bytes against the file, and validate in the native media element. A green parser test cannot establish seekability. Keep paired media events in a detachable adapter instead of duplicating clocks in every view.

## Proof and limitations

Exact native byte comparison, 40 desktop tests, production build/typecheck/preload guard, independent review and native reader smoke passed. Video/audio were observed playing within approximately 60ms, with full seekable ranges, working mute and stop at completion. This is not a guarantee of sample-accurate synchronization, acoustic quality, all codecs or exhaustive accessibility. Existing root containment is unchanged, not redesigned as a new filesystem security boundary. Source claims are not fact-checked. Rollback only these continuation hunks; preserve earlier reader/shell changes.

## References

- [Electron protocol](https://www.electronjs.org/docs/latest/api/protocol)
- [HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests)
- [Media playing event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event)
- Local validation: ../design/extraction-reader-audit.md
