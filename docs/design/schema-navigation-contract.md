# Schema navigation

Replace the flat sidebar with schema folders; preserve the selected schema for future runs and honestly classify legacy entries without rewriting them.

```text
Selected schema -> request -> existing run manifest at ingest
                                   |
Stored schema / manifest / legacy field names -> category -> sidebar folders
                                                         -> library filter
```

- Pattern: pure presentation grouping, existing manifest persistence and disclosure navigation. No database migration or new dependencies.
- Acceptance: collapsible folders, counts, recent-first children, selected/running/failed state retained; unknown legacy runs remain visible; detected legacy categories are labelled; collapse choices survive sidebar remount; new runs keep their category from start through completion/restart; library can filter by the same categories.
- Non-goals: changing extracted data, guessing category from video title, retrospective data writes, running paid extraction, pagination beyond existing 200-run list.
- Files: NavBar, library, App, bridge contract/validator, engine-host; small category/grouping helpers and tests; isolated preview.
- Spike: yes. Read-only real database probe found all 13 runs lack a stored schema name/revision, and only three have manifest schema JSON. Exercise existing manifest write/read in an in-memory migrated database before tests; verify inference only against complete top-level field sets.
- Checks: direct helper invocation, desktop tests/build/typecheck/preload guard, scoped formatting/diff, native and isolated UI folder/filter/callback checks, fresh-context review.
- Oracle: proves categorization/persistence on scratch DB and UI navigation against real/simulated rows, not historical original-schema identity or paid pipeline end-to-end. No user history is mutated by classification.
- Rollback: revert only scoped changes; new optional manifest metadata is additive and old readers ignore it.

## Validation — 2026-09-05

77 desktop tests, typecheck, production build and preload guard passed. Scoped formatting and whitespace checks passed; no desktop lint command is configured. Direct memory-database round trip and integrity check passed. Pending/persisted identity parity is covered for every schema kind. Fresh reviewer accepted after one pending-key correction.

Production-component browser preview verified folder collapse/remount, library filters, active-folder reveal, simulated live-run grouping, dark and light appearances. Native app is responsive and Ready with zero runs. The database changed from thirteen runs to zero during work without a deletion by this task; user clarification is pending. Therefore native historical rendering and paid extraction end-to-end are not claimed. No live history was rewritten. Canonical decision: ../adr/0009-schema-navigation.md.
