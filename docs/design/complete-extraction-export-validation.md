# Complete extraction export — validation

Date: 2026-09-07. Scope: [written contract](complete-extraction-export-contract.md), [ADR 0013](../adr/0013-complete-extraction-export.md).

## Delivered

Review > Export now defaults to **Complete extraction folder**. It writes results.json, results.csv, results.md, records.json, every existing run artifact under artifacts/, and a versioned lirovo-extraction.json manifest with relative locations, availability notes, byte lengths and SHA-256 values. Full transcript, raw/dedup images, graph/compact graph, visual analysis, source/normalized media are included when saved. Report-only formats remain separately selectable.

No external originals are fetched; no other extraction, global settings, credentials or installed model is exported. Folder scope is always all, with explicit privacy warnings. All historical review events and corrections remain intact. Graph edges and timestamps are not reconstructed or guessed.

## Checks and observations

- Final workspace: **560 tests in 64 files**, **15/15 typecheck/test/build tasks passed**. Runtime 326, core 121, contracts 14, CLI 5, desktop 94. `git diff --check` clean. Existing `pnpm lint` has zero configured tasks; no lint coverage claimed.
- Direct production-function spike before tests: original report lacked transcript/graph files; two-run backup kept full bytes but wrong sharing scope. New folder round-trip preserved all 13 fixture data files and excluded the other run. Real JPEG/video were generated with ffmpeg, not inferred from filenames.
- Regression coverage: full Unicode transcript, graph nodes/edges, source bytes, review history/evidence, unrelated-run/settings isolation, existing/protected destinations, symlink rejection, missing recorded artifacts/frames, active lease/queue/process refusal, invalid run IDs/traversal, missing entire runs root, malformed frame manifests and real filesystem-permission failure with incomplete marker retained.
- Native Electron: actual Export UI, fixed All results scope, actual directory dialog cancellation and subsequent successful save. During the second picker action the computer-use tool reported concurrent window interaction; the completed native IPC/save and resulting files were independently verified, but this was not an isolated scripted picker sequence.
- Real extraction output: **237 indexed files + manifest**, **89,362,113 indexed bytes**, **220 transcript segments**, **114 raw + 112 deduplicated JPEG images**, **39 graph nodes / 74 edges**. All destination checksums matched. The saved run had no visual-analysis artifact because that stage failed; the availability warning was truthful.
- Independent review: initial supplied-context gap was closed with the full bridge/barrel/backup tests. Missing-runs handling, malformed-manifest messages, sensitivity wording, foreign-host error, connection finalization and shared-helper cleanup were revised. Final checker verdict: ACCEPT, no blocking defect in supplied source. The checker did not execute tests; the integration runner performed the checks above.

## Oracle and limits

These checks prove fidelity to a saved run, guarded local destination writing, and functioning desktop integration. They do not establish model truth, complete accessibility/installer/platform coverage or resilience to power loss and malicious same-user filesystem races. The transfer holds a library write fence; other actions pause, progress is indeterminate and multi-GB copies may take minutes. Keep Lirovo open. Inspect originals, rejected values, prompts, local paths, media and host/process diagnostics before sharing; the folder is not encrypted.

No source extraction/review was edited or removed. A new native export folder was created in Downloads; scratch copies are outside the repository. No commit, push, PR, paid inference or publication occurred. The native player also showed an unable-to-play state during this session; playback was not exercised by this export task and is not covered by its success claim.

## Reproduce

```sh
pnpm --filter @lirovo/node-runtime build
node spikes/complete-export/probe.mjs
pnpm turbo run typecheck test build --output-logs=errors-only
git diff --check
```

Manual: open a completed extraction, select Complete extraction folder, first cancel the picker, then choose a parent outside the library. Confirm the success message and inspect lirovo-extraction.json and its listed files. No deletion/reset is needed.
