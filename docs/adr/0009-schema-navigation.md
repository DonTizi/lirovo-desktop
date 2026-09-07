# ADR 0009: Stable schema categories for desktop extractions

- status: accepted
- date: 2026-09-05
- spike: ../../spikes/schema-navigation/NOTES.md

## Context

The flat sidebar obscured relationships between extractions. The initial read-only probe found thirteen historical desktop runs without saved schema names/revisions; only three had manifest schema JSON. A name-only grouping would silently invent identity and move pending runs between folders.

## Decision

Use a pure presentation adapter over existing manifest metadata. Record the full requested schema and display label at ingest, and derive one stable category key in both pending UI and persisted reads. No migration or historical backfill.

## Why

Saved schema ids preserve identity across revisions and renames. Exact canonical preset matches and full SHA-256 custom schema fingerprints avoid conflating distinct contracts. An explicit transcript-only flag is necessary: missing schema metadata is not evidence of that mode. Legacy field-set detection is labelled separately; otherwise show Uncategorized. Grouping by video titles was rejected.

## How it was implemented

`bridge/schema-identity.ts` shares canonical object ordering and preset definitions. The renderer computes its key before invoking extraction. `main/run-category.ts` uses parameter-bound existing `run_manifests` storage at ingest and read-only classification; `engine-host.ts` exposes category keys without raw manifest contents. `run-groups.ts` preserves rows and sorts recent-first. NavBar disclosures persist only collapse preferences; Library filters use identical keys.

## How to implement it correctly

Keep request identity and display labels separate. Preserve full schema content; never use field names as definitive identity. Share canonicalization across process boundaries and test pending/persisted parity for saved, preset, custom and transcript-only cases. Reveal the selected folder on selection changes without overriding a user's manual collapse during polling. Use native disclosure buttons with aria-expanded/controls.

## Limitations and proof

- Direct memory-database round trip and integrity check passed. 77 desktop tests, typecheck, production build and preload guard passed. No desktop lint script exists; scoped Prettier and whitespace checks cover formatting, not semantic lint.
- Isolated production-component browser checks passed: collapse/remount persistence, schema filter, active-folder reveal, simulated running item, dark/light appearance. Fresh reviewer accepted after one correction to pending category identity.
- Native app is responsive and reports Ready, but the user's database became empty during the work. No deletion was performed by this task. Historical native folder rendering and paid pipeline end-to-end remain unvalidated.
- Existing 200-run list cap remains. Detected categories cannot reconstruct a missing original schema. These additive manifest fields do not claim to capture the full execution environment.

## Links

- Project capture: /Users/dontizi/Obsidian/vault/projects/lirovo/lirovo.md
- https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/ — follows native button disclosure semantics.
- https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest — browser SHA-256 over full canonical UTF-8 schema; parity checked against Node crypto.
- Local working tree; no commit or publication.
