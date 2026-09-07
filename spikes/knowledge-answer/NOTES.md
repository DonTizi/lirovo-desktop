# Grounded knowledge answer probe

Date: 2026-09-07. Verdict: adopt bounded retrieval-plus-synthesis, not semantic search.

## Contract

Use the existing SQLite knowledge retrieval and existing InferenceBackend. The user explicitly chooses a provider and grants per-request permission to send complete retrieved values, quotes and source metadata. No automatic fallback or paid retry. No evidence means no completion call. Require machine-valid citation IDs for every returned claim; keep citation coordinates server-derived. Cancel on Stop or page unmount. Archived runs and rejected values are excluded. No schema migration or new dependency in this workstream.

## Prior art and docs

Read the actual `lirovo-agent/packages/agent/src/tools/ask-corpus.ts` implementation and the vault's `corpus-rag-with-citations` page. One hybrid qmd recall and one graph-neighbor traversal found the existing retrieve/full-evidence/cite/no-hit-no-call pattern. The graph index reported stale, so source files and the existing pattern were read directly. The desktop currently has keyword retrieval, unlike the prior app's hybrid retrieval; it is labelled accordingly.

Official structured-output documentation confirms schema shape is not semantic truth. The existing OpenAI-compatible adapter supplies `response_format: json_schema`. Runtime also validates output structure and citations, because backend compliance is not assumed.

- https://github.com/openai/openai-node/blob/main/docs/structured-outputs.md
- https://openai.com/index/introducing-structured-outputs-in-the-api/

## Observed probes before tests

`node spikes/knowledge-answer/probe.mjs` creates an isolated in-memory SQLite corpus with 5,000 values and 5,000 timestamped evidence rows. The original per-value/per-run SQL loop was replaced with two batched queries. A counted Db adapter observed exactly two statements; keyword retrieval took 46.7 ms initially and 36.2 ms on a second run on this machine. It returned 100 complete records out of 5,000 matches and reports that retrieval boundary explicitly. These measurements are not an SLA for arbitrary corpus sizes or hardware.

The same script starts a real loopback HTTP server, then calls the production `askKnowledge` through the existing `createOpenAiCompatibleBackend`. It observed one POST with all 100 complete evidence records. The fixture completion cited E1 and the returned citation mapped to the saved source at 10–12 seconds. A second no-hit query returned insufficient evidence and the total completion-call count remained one.

This proves real HTTP transport, retrieval, schema/citation plumbing and source coordinates. The HTTP server returns a canned answer, not model inference; no paid or remote call was made. No claim of model answer quality is justified by this probe.

## Tests and limits

Focused runtime checks cover complete long-value prompts, no-hit/no-source/no-rejected calls, unknown/empty citations, inconsistent insufficient-evidence flags, cancellation, truncated completions, consent/provider mismatch, archived-run exclusion, effective corrections and the constant SQL statement count. Combined ASR+knowledge focused suite: 64 tests passing at this checkpoint. Runtime typecheck and desktop typecheck passed after the cancel API's object payload was aligned.

Remaining: live UI integration smoke and independent final review are integrator-owned. No semantic embeddings, automatic identity resolution, contradiction verification, conversational history, persistent generated answers or autonomous external tools are claimed. Citation membership validation does not prove textual entailment or factual truth; the UI says so and makes source moments clickable. The app sends no hidden snippets: every selected retrieval record and its evidence remain complete. Large full-context requests may exceed a provider limit and fail rather than silently truncating evidence.

Rollback: restore only scoped knowledge module/UI additions after review; no user data is changed by asking a question. ASR preservation changes are separately recorded in the quality spike.
