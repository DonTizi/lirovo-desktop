# Schema navigation probe

2026-09-05. Verdict: adapt existing manifest storage and add a display-only category adapter; no migration.

- Read-only Node SQLite probe initially observed 13 runs with no saved schema/revision names. Three had full manifest schema JSON. Desktop extraction did not write that metadata at ingest.
- Direct `recordRunSchema` invocation on a migrated in-memory database stored the full Meeting schema and name. `runCategory` returned preset:meeting; integrity_check returned ok.
- Historical classification has no write path. Exact saved identity wins, then recorded/full schema, then explicitly labelled complete-field-set detection. Missing metadata does not imply transcript-only.
- Later the user's live DB changed to zero runs during work. No deletion was executed by this task; clarification requested. Native history validation switched to isolated fixtures; do not claim a post-change live 13-run oracle.
- Productionization: record on ingest, parameter-bound metadata; validate optional IPC name; preserve same field/model prompt unchanged; test ready/running/failed/missing data and group navigation. Script: apps/desktop/spikes/schema-navigation-probe.mjs (reads local DB, writes only memory).
