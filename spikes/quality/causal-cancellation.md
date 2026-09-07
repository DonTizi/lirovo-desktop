# Preserve the causal transcription failure

An ASR failure aborts its visual sibling; the sibling's cancellation must not hide the original quality error.

```text
ASR quality failure -> stop visual sibling -> await both -> report ASR failure
User cancellation -------------------------------------> report cancellation
Frame-budget refusal ----------------------------------> preserve refusal
```

Bounded fix: existing media pipeline and focused tests only. No changes to queue state, quality checks or external process handling. Spike: yes, direct compiled pipeline invocation with the real LirovoError cancellation shape. Oracle: causal error/event priority, not actual recognizer accuracy. Rollback: revert only the error-priority branch and new tests; no data migration.

Before the fix, the direct probe threw TRANSCRIBE_FAILED from ASR but observed CANCELLED / ffmpeg cancelled / run:cancelled despite the user signal remaining false. The prior test used a plain Error for cancellation, which followed a different degradation branch from the real process adapter.

After the minimal fix, direct invocation produced TRANSCRIBE_FAILED for ASR failure, CANCELLED for an explicitly aborted user signal, and FRAME_BUDGET_EXCEEDED for frame-budget refusal. Regression cases were added after observing all three scenarios. The original ASR error instance is preserved, including its candidate artifact message.

Core focused tests: 12/12 passed; core build/typecheck and diff whitespace check passed. Root owns fresh review and native ASR integration.

## Hosted timestamp follow-up

The fresh review also directly invoked `parseVerboseJson` followed by `assertTranscriptQuality` with a segment containing an end but no start. Before the fix this accepted the candidate and invented `tStart=0`. The bounded follow-up replaces missing start/end fallbacks with NaN so the existing quality gate rejects them, while a genuine zero remains valid. Scope: hosted parser and its focused regression tests only. No provider calls or new dependency. Oracle: malformed-response handling, not provider accuracy.

After-fix direct invocation rejected missing start and missing end with TRANSCRIBE_FAILED and accepted explicit start=0/end=2. Hosted parser/quality/chain/review tests passed 33/33; runtime build/typecheck passed. Both bounded fixes were reread against their causal invariants; native and independent acceptance remain with the integrator.
