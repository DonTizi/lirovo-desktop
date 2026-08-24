# ASR chain — measured on real input

Date: 2026-08-24 · darwin arm64 (M-series) · reproduced by `asr-live.mjs` and `asr-local.mjs`.

## Measured

| Link | Input | Elapsed | Result |
|---|---|---|---|
| `captions` | YouTube `jNQXAC9IVRw`, 18.9 s, auto-captions | **2 006 ms** | 6 segments, 217 chars, correct text |
| `whisper-cpp` | 6.4 s of local speech, `ggml-base.en-q5_1` (57 MB) | **868 ms** | 2 segments, correct text, ~7x realtime |

`captions` costs about as much as fetching one file. `whisper-cpp` at 7x realtime
puts a 60-minute talk at roughly 9 minutes on the base model. The ordering in the
chain is therefore worth real time, not just a preference.

## What running it changed

- **`--sub-langs "en.*"` matched `en-de`.** That is an auto-TRANSLATED track, not
  English. The first live run transcribed a machine translation and then failed
  on a 429 for it. Globs are gone; the list is explicit and `-orig` comes first.
- **A non-zero yt-dlp exit is not decisive.** yt-dlp reports one failed track and
  still writes the others, so the `.vtt` on disk is the verdict and the exit code
  only explains an empty directory.
- **yt-dlp failures were unreadable.** Version nags and impersonation notices
  buried the one ERROR line. Failures are now summarised, and HTTP 429 is named
  as rate limiting rather than surfaced as a generic failure.
- **Rolling captions confirmed.** The dedup was written against a synthetic
  fixture; on the real track it produced **0 back-to-back 3-gram repeats**. Two
  parser bugs only showed up on real data: YouTube emits a single-space line
  before the payload (a `trim() === ""` cue terminator silently dropped the first
  cue of every video), and inventing word timings for tracks with no inline
  timestamps claimed precision the file does not carry.

## Limitations

- One video, one language, one model size. No long-form input, no non-English,
  no framerate-variable or audio-less source.
- `whisper-cpp` does not diarize: `speaker` is `null` on every segment.
- The 429 on the first captions run was real and is not reproducible on demand —
  rate limiting from a residential address is a condition the chain has to
  tolerate, which is why it falls through rather than failing the run.
