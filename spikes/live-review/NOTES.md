# Live review continuity

2026-09-05 — verdict: adapt.

Source probe: run:start is emitted before ingest; the database row is created in onIngested. runDetail legitimately returns null before then. The old App waited for extract's final response to open the review, and RunView loaded artifacts only on mount. Intermediate media run:done is not the final extraction outcome.

Direct runtime probe before tests: pendingRun produced a running keyed session with empty records and no invented duration. Slow serial reads ran four times with maximum concurrency one; cleanup stopped scheduling. Regression tests exercise the observed serialization and stop behavior.

Full production App replay via `apps/desktop/spikes/live-review.html`: isolated in-memory bridge, no inference/IPC/data writes. Starting from SourceInput immediately opened review before a database row existed. Navigated to Library, saved partial files, returned: progress 4/11 sessions, Transcript1 and Frames1 were present. Staying on Frames while finishing updated its missing-description message to the saved description and Results0 to Results1. On a separate run, intermediate media done followed by failure while on Library kept Library selected; reopening showed the complete LATE_FAILURE diagnostic. Browser console errors: none.

Native runtime: existing user-started run “I Gave Local AI and the Cloud the Exact Same Job” was inspected, not launched/cancelled. It showed Connecting the ideas, Transcript382, Frames159. Library navigation then return showed Shaping the final answers with the same artifacts. Evidence: `design-evidence/live-review-native.png`.

Fresh review caught incomplete MP4 exposure: normalization creates its path before ffmpeg finalizes playable headers. Renderer now gates video/audio URLs on completed normalization, using existing progress reconciliation, or saved success. Healthy playback URLs are not reset on normal artifact polls. Reviewer accepted the revision and dead-state cleanup.

67 tests, desktop build/typecheck/preload guard and diff check passed. Existing Rollup platform-option and bundle-size warnings remain; no desktop lint script exists. Oracle covers actual stage continuity, full-App replay navigation/terminal transitions and deterministic polling. No new paid run, forced slow ffmpeg playback experiment, pre-ingest process-restart recovery, transcription quality change or release. Unmount/remount may reset local reader pane/player position; extracted facts and progress remain keyed by run.
