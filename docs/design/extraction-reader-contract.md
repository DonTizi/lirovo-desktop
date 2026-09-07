# Extraction reader contract

Replace the clipped result table default with a calm, grouped reading view. Preserve the approved translucent desktop shell and every stored value/evidence reference.

```text
Result -> category filter -> complete value -> expand sources -> timestamp -> shared video clock
       -> optional table / transcript / frames / graph
```

Pattern: progressive disclosure over the existing shared playback lens, with a pure grouping adapter. Existing code and the supplied screenshots are the design target; this is an in-place improvement, not a new prototype.

Acceptance: human-readable field headings; natural field order; complete text; category filtering; explicit empty states; no page-level horizontal overflow at 900 and 1180 px; optional raw table retained; source quotes and exact times remain reachable; keyboard-operable tabs/disclosures; artifact failures must not leave an endless skeleton. Preserve source data and native material.

Non-goals: inference changes, new extraction, exports, generated summaries, database/IPC changes, shell redesign, publication.

Files: run view/tabs/player, a reader adapter/component and tests, App result wrapper, scoped CSS. No new dependencies.

spike: no — real extraction and timestamp controls observed before implementation; no new API, schema or external dependency. Visual adequacy is checked in the actual Electron window after each layout pass.

Verification: desktop typecheck/build/tests, touched-file formatting, git diff whitespace, native smoke on the existing 30-value extraction including filters, source disclosure, seek, tabs, and narrow window; fresh-context reviewer. Root lint has no configured tasks and is not a lint oracle.

Oracle: checks establish data preservation, deterministic grouping, integration and observed interactions; they do not prove extracted claims true, all accessibility scenarios, or subjective visual approval. Human review remains useful. No full extraction is rerun.

Rollback: reverse only this task's hunks/new reader files; preserve all preceding uncommitted shell/preload changes. No commit or deployment.

## Playback continuation

Repair the confirmed inability to seek from result evidence without changing the approved reading design.

```text
Evidence timestamp -> shared lens -> media protocol -> local video (+ existing normalized audio)
```

Pattern: narrow media adapter with browser-native playback. spike: yes — Electron byte-range behavior is runtime-uncertain; reproduce using the installed Electron version before selecting a fix. Likely files: media-protocol.ts and focused helper/tests; player/lens and artifact bridge only if the real normalized audio must be connected. No new dependency, no data deletion, no weaker CSP, sandbox or file access boundaries. Preserve existing run media and extraction output. Acceptance: real 11-minute recording can seek near its end and back, sound when present, and current UI tabs/filters work. Verify via direct Electron probe, relevant tests, build/typecheck, formatting, fresh-context review and native UI. Oracle: tests prove byte ranges/data integrity; live playback proves actual media interoperability, not factual correctness or every codec. Roll back only continuation hunks and keep previous reader changes.

Grounding: one vault recall reinforced evidence-first provenance (not fact-checking). W3C APG tabs pattern informs arrow-key navigation and tab/panel relationships: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/.
