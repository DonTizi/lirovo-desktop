# Release readiness validation — 2026-09-07

## Verified correction

- Concurrent purge regression now uses one artifact and an explicit real-child SQLITE_BUSY handshake. Production purge code is unchanged. Original full-suite failure was 5s timeout plus `ENOTEMPTY`; the isolated original test had passed. New test proves exclusion until commit, completed file deletion, stable SQLite inode, surviving subsequent write and integrity; child stderr and cleanup are handled.
- Five shuffled, zero-retry runs of all 17 library tests passed, in 291–348ms per file run. Three whole-workspace uncached build/typecheck/test runs passed during correction; final state: **563 tests in 65 files**, **15/15 tasks**. Runtime 326, desktop 97, core 121, contracts 14, CLI 5. `pnpm lint` still has zero configured tasks; no lint coverage claimed. Syntax checks for both native scripts, CI YAML parse and `git diff --check` passed.
- Historical AV1 video plays on a clean isolated instance. Its earlier screenshot error is **not reproduced and its cause remains unknown**. No source codec/transcoding change is claimed.
- Real injected missing-file failure reproduced stuck playback even after restoring the scratch file. Same-URL `load()` failed to recover. A fresh query identity on the same stored path restores playback; native real AV1 copy decoded 40 frames, sought to 181.48s with audio at 181.37s, cleared error and survived Library/return.
- Portable `scripts/verify-playback.mjs` uses existing Electron and ffmpeg, not a plugin dependency. Actual built main/preload/renderer and media protocol verify persistent 404 remains retryable, restoration plus retry decodes video, seek and audio stay aligned, and an interrupted play promise does not mislabel a healthy video. Passed twice locally. Added to the macOS CI package job; the new remote CI run is not yet claimed.
- One native attempt closed mid-measurement; another launched while build artifacts were changing and had no window. Neither is passing evidence. Subsequent complete probes ran against stable builds. Scratch data is retained outside the repo; exploratory scripts are excluded from publication.

## Independent review

Final fresh-context checker verdict **ACCEPT**. Initial review drove play-promise error classification and portable native CI coverage; stderr capture and one-shot COMMIT observation improve failing-test diagnostics. Checker reviewed source read-only, not execution; the implementation runner supplied the deterministic/native evidence above. Ledger records pair `r20260907T175824Z-22479` with the final acceptance.

## Oracle, release gate and remaining limits

These checks prove the selected interleaving and native recovery path, not every codec, platform, malicious filesystem race, power-loss event or model output. Retry starts from the beginning and requires Play; corrupt or permanently missing media still fails. Clean AV1 and synthetic H.264 + FLAC are the tested inputs. Packaged signature/notarization/update delivery require their own release-job evidence.

No original extraction, results, source bytes or global user settings were changed. No commit/push/merge/release is claimed by this report. Human inspection of the final diff and checker verdict remains the required next checkpoint. Then push PR #34, require its latest-head CI, merge, inspect release-please's version/changelog PR, and authorize the signed release environment. Do not publish the stale waiting v0.4.2 as a substitute for the new code.

## Reproduce

```sh
pnpm turbo run typecheck test build --output-logs=errors-only --force
pnpm --filter lirovo-desktop exec node scripts/verify-playback.mjs
pnpm lint
git diff --check
```

The native command needs collected `apps/desktop/resources/bin/ffmpeg` or ffmpeg on PATH, plus the already-installed Electron. It creates and retains only its own temporary fixture/profile. Build first; do not overwrite bundles during playback.
