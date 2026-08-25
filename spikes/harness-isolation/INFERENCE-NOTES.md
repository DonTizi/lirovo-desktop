# Inference stages — measured end to end

Date: 2026-08-24 · darwin arm64 · backend: codex-cli 0.147.0

## Measured

A 19-second YouTube video, schema with `topic`, `location`, `observations[]`:

```
ingest + normalize + asr + scene-detect   ~2 s   (captions, no scene changes)
graph   (Pass A)                         16.8 s   1 window, 4 nodes, 4 edges
reason  (Pass B)                          9.5 s
────────────────────────────────────────────────
                                         30.8 s
```

Result: **6 values, 6 grounded, 8 evidence spans.** Two of them are backed by
more than one segment:

```
observations[0].subject  "Elephants"                asr#seg_0 @ 1.2-3.4s
observations[1].subject  "Elephants' long trunks"   asr#seg_1 @ 5.3-8.0s
                                                    asr#seg_2 @ 8.0-12.6s
observations[1].detail   "They are cool."           asr#seg_3 @ 12.6-14.4s
location                 ""                         asr#seg_0 @ 1.2-3.4s
```

`location` coming back empty is the prompt rule working: the transcript never
says where this is, so the model used the neutral schema-valid value and cited
the closest node rather than inventing a zoo.

The review queue puts every value at priority 90 — single-source coverage plus
an unmapped label — which is correct while no governed vocabulary exists.

## What running it changed

- **Codex's `--output-schema` is OpenAI STRICT mode, not "a JSON Schema".**
  Every object must set `additionalProperties: false` and list every property
  in `required`; anything else is a 400 before the model runs. The knowledge
  graph schema is deliberately open — a model may describe a node with fields
  we did not anticipate — so the adapter now tests the schema and lets it
  travel in the prompt when strict mode cannot carry it. Contorting the schema
  to fit the transport would have thrown away the openness on purpose.
- **The validator's first error is useless for repair.** `@cfworker` reports the
  whole chain from the root: `Property "data" does not match schema`, then the
  same about the property, then finally `Expected "number"`. Only the leaf tells
  a model what to change, and showing it the wrappers invites it to "fix" the
  envelope. Ancestors are now filtered out.
- **SIGTERM alone does not stop ffmpeg.** A cancelled run left an ffmpeg burning
  CPU after everything else was gone. Cancellation now escalates to SIGKILL
  after a two-second grace period, and the whole process group is signalled.
- **Artifacts and the database were being written under two different ids.** The
  artifact directory is named before the run row exists, and the store minted
  its own id — caught by the typechecker, not by a test. `createRun` takes the
  id now.

## Limitations

- One backend measured (codex). The local OpenAI-compatible path is written but
  no server was running to exercise it.
- One window. Multi-window merge is unit-tested but has not run against a real
  long transcript.
- No vision: frame analyses are not produced yet, so Pass A builds from speech
  alone. That is a valid mode, not a degraded one, but the visual half of the
  evidence model is unexercised end to end.
- 16.8 s for one graph window is the harness cost, not the model's. A persistent
  local server would remove almost all of it.

---

# Bug hunt after resume landed (2026-08-25)

## Silent truncation — the one that mattered

A download killed halfway leaves `source.mp4.part`. The ingest fallback picked
any file starting with `source.`, so it took it — and then **ffprobe reported
the full duration anyway**, because an mp4's header sits at the front and
describes a video the file no longer contains.

Measured on a real file truncated to 40%:

```
ffprobe on the truncated file : 19.014s, 2 streams, exit 0
what ffmpeg could decode      :  6.533s   ("partial file" on stderr)
intact control                : 19.013s vs 19.014s
```

So every guard passed, the run succeeded, a third of the talk was transcribed,
and nothing said a word. Two fixes:

- `isPartialDownload` excludes `.part`, `.ytdl`, `.temp` and format-tagged
  fragments (`source.f399.mp4`) from the fallback.
- Normalize cross-checks the DECODED audio duration against what the container
  promised, with a tolerance of `max(1s, 2%)`. The decoder is the only thing
  that knows the truth. New code: `SOURCE_TRUNCATED`.

Verified end to end: the truncated file now fails at normalize with
`the source claims 19.0s but only 6.5s could be decoded`, exit 1, while the
intact file runs normally.

## Resume hint pointed the wrong way

Cancelled runs print how to resume, which was new and right. It printed for
EVERY failure, including a truncated source that will fail identically forever.
Now gated on a set of codes a second attempt could actually get past.

## Two processes on one run — claimed, now proven

Process A started a run; process B tried to `--resume` the same id while A was
still working and was refused with `RUN_ALREADY_CLAIMED`. A finished cleanly and
released its lease. The leases were unit-tested before; this is the first time
they were exercised under a real race.

## Not a bug: the 450s transcription

The same file transcribed in 17.8s on one run and 450s on another. Metal is
loaded (`load_backend: loaded MTL backend`), so this is CPU contention with
leftover processes from an interrupted run, not a defect. Worth remembering as
the reason resume earns its keep.

## Still unproven

- Interruption during a URL download specifically (the truncation guard covers
  the consequence, not the moment).
- Disk full mid-write. The artifact store maps ENOSPC, but ffmpeg writes
  straight to the artifact path and bypasses it.
