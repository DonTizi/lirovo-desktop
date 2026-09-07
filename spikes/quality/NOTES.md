# Language-aware transcription and quality gate

Date: 2026-09-07. Verdict: adopt with explicit accuracy limitations.

## Contract and oracle

Use the existing ASR chain and ports/adapters. Default new installs to multilingual Base, preserve explicit model overrides and language selection, require explicit remote-ASR consent, reject structural anomalies and obvious repeated decoding loops, and prevent cached transcripts bypassing validation. No user preferences, database, remote inference or installed model folder is modified. No semantic correctness guarantee is inferred from these checks.

## Recall and official sources

One hybrid `qmd query` across the configured collections found Lirovo's documented English-model risk and the evidence-chains concept. One graph-neighbor traversal confirmed provenance is a source pointer, not a correctness score. There was no existing local ASR accuracy corpus. Official whisper.cpp CLI documentation and installed `whisper-cli --help` both show language defaults to `en`, with `auto` explicitly required for detection. Official yt-dlp documentation permits regex subtitle selection; auto mode now requests only platform-designated `*-orig` tracks, falling back to local ASR if an original cannot be identified. Explicit languages do not silently substitute English.

- https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md
- https://github.com/yt-dlp/yt-dlp#subtitle-options
- https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin

## Real probes before tests

1. The original `parseWhisperJson` accepted a segment with start 2s and end 1s. This established the missing structural gate before creating regression tests.
2. Installed binary found at `/opt/homebrew/bin/whisper-cli`; the app had only English `ggml-base.en-q5_1.bin` installed. An English recording synthesized with the existing macOS Samantha voice, converted by real ffmpeg to 16 kHz mono WAV, transcribed correctly with `-l en`. No model installation or preference change.
3. With integrator authorization, downloaded multilingual Base into an isolated temporary directory. SHA-256 `422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898` matches the existing pinned install manifest. Nothing was installed into the app profile.
4. French recording synthesized with existing macOS Thomas voice. Called the real `createWhisperCppStrategy` with real ffmpeg and whisper-cli on both `auto` and explicit `fr`. Both reported `fr`, valid offsets and the complete non-looping transcript. English `auto` reported `en`.
5. `node spikes/quality/probe.mjs` directly exercised production chain and core pipeline before cache tests: the initial quality gate fell through to another strategy. Independent review correctly rejected that behavior. The revised gate stops on a typed quality error without automatic fallback, including when remote ASR was consented. Pre-abort returned CANCELLED without invoking another strategy; a present API key plus local failure did not include or call whisper-api; ASR invocation counts were 1 for repeated identical identity, 2 after language identity changed, 3 after cached text was corrupted.
6. `node spikes/quality/rejected-probe.mjs` exercised the revised production chain with an isolated executor writing six repeated output segments. Exactly two local executor calls (conversion and recognition), zero hosted calls, and one immutable `asr-quality-<uuid>.json` report preserved all six segments and complete text. The extraction fails actionably; this rejected candidate is not written as trusted transcript evidence. Integration exposes historical rejected output separately from the active failure.

## Measured local audio results

Production evaluator: `node packages/node-runtime/scripts/evaluate-asr.mjs <audio> <model.bin> <auto|language> <reference.txt>`. Build runtime first. It emits full reference/transcript, language, timing, normalized word edit distance and the explicit oracle. It does not download weights, call an API, or access the library.

| Clip | Model / mode | Actual detected language | Word edit errors | Oracle |
| --- | --- | --- | --- | --- |
| English 9.04s, Samantha TTS | multilingual base-q5_1 / auto | en | 0 / 25 words | One clear synthetic clip only |
| French 9.64s, Thomas TTS | multilingual base-q5_1 / auto | fr | 4 / 26 words, 15.38% | Source-language path works; model quality is not perfect |
| French same clip | multilingual base-q5_1 / fr | fr | Same observed transcript | Explicit language reaches the recognizer |

French reference: “Nous comparons trois modèles de langage. Le premier modèle est rapide. Le deuxième coûte moins cher. Vérifiez toujours la source originale avant de prendre une décision.”

Actual French: “Nous comparons trois modèles de langage, le premier modèle est rapide, le deuxième coûte moins cher, vérifier toujours la source origine à l'avant de prendre une décision.”

This is the important counterexample: anomaly checks passed despite lexical mistakes. They must never be called confidence, semantic validation or factual truth.

## Checks and remaining gates

- Node-runtime ASR tests: 47 passing across 5 files.
- Core media pipeline tests: 9 passing, including identity invalidation, cached-quality rejection and downstream transcript-content fingerprint change.
- CLI, runtime and core typechecks passed on Node 22.23.2. CLI and packages built.
- CLI real invalid `--language BAD` reports actionable usage error and exits 2 before any extraction/database initialization.
- No configured lint task exists in these packages; typechecking is not lint coverage.
- Full-workspace final checks and independent integration review remain with integrator.
- Not validated: noisy speech, multilingual/code-switching clips, long videos, captions on live platforms, held-out human recordings, exhaustive supported languages or WER target. No paid inference call was made.

## Productionization and rollback

- Implemented: original-language captions, multilingual install default, explicit language arguments and detected-language metadata, opt-in hosted fallback, cancellation boundaries, quality checks, cache identity and cached-quality validation, downstream content fingerprint, reproducible local evaluator.
- Existing English-only installations remain usable with explicit English or `--language en`; Auto/non-English returns instructions to install multilingual Base. No background download or automatic provider change.
- Roll back only these scoped source changes after review. Scratch audio/weights can be removed independently; no database migration or user-data rollback is needed.
