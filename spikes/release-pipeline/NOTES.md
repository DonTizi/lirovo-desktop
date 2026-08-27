# Spike — packaging and the release pipeline

Verdict so far: **adapt**. Bundling works and is worth it; three things had to change to
make it true, and one of them was a defect that built green.

Run on an Apple M2 Pro, macOS 24.6, electron-builder 26.15.3, Electron 44.

---

## What is in the bundle

| tool | origin | size | how |
| --- | --- | --- | --- |
| ffmpeg / ffprobe | `descriptinc/ffmpeg-ffprobe-static` @ `b6.1.2-rc.1` | 47 MB each | downloaded per target arch |
| whisper-cli | built from `ggml-org/whisper.cpp` @ `v1.9.3` | 3.4 MB | cmake, 33 s |
| yt-dlp | `yt-dlp/yt-dlp` latest `yt-dlp_macos` | 37 MB | downloaded, sha256 verified |

`resources/bin` totals ~130 MB; the DMG is **227 MB**.

---

## Findings

### 1. An x64 DMG shipped arm64 binaries, and every step reported success

Declaring `arch: [arm64, x64]` inside the mac target made one invocation package **both**
architectures out of a single `resources/bin`. The x64 app came out with an x86_64 Electron
binary and **arm64** ffmpeg, ffprobe and whisper-cli inside it:

```
release/mac/Lirovo.app/Contents/MacOS/Lirovo        Mach-O 64-bit executable x86_64
release/mac/.../Resources/bin/ffmpeg                Mach-O 64-bit executable arm64
release/mac/.../Resources/bin/whisper-cli           Mach-O 64-bit executable arm64
```

The only symptom would be `Bad CPU type in executable` on an Intel Mac, after release.

**Fixed twice over.** The arch now comes from the command line, one per invocation, matching
the collector that ran before it. And an `afterPack` hook refuses to continue when a bundled
tool does not match the arch being packed. Reproduced deliberately after the fix:

```
⨯ packing x86_64 but these bundled tools are not x86_64:
  ffmpeg (Mach-O 64-bit executable arm64)
  ffprobe (Mach-O 64-bit executable arm64)
  whisper-cli (Mach-O 64-bit executable arm64)
Run: node scripts/collect-binaries.mjs --x64 after clearing resources/bin
```

Zero DMGs produced. The failure is loud now.

### 2. ggml bakes the build machine's CPU into the binary

`GGML_NATIVE` defaults ON, which passes `-mcpu=apple-m2` — the *build host's* CPU — to the
compiler. Cross-compiling for x64 that is an immediate hard stop:

```
error: unknown target CPU 'apple-m2'
```

Built natively it is worse, because it succeeds: an arm64 binary compiled on an M2 carries M2
instructions and can fault on an M1 belonging to someone who was never part of the build.
`-DGGML_NATIVE=OFF` always, not only when cross-compiling.

### 3. Metal is real and the shader is embedded

```
ggml_metal_library_init: using embedded metal library
ggml_metal_device_init: GPU name:   MTL0 (Apple M2 Pro)
```

`GGML_METAL_EMBED_LIBRARY=ON` means no loose `.metal` file beside the binary — nothing extra
to sign and nothing to go missing. Transcribed the test clip correctly.

`otool -L` shows no links outside `/usr/lib` and `/System`, so it is self-contained.

### 4. yt-dlp costs 10 seconds every time it is invoked

Measured on the bundled copy, arm64:

```
run 1: 11.7s     run 2: 10.6s
```

It is a **universal** binary (x86_64 + arm64), so this is not Rosetta — it is PyInstaller
unpacking itself on every launch. It passes both architecture checks for the same reason,
which is why the arch guard tests for *containing* the wanted slice rather than equalling it.

Bundled, that cost lands on the version probe at every app start and on the title lookup for
every URL pasted. **Open:** cache the version probe by path + mtime, so app start does not pay
it. The extraction path itself does not care — ten seconds is noise beside a two-minute
download.

### 5. The two architectures ship different ffmpeg versions

At the same pinned tag `b6.1.2-rc.1`, the arm64 asset is **6.1.1** and the x64 asset is
**7.1**. Both are ≥ 5.1, so `-fps_mode` exists in both and the one code path drives both.
Recorded rather than fixed: pinning by tag does not pin the version.

### 6. `whisper-cli --help` was being read as a version

`DependencySpec` asked for `--help` and the probe took its first line, so Settings displayed
the binary's own path where a version belongs. `whisper-cli --version` prints
`whisper.cpp version: 1.9.3`. Fixed.

---

## The acceptance test, passing

`lirovo doctor` against the packaged bundle, Homebrew removed from `PATH`:

```
dependencies
  ok    ffmpeg       7.1          (bundled)  …/Lirovo.app/Contents/Resources/bin/ffmpeg
  ok    ffprobe      7.1          (bundled)  …/Lirovo.app/Contents/Resources/bin/ffprobe
  ok    yt-dlp       2026.08.19   (bundled)  …/Lirovo.app/Contents/Resources/bin/yt-dlp
  ok    whisper-cli  1.9.3        (bundled)  …/Lirovo.app/Contents/Resources/bin/whisper-cli
```

`resolveBinary`'s bundled branch had existed since it was written and had never had a value to
look in. It does now.

---

### 7. The main binary was carrying yt-dlp's entitlements

`entitlements` and `entitlementsInherit` pointed at the same file. electron-builder gives
`entitlements` to the .app bundle alone and `entitlementsInherit` to **every other Mach-O it
signs** — the helpers, and everything listed in `mac.binaries`. One file for both meant the most
privileged process in the app was signed with `disable-library-validation` and
`allow-dyld-environment-variables`, two keys that exist only so a PyInstaller binary can unpack
itself and dlopen what it unpacked.

Split. The main binary now carries `allow-jit` and `network.client`; @electron/osx-sign gives its
main app `allow-jit` alone, so this is one key above that floor. The inherit file is the union of
what the helpers need and what the tools need, with each key naming the consumer that forces it.

**Open, and deliberately so:** `allow-unsigned-executable-memory` stays in the inherit file
without a justification. @electron/osx-sign gives it only to the *plugin* helper — renderer and
GPU get `allow-jit` alone — so it is probably unnecessary here. Dropping it is also the classic
cause of "the signed build crashes on launch", and there is no signed build of this app to test
the claim against. First signed build: drop it, launch, and keep the answer.

### 8. The beta channel writes its own feed, and `--publish never` does not stop it

The one thing that could not be got wrong twice: a preview build writing `latest-mac.yml` hands a
beta to every stable user. Earlier finding — building `0.0.1-beta.1` and letting electron-builder
infer the channel from the version wrote **`latest-mac.yml`**. Inference does not work for the
`github` provider.

The explicit flag does, and it survives `--publish never`. Built locally:

```
electron-builder --mac --arm64 --publish never -c.publish.channel=beta
→ release/beta-mac.yml
```

That matters twice over, because the release job no longer publishes from the matrix — it builds
with `--publish never` and uploads afterwards. Had `--publish never` suppressed the feed, the
merge step would have had nothing to merge and the release would carry no update metadata at all.
It does not: the feed is written either way.

The merge and the both-architectures gate were then run against a real `beta-mac.yml`: 2 feeds in,
4 files out, gate passes; either single-arch feed is blocked.

### 9. The publisher never checked the repo out

Found by re-reading the workflow rather than by running it. `publish-release` ran
`pnpm install --frozen-lockfile` and `node apps/desktop/scripts/merge-update-feeds.mjs` in a
workspace with no repository in it. It would have failed on the first command of the first real
release, after both architectures had already signed and notarised — the most expensive possible
place to discover a missing four-line step.

---

## Still open

- **Signing and notarisation.** Everything above is unsigned (`CSC_IDENTITY_AUTO_DISCOVERY=false`).
  `spctl -a -vvv -t install` and `codesign -dv --verbose=4` on every Mach-O are not yet run,
  and the entitlements list is not yet proven — in particular whether a PyInstaller yt-dlp
  launches under hardened runtime. That is the remaining gate on bundling it at all.
- **A real update cycle.** Install vN, publish vN+1, watch it update itself.
- **The GPL obligation** for the bundled ffmpeg: attribution and a corresponding-source offer
  in `NOTICE`.
