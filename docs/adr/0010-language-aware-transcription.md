# ADR 0010: Language-aware transcription with explicit quality and cache boundaries

- status: accepted
- date: 2026-09-07
- spike: [real probes and evaluation](../../spikes/quality/NOTES.md)

## Context

Whisper.cpp defaults to English unless given `-l auto`; the installed English-only model cannot detect other languages. A French extraction screenshot showed repetitive English, while the existing parser accepted reversed timestamps. Successful process execution was being confused with usable evidence. Existing ASR cache identity included neither selected language nor model and bypassed quality checks.

## Decision

Keep the chain-of-responsibility and ports/adapters pattern. Use multilingual Base for fresh installs, retain explicit model overrides, send explicit auto/language arguments, and require per-run remote-ASR permission separately from API-key availability. Apply structural and conservative repetition checks before accepting any strategy. These checks are not confidence or semantic accuracy scores.

## Why

Changing typography cannot repair faulty source evidence. Automatically translating, silently downloading models into a profile or using a paid API would conceal the failure or change the user's processing policy. Fail actionably when an English-only model is selected for auto/non-English; retain the explicit English path.

## How it was implemented

Runtime `asr/quality.ts` checks empty speech, invalid/nonfinite/backwards timing, duplicate segment ids and repeated long phrases. `asr/index.ts` applies explicit remote policy, language defaults and a cache identity containing gate version, language, model path/stat and remote model policy. The ASR port exposes optional identity and validation hooks. Core media pipeline validates cached outputs before reuse and hashes actual transcript content into downstream identity. CLI exposes `--language` and `--allow-remote-asr`.

## How to implement it correctly

Probe real binary defaults and actual output before tests. Preserve complete text and source timestamps; report anomalies instead of rewriting them. Keep recognition adapters out of core. Cache identities must cover quality version and language/model choices; downstream caches must depend on actual recognized content. Retrying with different words must not reuse an older graph.

## Limitations and edge cases

Real local synthetic clips establish the source-language path, not general accuracy. Multilingual Base detected English and French correctly; English had 0/25 normalized word errors, French had 4/26. The French transcript passed structural checks despite lexical errors. Human/noisy/long/code-switched recordings remain a held-out evaluation requirement. Repeated long phrases can be genuine, so the error explicitly calls this suspicion rather than proof. Auto captions only trust platform-designated original tracks; otherwise local transcription is required. Renaming/replacing model files is not an adversarial integrity boundary; installed downloaded weights remain checksum-verified by the installer.

## Links

- [whisper.cpp CLI documentation](https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md)
- [yt-dlp subtitle options](https://github.com/yt-dlp/yt-dlp#subtitle-options)
- Local evaluator: `packages/node-runtime/scripts/evaluate-asr.mjs`
- Source changes are local and uncommitted pending integration review.
