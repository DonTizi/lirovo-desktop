# ADR 0011: Reviewable, source-linked knowledge

- status: accepted
- date: 2026-09-07
- spike: [retrieval](../../spikes/knowledge-workspace/NOTES.md), [answers](../../spikes/knowledge-answer/NOTES.md), [exports](../../spikes/knowledge-exports/NOTES.md)

## Context

Extracted JSON and a graph are not enough to reuse a finding confidently. Users need to correct an observation, retain its original evidence, find it across videos and export a useful result. A timestamp establishes origin, not truth; source claims cannot be promoted into verified facts merely because they have citations.

## Decision

Use an **immutable original plus append-only review overlay**, exposed through the existing ports/adapters and validated typed desktop IPC. Search, comparison, generated answers and exports consume the same effective values and retain observation/run identity. Retrieval is explicitly lexical; generation is an independently consented operation using a chosen adapter.

## Why

Overwriting extracted rows would lose auditability. Automatically accepting corrections would confuse editing with verification. An additional extraction pipeline or a new vector service would duplicate existing behavior before a retrieval-quality oracle existed. Native save dialogs provide destination authority without allowing arbitrary renderer-selected write paths.

## How it was implemented

- `store/review.ts` appends decisions and correction payloads transactionally, checks the expected revision and keeps original values/evidence intact. Corrections reopen review; acceptance is separate. Drafts must be saved or cancelled before another decision.
- `knowledge.ts` batches effective-value and evidence reads, excludes rejected/archived results and preserves complete records. Comparisons apply the same reviewed-only filter and group schema field paths, not alleged entity equivalence.
- `knowledge-answer.ts` sends full retrieved values and source metadata only after explicit provider/scope consent, validates structured output and citation membership, and handles insufficient evidence without invented sources. Changing retrieval scope revokes consent. No automatic provider fallback.
- `export.ts` creates JSON, CSV and Markdown from a consistent database snapshot. Native destination validation prevents replacing the library/application. CSV uses an explicit JSON value envelope so negative numbers remain typed without permitting formula execution.
- Technical-research presets preserve attribution, exact measurements and stated limitations. They do not normalize incompatible benchmarks or declare winners.

## How to implement it correctly next time

Keep one effective-value projection and propagate every visible filter through every output mode. Pin edit revision when the editor opens, not only when Save is clicked. Treat cited text as untrusted data, never instructions. Validate structured model output and source references before presentation, but distinguish this from semantic entailment. Preserve full audit content and warn that exports can include rejected/original values and local paths. Probe exported files and native interactions, not just serializers.

## Evidence and limitations

Real Electron smoke verified edit/accept/history, restart persistence, timestamp seeking, reviewed-only comparison, a cited answer through the actual HTTP adapter against a loopback fixture, native-save IPC with controlled picker responses, and protected-path refusal. Runtime tests cover conflicts, wrong-run access, malformed output and lossless exports. The HTTP fixture is not a model-accuracy evaluation; controlled picker responses do not validate manual OS-dialog interaction.

Keyword recall, schema-field comparison and known citation IDs do not prove semantic completeness, entity identity, agreement or factual truth. Arbitrary complex JSON Schema validation is not promised for legacy corrections. Question/answer history is not persisted across navigation. Transcript editing/recomputation, semantic retrieval, entity resolution, assistant-facing APIs and held-out real-user evaluation remain separate work.

## Search-first desktop surface (2026-09-07)

The Knowledge page now exposes only local keyword retrieval: a search home, single-column source-linked results, reviewed/extraction filters and ten complete results per page. Chat, provider consent and comparison controls are removed from this page at the user's request. Their backend APIs remain intact but unused by this surface. This supersedes the earlier multipurpose Knowledge UI described above, not the review or export architecture.

Keep draft input separate from the submitted query, ignore obsolete responses, and allocate a fresh request identity even when retrying identical filters. The latter was caught by the native error/retry replay. Highlighting preserves every character, including combining accents and literal markup; quotes remain text, not HTML. The persistent status region updates without replacing its DOM node. Search covers saved extraction values, titles, field paths and linked quotes, not entire transcripts or graph artifacts.

Build/typecheck/preload guard, 104 desktop tests and seven retrieval tests passed. An isolated Electron library verified real search IPC, pagination, review/source filters, accent matching, complete evidence and source playback at 0:03. Controlled transport replay verified stale-response rejection, failure/retry and empty-library presentation; light/900px/reduced-motion checks passed with zero page errors or generation/comparison calls. Fresh review accepted; aesthetic preference and screen-reader speech still need human judgment. Search state is not persisted when leaving Knowledge. See [search contract and evidence](../design/knowledge-search-contract.md).

## Links

- [Implementation contract](../design/knowledge-workspace-contract.md)
- [Validation report](../design/knowledge-workspace-validation.md)
- [SQLite FTS5](https://www.sqlite.org/fts5.html): reviewed as an indexing option; this increment uses the existing SQLite projection rather than introducing FTS or embeddings.
- [Electron dialog](https://www.electronjs.org/docs/latest/api/dialog): native chooser owns destination selection; path safety remains application-specific.
- Vault prior art: `corpus-rag-with-citations`, `evidence-chains-extraction`, and the Lirovo project page. Local source changes remain uncommitted pending human inspection.
