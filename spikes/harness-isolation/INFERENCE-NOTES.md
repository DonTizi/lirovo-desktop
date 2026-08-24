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
