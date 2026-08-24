# Vision through the harness — measured, and why the batch is 20

Date: 2026-08-24 · darwin arm64 · codex-cli 0.147.0 · `model_reasoning_effort=low`

## The assumption that was wrong

The plan said an agent CLI cannot do vision, and that a one-hour video would
need ~70 spawns at ten seconds each. Both halves were wrong.

An agent CLI reads image files perfectly well — it has a file tool — and the
frames do not have to arrive one batch per process. One session reads twenty of
them, keeps them in context, and answers about all of them.

Quality is not the compromise. On real frames the descriptions came back with
OCR down to Japanese station names (伊東 駅), star ratings, coordinates and
prices.

## Scaling, measured

One session per row, same frames, same prompt shape:

| frames | wall | tokens | tokens/frame | marginal tokens/frame |
|---:|---:|---:|---:|---:|
| 6 | 32.4 s | 20,577 | 3,430 | — |
| 20 | 56.6 s | 39,232 | 1,962 | **1,332** |
| 40 | 96.7 s | 87,213 | 2,180 | **2,399** |

Fitting the two segments: a session costs about **22 s and 12.6k tokens** before
it looks at anything, then roughly **1.7 s per frame**.

Two curves fight each other. The fixed cost wants big batches. But every image
stays in the conversation, so each new frame is priced against a longer
context — the marginal cost per frame nearly doubles between the 6→20 segment
and the 20→40 one.

They cross around twenty. Totals for the 107-frame fixture:

| batch | sessions | total tokens |
|---:|---:|---:|
| 6 | 18 | ~370k |
| **20** | **6** | **~210k** |
| 40 | 3 | ~262k |

**Bigger is not cheaper past twenty.** It only looks that way if you stop at the
per-frame average and never add up the sessions.

Coverage held at 40: 41 of 41 lines valid JSON, all 40 frames described, none
dropped. So the cap is an economic choice, not a reliability one.

## What shipped

- Batch of **20**, **2 sessions concurrently**. Two, not ten: every session bills
  against the same subscription window, and a user whose weekly quota is spent
  by one video cannot use their agent for the work they bought it for.
- `--effort low` by default. Describing a frame is perception, not reasoning.
- `images` is now `"inline" | "files" | "none"` rather than a boolean, and a
  request can carry `files` staged into the agent's sandbox.
- A malformed line costs one frame, not the batch. Re-running twenty frames over
  one fumbled comma is the expensive way to be strict.

## End to end, on the 12-minute fixture

```
ingest + normalize            0.6 s
asr (whisper-cpp)            17.8 s
scene-detect + dedup         10.8 s    125 detected → 107 kept
vision                      298.6 s    107/107 described, 6 sessions
graph                        62.9 s    26 nodes, 38 edges
reason                       16.4 s
──────────────────────────────────────
                              6 m 36 s
```

14 values, **14 grounded, 25 evidence spans: 13 audio and 12 visual.** Almost
every value is proven twice, once in speech and once on screen, seconds apart:

```
tools_shown[3]  "Notebook Navigator"   asr#seg_121@410s   frame#000081@386s
tools_shown[5]  "Doubleshift"          frame#000106@505s  asr#seg_149@509s
```

For comparison, the same video with no vision produced a **4-node** graph and 6
values. Frames are not a nice-to-have here; they are most of the content.

## Limitations

- One backend, one video, one language, one effort setting.
- 298 s of vision for 12 minutes of video is roughly 25 s per video-minute. A
  two-hour recording is about fifty minutes of vision at this batch size and
  concurrency — acceptable unattended, slow to watch.
- Concurrency of 2 was chosen for quota politeness, not measured against
  throughput. Higher may be strictly better on wall clock and strictly worse on
  the user's remaining weekly budget.
- Cross-modal agreement is visible in the output but is NOT yet used as a
  confidence signal, and should not be without care: a slide and the narration
  describing it are often two encodings of one source rather than two witnesses.
