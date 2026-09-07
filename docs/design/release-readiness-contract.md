# Release readiness correction — 2026-09-07

Make the concurrent purge regression deterministic and diagnose/fix the observed native playback failure before publishing the pending desktop changes.

```text
temporary SQLite profile -> explicit competing writer handshake -> purge -> integrity
stored recording (read only) -> isolated Electron review -> play / seek / audio
validated diff -> independent review -> human checkpoint -> PR CI -> release-please
```

- Pattern: explicit synchronization instead of timing assumptions; preserve native media streaming and immutable source artifacts.
- Spike: yes. Real scheduling and media decoding uncertainty; invoke production purge and actual Electron against temporary profiles before changing tests.
- Acceptance: no race based on creating thousands of files, competing write blocked until commit and persisted afterward, child always reaped; diagnose the historical media failure without claiming an unproven cause, prove clean playback and recovery from a reproduced read failure with real play/seek and audio checks. Add the repeatable native recovery check to CI.
- Non-goals: library purge, source replacement/transcoding without evidence, new dependencies, unrelated features, bypassing publishing approvals.
- Likely files: runtime library regression test; desktop player or media handler only if diagnosis warrants it; validation report.
- Verify: focused tests repeatedly, runtime/desktop checks, full `pnpm turbo run typecheck test build`, `pnpm lint`, isolated native review; `git diff --check` and fresh reviewer.
- Oracle: proves selected concurrency/media cases on this macOS/Electron version, not every codec, platform, power-loss event or signed installer. Signing/publishing need their own CI evidence and human checkpoint.
- Rollback: revert only this correction's hunks; keep all earlier user work and source data. No irreversible action until the final diff/verdict is inspected.
