# Knowledge workspace implementation contract

## Summary

Turn the existing extraction desktop into a reliable, reviewable and reusable knowledge workspace. Preserve the approved neutral/translucent design and source-linked results. Deliver in independently verifiable increments; do not equate implementation, mocked smoke tests, model accuracy or market validation.

```text
Sources -> durable queue -> language-aware extraction -> original artifacts
                                |                          |
                           recover/retry              review decisions
                                                           |
                                     library search <---- effective values
                                           |               |
                                   compare + sources    JSON/CSV/Markdown
                                           \               /
                                            useful outcome
```

Pattern: existing ports/adapters, typed IPC, transactional SQLite, immutable original evidence plus explicit user decisions. No competing pipeline or renderer-owned filesystem. Spike: yes — migrations, IPC, process recovery, export paths and model-language behavior need real scratch probes before tests.

## Workstreams and ownership

1. Quality: multilingual defaults/selection, transcript anomaly gate, actionable failures and reproducible evaluation fixtures. Own ASR/core installables files; coordinate IPC fields with integrator.
2. Review: persist accept/reject/reopen/correct actions, preserve originals/history and evidence, edit UI and reviewed result counts. Own new review runtime module, review components/value-reader and run-view integration. Coordinate shared IPC with integrator.
3. Reliability: desktop durable queue/recovery, explicit backend policy, cancellation and resume; no implicit remote fallback. Own engine-host, queue/recovery modules and App integration. Coordinate shared IPC with integrator.
4. Knowledge: cross-run search with full source context, source navigation and comparison; avoid fabricated conclusions or identity merges. Integrator owns standalone knowledge UI/modules and shared IPC wiring.
5. Delivery: provenance-preserving JSON, CSV, Markdown exports and local report workflow. Start after review contracts settle, then backup/restore and individual library lifecycle where safely proven.
6. Product validation: technical-research presets and an executable acceptance journey, local-only measurement design and human validation protocol. No contacting users or invented traction.

Three workers maximum in parallel alongside the integrator. Shared files (preload, bridge contract, channels, ipc validators, engine protocol, main/index, package root exports and migrations) require explicit ownership/coordination. No overlapping blind edits.

## Definition of done

- Existing history/preferences remain intact; original extracted values and source evidence are never overwritten by corrections.
- Every user action has a real persisted backend effect, validation and actionable error state; reload/reopen retains saved work.
- Suspicious transcription is visible and cannot be silently presented as trusted output. Multilingual operation is tested on real local audio when tools/models are available; synthetic text checks alone do not prove ASR accuracy.
- Review decisions round-trip through SQLite and the UI; invalid type, stale revision, unknown observation and wrong-run actions fail safely.
- Exports preserve complete values, review state, source references and timestamps; reject CSV formula injection and unsafe filesystem destinations.
- Search and comparison retain source/run identity; empty queries/no matches/error states are handled. Lexical retrieval must not be labelled semantic understanding; generated answers need actual model calls and cited retrieved evidence.
- Queue survives process restarts; cancelled/interrupted items never auto-spend or auto-switch providers. Resume reuses valid stages without duplicating persisted values.
- New UI works in light/dark, keyboard navigation and narrow layouts; motion respects reduced-motion settings.
- All touched-package tests/typechecks/builds and full final `pnpm turbo run typecheck test build` pass. Run configured lint; explicitly record absent lint tasks rather than claim lint coverage.
- Fresh independent review covers correctness, security, maintainability, performance and UX; fix blockers and re-check.
- Live desktop/browser smoke exercises new controls against isolated local data; mock-only checks are identified separately. No production data purge, paid/cloud inference, releases or writes to external apps for tests.
- Record each real probe, command and oracle in a validation report. Remaining gaps stay explicitly incomplete; no blanket “everything works”.

## Test matrix

| Layer | Required scenarios | Oracle |
| --- | --- | --- |
| ASR | FR/EN selection, malformed/empty/repetitive output, cancellation, fallback policy | Command arguments + real audio fixture where available; not universal transcription accuracy |
| Review/store | valid corrections, schema types, immutable original, history, conflict, restart | SQLite readback and integrity checks |
| Export | all formats, nested arrays/types, Unicode, quotes/newlines, formula-leading text, missing evidence | Parse exported files and compare full canonical data |
| Knowledge | multiple runs, corrections/rejections, query escaping, no matches, source navigation, comparisons | Known isolated corpus and exact source references |
| Recovery | queue, cancel queued/active, restart, stale lease, valid-stage reuse, duplicate prevention | Independent process/store recreation, events and stage invocation counts |
| UI | submit -> live review -> leave/return -> review/edit -> search/compare -> export | Running production components/desktop, no console errors, persisted state |
| Product | useful-result time, correction burden, recurring task completion | Real pilot observations required; not replaced by automated tests |

## Boundaries and rollback

No new cloud service/account, paid model invocation, silent egress, automatic external export, broad deletion, public posting, commit/push/PR or release. No README. Public user research requires a separate human step. App access for external assistants needs a separately validated security boundary, not an unguarded local server.

All implementation stays local until the user inspects diff and reviewer verdict. Additive migrations only; scratch data for validation. Rollback means restore only this task's scoped edits after approval, never reset the user's worktree or downgrade/delete user data. Unproven advanced capabilities remain listed as remaining work, not silently replaced by a weaker feature.
