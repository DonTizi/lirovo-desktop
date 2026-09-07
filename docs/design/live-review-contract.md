# Live extraction review

Open the extraction review on run:start and keep its state independent of navigation. Replace the misleading empty results view during processing with the approved live progress presentation; refresh partial artifacts without resetting the player.

```text
run:start -> keyed review session -> immediate navigation
events + serialized refresh -> session detail -> review
navigation away/back -> same run facts, refreshed artifacts
command completes -> refresh session, never steal navigation
```

Pattern: keyed session cache plus non-overlapping polling with cleanup. Accept: early review even before database row exists; progress visible above content; leave/return works; transcript/frames/graph/results update while open; terminal refresh; no response resurrects a closed tab; no late completion navigation; failures visible. Preserve approved fonts/materials, extraction engine, source records and graph. No changes to transcription quality in this task.

spike: yes — real runDetail/record shape and existing run:start timing inspected, then isolated full-App bridge replay exercises lifecycle without a paid extraction. Tests follow actual direct helper invocation. Files: App, run-view/tabs, focused polling/session helpers/tests, isolated replay and evidence. Build/typecheck/tests/format/diff plus fresh reviewer and browser navigation smoke. Oracle proves review continuity under replay and native saved-data rendering, not a new paid provider run or app-restart recovery during pre-ingest. Rollback only current scoped hunks/new files.

Recall: prior project progress ADR covers truthful stage states, not review navigation/partial artifact refresh. React official effect cleanup guidance checked: https://react.dev/learn/synchronizing-with-effects .
