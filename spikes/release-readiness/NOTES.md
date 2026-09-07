# Release readiness spike — 2026-09-07

## Goal and observed baseline

- Production `purgeEverything` retained the database inode and serialized a real external writer correctly. The prior regression manufactured scheduling overlap with 3,000 serial file writes; the full suite exceeded Vitest's 5-second timeout and teardown raced the still-running fixture (`ENOTEMPTY`). The same test passed alone.
- The actual saved AV1/FLAC recording decoded correctly in a clean, isolated production Electron review. Playback advanced 39 frames and seek reached 181.48s with paired audio within 80ms. The historical unable-to-play screenshot's cause is not reproduced; do not claim a codec fix.
- Removing only a scratch copy of the recording produced a real 404, and restoring it left the media element stuck. Calling `load()` on the same failed URL did not recover it. A fresh query identity on the same pathname did.

## Adopted behavior

Explicit cross-process synchronization: signal only after BEGIN IMMEDIATE; the child proves SQLITE_BUSY (numeric 5), then retries on its original open connection. Before delegating COMMIT, verify the child proof and completed artifact deletion. Assert preserved inode, child's successful exit, surviving new row and SQLite integrity. One tiny artifact replaces 3,000 timing ballast files.

Reload video and paired audio with a user-triggered `playbackAttempt` query. Original bytes/path are unchanged. Only a real media-element error marks video unavailable; an interrupted play promise is not decoder failure.

## Proof and limits

Native real AV1 recovery subsequently advanced 40 decoded frames, sought to 181.48s with audio 181.37s, cleared the warning and survived Library/return. A portable production regression now generates an H.264 + FLAC fixture with existing ffmpeg, launches the built app using installed Electron and checks persistent/restored read failure, decoded frames, seek/audio and play-promise interruption. No Playwright dependency is shipped. Run `pnpm --filter lirovo-desktop exec node scripts/verify-playback.mjs` after building; CI invokes this after collecting binaries/building.

The exploratory scripts stay local; only explicitly productionized verification scripts and unit regressions are publication inputs. Temporary copies are retained outside the repository, never the user's original run. Do not run a Vite production build concurrently with a native probe reading those build files; one observed launch had no window while bundles changed. Another window closed mid-measurement; neither interrupted run is counted as passing evidence.

Verdict: adapt. Production behavior and assertions were rewritten in the renderer, runtime regression and desktop verification scripts. No source transcoding, production purge, new dependency, or claim of historical-cause resolution. Other codecs/platforms and signed installers need their own validation.

Official references: https://vitest.dev/api/test and https://www.electronjs.org/docs/latest/api/protocol .
