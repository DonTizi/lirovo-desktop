# Extraction progress probe

2026-09-05. Verdict: adapt.

Read-only SQLite observation on run `run_a7cxjcey0czf4ycx`: seven completed attempts, no ingest record. Durations: normalize 1s, scene detection 10s, dedup 1s, transcription 3s, vision 347s, graph 328s, reason 64s. Transcription and scene detection overlap. Direct model invocation preceded regression tests: missing ingest becomes Not recorded, completed count seven, parallel activity and cancellation remain distinct.

Isolated replay: `apps/desktop/spikes/progress-preview.html` imports the production component without calling the bridge. Frame counts are replay fixtures. Not part of the production HTML entry. Browser shimmer position moved from 99.3932% to -44.7601%; pause across a stage change yielded opacity 1, entry animation none and shimmer paused. Dark full and light 380px compact layouts inspected. Failure opened notes and retained its full message. Native completion showed 30 values/seven completed steps/Source Not recorded; disclosure opened and closed. Screenshot: `design-evidence/progress-native.png`.

Fresh reviewer caught an intermediate media run:done preceding final extraction failure. Final command error now overrides that status; cancellation stays distinct. Saved terminal attempts also beat stale live activity. Reviewer accepted the revised source. 64 tests, build/typecheck/preload guard and diff check passed. Existing Rollup platform-option and bundle-size warnings remain. No desktop lint script configured.

Oracle limitations: no paid extraction started. Live UI replay is not a provider test. App late-error integration is source-reviewed, not event-injected. Reduced-motion/forced-color CSS is source-reviewed, not OS-emulated. Screen-reader speech and subjective design approval remain human checks. No source data changed or release made.

Rollback only progress component/model/CSS/caller hunks and new diagnostic files; preserve prior shell, reader and graph work.
