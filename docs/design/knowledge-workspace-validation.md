# Knowledge workspace validation — 2026-09-07

## Scope and release gate

Implementation follows [the written contract](knowledge-workspace-contract.md). Work was split among quality, review/export/product, and reliability workers, with integration and independent cross-checks. All changes remain local on `feat/dark-mode`; no commit, push, PR update, release, production-library purge or paid/cloud extraction was performed.

This report separates implemented behavior, repeatable validation and still-unproven product outcomes. It is not a claim that every video, operating system or future crash will behave correctly.

## Delivered increments

| Area | Implemented | Explicit limit |
| --- | --- | --- |
| Extraction quality | Multilingual default, selected/auto language, explicit remote policy, structural/repetition gate, immutable rejected transcript, cache invalidation | Anomaly checks are not accuracy/confidence scores; existing English-only models require explicit English or a multilingual installation |
| Human review | Typed corrections, accept/reject/reopen, revision conflicts, original/evidence retention, history | Transcript editing/recomputation and exhaustive complex-schema validation remain incomplete |
| Knowledge | Cross-run keyword search, reviewed-only source comparison, cited answers, provider/scope consent and cancellation | No semantic retrieval, entity merge/contradiction detection, persistent Q&A history or semantic citation verifier |
| Reuse | JSON, CSV and Markdown/Obsidian-compatible exports with provenance and audit | Audit can contain sensitive originals/rejections/paths; there is no assistant-facing API |
| Reliability | Persisted queue, explicit restart recovery, lease/process fences, verified backups/new-profile restores, reversible archive | POSIX subprocess boundary; no intentionally daemonized tools, multi-device sync, automatic restore activation or power-loss guarantee |
| Product workflow | Technical research and benchmark presets; pilot protocol | No real-user recruitment/results, retention proof or invented success metrics |

## Deterministic gate

From the repository root:

```sh
pnpm turbo run typecheck test build --output-logs=errors-only
pnpm lint
git diff --check
```

The final 2026-09-07 integration run, including the storage-maintenance correction, passed **15/15 build/typecheck/test tasks**, including **543 tests in 62 test files**: contracts 14, core 121, runtime 311, CLI 5, desktop 92. A second unchanged run also passed with all 15 tasks cached. `pnpm lint` runs zero tasks in the current workspace; no lint coverage is claimed. Existing desktop bundle-size and Vite `platform` warnings are not test failures but remain visible build debt.

## Real native integration

`spikes/knowledge-workspace/desktop-probe.mjs` creates a fresh isolated profile and uses the built Electron main/preload/engine/renderer, real SQLite and real files. A local HTTP server supplies a deterministic model-response fixture; only native picker choices are controlled. The default user library is never opened by these tests.

The final complete run at `lirovo-workspace-desktop-h3vFbw` under the macOS temporary directory passed:

- Second Electron process using a symlink to the same library exits; the original keeps one window.
- Cross-run search; full source values sent through the real HTTP adapter; answer references a retrieved source; changing filters revokes consent.
- Source navigation seeks the real video to 0:03.
- Typed correction and reason, draft decision controls disabled, separate acceptance, preserved original/history and persistence after Electron restart.
- Reviewed-only comparison excludes the other unreviewed source; disabling the filter restores it.
- JSON saved through native-save IPC; parser checks corrected payload and source timestamp. Picker cancellation writes nothing; selecting the library database is refused.
- Archive/unarchive changes visibility without losing rows/history. Backup/restore round-trips two runs and review history into a new profile, verifies SQLite integrity, and does not activate/overwrite the current profile.
- Storage reporting, persisted invalid-source failure and cancellation, research preset selection, Escape/focus, light/narrow layout and reduced-motion configuration. No page errors observed.
- A real local spoken-video fixture submitted from the UI opens live review, survives leave/return, and finishes with real ffmpeg and multilingual whisper.cpp. Detected language is `en`; no extra HTTP model call. The transcript contains the full 25-word synthetic source speech. This does not exercise real visual reasoning/graph/extraction-model accuracy.
- Native purge IPC against this disposable profile only: cancelling preserves the runs; confirming removes owned extraction artifacts and rows; full reset clears settings while preserving the SQLite inode and integrity. The previously verified external backup remains available. Confirmation responses were controlled, not manually clicked.

Reproduce the optional media path with explicit scratch-model/audio paths:

```sh
LIROVO_TEST_PURGE=1 \
LIROVO_TEST_WHISPER_MODEL=/path/to/ggml-base-q5_1.bin \
LIROVO_TEST_AUDIO=/path/to/english.wav \
node spikes/knowledge-workspace/desktop-probe.mjs
```

The model fixture was downloaded earlier into a temporary directory, checksum-verified against the install manifest, not installed into user data. Without the model/audio variables the script skips the real-media path. `LIROVO_TEST_PURGE=1` additionally tests deletion inside the fresh profile created by the script, after backup; it does not target an existing user profile.

Screenshots were visually checked. A low-contrast answer heading was reproduced as a Tailwind `text-base` color/font utility collision, corrected with the established ink token, and pinned with a computed-color assertion. This is a representative visual check, not a full accessibility audit.

## Independent findings resolved

Review led to concrete fixes, not only a green verdict:

1. Stale run owners could overwrite a newer owner's status/results: transaction-scoped ownership checks now fence writes.
2. Queue success-acknowledgement errors could relabel completed work as failed: acknowledgement failure stops the worker without changing execution outcome.
3. An orphan ffmpeg-like child could overwrite a resumed artifact: journal-before-start process gating, live owner/group checks and fenced publication now block unsafe takeover. A real SIGKILL probe reproduced the failure first, then verified refusal until the orphan exited.
4. Reasoning cache serialized citation Maps as `{}`: explicit entry codec/hydration now preserves evidence; legacy lossy caches are invalidated.
5. Consent did not follow retrieval scope, and comparisons ignored reviewed-only: every output path now receives the filter and changed scope revokes consent.
6. Accept/Reject during editing discarded a draft: reproduced natively; decisions now require Save or Cancel first.
7. Internally cancelled visual work masked the originating ASR error: causal transcription errors survive; genuine user cancellation and frame-budget refusal retain their meanings.
8. Hosted ASR invented 0:00 for missing timestamps: unknown offsets now fail validation instead of becoming evidence.
9. Purge could race another process and unlink its SQLite coordination file: quiescence checks, logical clearing and owned-file deletion now share an immediate write transaction, with a stable database inode. An independent real external-writer probe verified blocking until commit and preservation of the subsequent write; a filesystem-permission failure probe verified explicit partial-reset reporting and consistent retained metadata. This is not secure erasure or a power-loss-atomic filesystem transaction.

Detailed probes: [reliability](reliability-validation.md), [exec fencing](../../spikes/exec-fencing/NOTES.md), [ASR](../../spikes/quality/NOTES.md), [causal errors](../../spikes/quality/causal-cancellation.md), [exports](../../spikes/knowledge-exports/NOTES.md), [answers](../../spikes/knowledge-answer/NOTES.md).

## Acceptance and remaining obligations

Independent scoped reviews accepted the final corrections, including destructive-storage concurrency. The final deterministic and native gates above passed. This accepts the documented local implementation increment, not every proposed advanced feature or a production release.

- Held-out human/noisy/long/code-switched media, live-platform captions and real extraction-model groundedness/recall need evaluation. Synthetic French already demonstrated 4/26 word errors despite passing anomaly checks.
- Manual native-dialog operation, representative keyboard/screen-reader audit, packaged/signature/installer validation, and Windows/non-POSIX support are not established here.
- [Technical-research pilot](technical-research-validation.md) needs consenting users and measured baseline/task completion. Automated tests cannot establish usefulness or retention.
- Human inspects the local diff and reviewer verdict before authorizing commit/push/PR changes.
