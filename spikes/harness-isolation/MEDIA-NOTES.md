# Media stages — measured against a real hosted run

Date: 2026-08-24 · darwin arm64 · ffmpeg 8.1.1 · gate: `scripts/golden-frames.mjs`

## Measured

An 11.8-minute video (708.0 s), local file, end to end:

```
ingest        56 ms     local file probed in place, never copied
normalize    510 ms     remux, not re-encode
scene-detect 8.2 s
dedup        3.0 s
asr         18.5 s      whisper-cpp, concurrent with the visual branch
------------------------------
wall clock  19.2 s      ~37x realtime
```

`ingest` at 56 ms is the no-copy decision paying off: the hosted engine has to
pull its source out of object storage and stage it, which for a 26 MB file is
seconds and for a two-hour recording is minutes of pure waste.

## Golden comparison

| Signal | Local | Hosted | |
|---|---|---|---|
| raw frame list (`idx` + `t_ms`) | 125 | 125 | **identical** |
| frames kept after dedup | 107 | 107 | **identical** |
| per-frame `phash` | — | — | 120/125 identical |
| per-frame `kept` | — | — | 123/125 identical |

All five differing hashes are at **hamming distance 2**, against a dedup
threshold of 5 — the noise floor. They come from JPEG encoder differences
between ffmpeg builds, and those two bits flipped which frame of one
near-identical pair became its cluster representative (54 vs 57), which is the
whole of the `kept` disagreement. The total is unchanged.

So the oracle asserts the raw frame list and the kept COUNT, and only reports
pHash drift. A gate that asserted hash equality would fail on an ffmpeg upgrade
and train everyone to ignore it.

## What running it changed

- **An uncut video was treated as a failure.** A single-shot recording produces
  zero frames past `select='gt(scene,0.3)'`; ffmpeg then reports "No filtered
  frames for output stream", fails to initialise an encoder it never needed,
  prints "Conversion failed!" and exits non-zero. Every static webcam recording
  and every screen capture without cuts would have degraded. The directory is
  now the verdict and the exit code only explains an empty one — the same rule
  already used for yt-dlp.
- **AV1 from YouTube arrives tagged limited-range**, and the mjpeg encoder calls
  that non-standard. `-pix_fmt yuvj420p` is what it is asking for. This was
  masked by the bug above and is a real issue on its own as AV1 spreads.
- **ffmpeg failures were forty lines of banner and build flags** before the one
  useful line. Summarised, like yt-dlp's.

## Limitations

- One golden video. No long-form (>1 h), no 4K, no variable framerate, no
  rotated video, no HDR.
- The frame cap is enforced but has not been hit on real input.
- `-vsync vfr` is deprecated in favour of `-fps_mode`. Kept because `-fps_mode`
  needs ffmpeg 5.1+, and until the bundled binary is pinned that trade is not
  ours to make. It costs one warning line on stderr.
