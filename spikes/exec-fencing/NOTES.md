# Tracked subprocess startup contract and probes

Prevent an extraction subprocess from touching shared artifacts before its process group has been durably recorded. Keep the existing Exec adapter and full argv, stdin, environment, timeout and cancellation behavior.

```text
spawn gated process group -> synchronous journal commit -> grant on fd 3 -> exec binary
parent crash before grant -> gate EOF -> exit without running binary
parent crash after grant  -> recorded group -> recovery refuses overlap while alive
```

Pattern: fail-closed startup handshake plus existing ports/adapters. Spike: yes, process lifetime and IPC require real OS verification. Own `src/exec.ts` and focused process tests; reliability owns the durable journal and resume integration. No new dependencies. Non-goal: automatically killing a recorded PID, Windows support for the POSIX gate, proving arbitrary programs cannot deliberately escape their process group.

Acceptance: journal callback completes synchronously before target code runs; callback failure, pre-cancellation or EOF cannot start it; full Unicode stdin and literal arguments survive; ordinary command failures/timeouts/cancellation remain actionable. Verify Node 22 runtime typecheck/build and focused real-process tests. Oracle: real child execution and marker/output observations establish the handshake, not full application recovery or every external tool's daemon behavior. Rollback is scoped changes only, no library/profile migration rollback.

## Before implementation

- Production `realExec` under a disposable parent reproduced the orphan issue: after killing the parent with SIGKILL, a detached child overwrote `normalized/audio.flac` from `new owner B` to `stale owner A`. Scratch: `/var/folders/4t/wjt0c0cd51jgn1ypy8xry_hh0000gn/T/lirovo-orphan-review-Y8ydFo`.
- Direct `/bin/sh` + Node spawn probe, separate pipe at fd 3: granted command exited 0 and preserved complete Unicode stdin, environment and a literal `a $ b` argument. Closing the gate without a token exited 125 with no target stdout.
- Node official child-process docs confirm extra `stdio` pipes and detached process groups: https://nodejs.org/api/child_process.html#optionsstdio . POSIX read documentation fetch was unavailable; actual installed `/bin/sh` was exercised instead.

Verdict: adapt. Record the group before granting execution; recovery must check group liveness rather than just the former parent's PID. Keep command stdin separate from the gate, and pass user arguments as positional argv, never interpolate them into shell code.

## Productionized checks

- Direct invocation of `createTrackedExec` from the TypeScript source under Node 22 preserved 1,350,000 characters of complete Unicode stdin and literal shell-looking argv. A throwing journal callback prevented target execution. Missing commands, cancellation and timeout produced `DEPENDENCY_MISSING`, `CANCELLED` and `TIMED_OUT` respectively.
- A disposable parent killed itself inside the synchronous journal callback. The shell gate exited on EOF and the target marker was never created.
- The installed macOS shell reports a missing absolute command as exit 126, unlike a bare missing command. Added `command -v` after grant to make missing dependency behavior consistent; command arguments remain positional, never interpolated.
- An additional direct probe exposed the prior adapter decoding each byte chunk independently: writing UTF-8 bytes C3 and A9 in separate stdout chunks produced two replacement characters. Stream UTF-8 decoding now preserves `é` across chunk boundaries, covered for stdout and stderr.
- One vault recall returned persistent tmux sessions, filesystem-backed agent state and parsing-lane crash recovery. These are adjacent prior art; no gate protocol was recalled. The process crash and pipe behavior above are the implementation evidence.

Limitations: POSIX macOS/Linux only; Windows tracked execution fails closed. Process-group containment assumes supported media tools do not deliberately daemonize into unrelated sessions. An unknown/reused/live process group must block recovery rather than be killed automatically. Final application/store integration is reviewed separately from this primitive.

## Verification result

- `pnpm --filter @lirovo/node-runtime test src/exec.test.ts`: 7 passed, including real SIGKILL-before-grant and SIGTERM-resistant child escalation.
- `pnpm --filter @lirovo/node-runtime build`: passed (TypeScript compilation).
- `git diff --check` for the primitive/tests/notes: passed. No lint task is configured in this package.
- Reliability workstream independently reviewed the primitive without blocking findings. The reviewer also checked the UTF-8 stream-decoder refinement.
- Independent recheck of the reliability integration: runtime process journal, run store, ledger, artifacts and media suites: 83 passed across 5 files. These include a real detached target surviving its killed parent, with resume refused while the group lives and allowed after exit, and late publication refused after release/DB closure. This closes the reproduced overlap case for tracked POSIX tools; it does not prove native end-to-end UI or arbitrary daemon containment.
