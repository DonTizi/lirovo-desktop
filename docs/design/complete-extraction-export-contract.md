# Complete extraction export contract

Add a portable, verified folder export for one extraction, preserving all stored analysis and media rather than just extracted values. Existing report formats remain unchanged.

```text
Review > Export > Complete extraction folder
  -> native parent-folder choice
  -> idle-library write lock + run-scoped database snapshot
  -> reports + raw records + all run artifacts
  -> inventory / SHA-256 verification -> published manifest
```

## Acceptance criteria

- Include complete result/review/evidence reports, run metadata/schema/stage history, all stored transcript files, raw/deduplicated frame images and frame manifest, visual analyses, full/compact knowledge graph, and stored source/normalized media.
- A versioned manifest records every exported file, its size/hash, relative paths, available analysis entrypoints and missing categories. Missing recorded artifacts fail rather than silently disappearing. Never fabricate data or truncate content.
- Folder exports always include all observations; accepted-only applies only to lightweight reports. Explicitly warn that originals, rejected values, prompts, media and local paths can be sensitive. External original media outside the run directory, credentials/settings/models and other extractions are excluded.
- Reuse verified library-transfer primitives: exclusive new folder, no symlinks/traversal/protected destination, streaming binary copy, integrity check and incomplete marker on failure. Wait for active/queued/orphan work to stop before exporting.
- Native dialog cancellation writes nothing. Return actionable success/failure; keep controls disabled during transfer.

## Engineering boundary

Pattern: immutable run-scoped snapshot plus verified file transfer. No new dependency or database migration. No ZIP, import/restore feature, external media fetching, source mutation, commit or publication.

Likely files: runtime export/verified-transfer helpers and tests; desktop export IPC/main/engine/UI; isolated probe. Existing backup behavior must remain covered by its tests.

Spike: yes — this extends a public export format and mixes database/file consistency. First invoke the current export and existing transfer against a disposable profile, observe exclusions and exact bytes; then invoke the new function before adding regression tests.

Verification: direct real-function probe, runtime export/backup tests, desktop IPC/native smoke, workspace typecheck/test/build, diff review by an independent checker. `pnpm lint` currently has no tasks and is not an oracle.

Oracle: counts, complete values, identities and file hashes prove export completeness relative to the saved snapshot, not correctness of model interpretation or host power-loss atomicity. Manual user review remains necessary for privacy before sharing. Rollback: revert only this increment; no schema migration or user-data rewrite is introduced.
