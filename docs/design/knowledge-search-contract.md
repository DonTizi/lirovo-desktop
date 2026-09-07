# Search-first Knowledge

Replace the multipurpose dashboard with a focused search experience using Lirovo's existing material and typography.

`search home -> query + filters -> ranked results -> source / timestamp`

- Pattern: existing local retrieval adapter, submitted-query state, stale-request cleanup, progressive disclosure for evidence.
- Acceptance: central search home; compact results header; single-column source-linked results with lossless highlighting; reviewed/source filters; loading, retry, no-match and empty-library states; keyboard submit/clear; pagination over whole returned records. Remove chat, comparison, provider setup and generation calls from this page.
- Preserve: complete text, review semantics, timestamps, ranking and 100-record retrieval limit. Explain that scope is extracted results and their quotes, not full-text transcript/graph search. Backend generation/comparison APIs remain unused here.
- Non-goals: new search infrastructure, migration, embeddings, backend deletion, navbar changes, PR/push/release.
- Files: KnowledgePage, dedicated CSS, presentation helper/tests, existing Knowledge ADR and this contract.
- Spike: yes, existing real memory-DB retrieval probe rerun before tests: `local` returned two complete hits/two runs, integrity OK. Native search IPC and source navigation will be exercised in a scratch profile.
- Verify: direct helper invocation before unit tests; desktop build/typecheck/tests; runtime knowledge tests; native full-page search/filter/empty/source navigation; delayed/error replay; narrow/light/reduced-motion checks; fresh-context review.
- Oracle: proves local wiring, no generation calls and UI state/rendering, not semantic recall or full transcript/graph search. User judges aesthetics. Rollback touched UI/docs only; no data changes.

## Validation — 2026-09-07

- `pnpm --filter lirovo-desktop build`: passed, includes typecheck and preload verification. Existing bundle-size and Rollup `platform` warnings remain.
- Desktop Vitest: 104 tests / 19 files passed. Focused runtime knowledge suite: seven tests passed. `git diff --check`: passed. Root lint command runs zero tasks; this is not lint coverage.
- Native harness: `/tmp/lirovo-knowledge-search-ewPZNR/check.mjs`, isolated `profile-valid`, real SQLite + engine IPC and generated six-second H.264/FLAC sources. Verified complete result text, accent-insensitive query, original ranking, 10-result pagination, page reset on filters, reviewed-only/source intersection, no matches, draft/submitted distinction, quote expansion and video seeking to 0:03.
- Transport-only replay: older delayed response cannot replace newer results; error is visible; Retry starts a fresh request and recovers. Empty-library response produces onboarding guidance. No generation/comparison calls or page errors. No user library or paid extraction used.
- Dark screenshots: `home.png`, `results.png`, `loading.png`, `error.png`; light 900×700 with reduced motion: `light-narrow.png`, all alongside the harness. No horizontal overflow; result animation computes to `none` under reduced motion. Screenshots contain synthetic fixture data, not production extraction claims.
- Initial probe mistakes were corrected: noncanonical fixture run IDs prevented artifact reads; checking ready state before submit committed could observe previous results. Native replay also caught retry reusing object identity; `requestSearch` now always creates a fresh submitted scope.
- Fresh read-only review accepted; applied clearer empty-input guidance, persistent live status, labelled filter group and result memoization. Reviewed full final diff locally after those changes.
- Remaining oracle limits: aesthetic approval and spoken screen-reader announcements are human checks. Search remains lexical over saved results/quotes, bounded to the first 100 ranked records; no transcript/graph indexing, semantic quality guarantee, navigation persistence, commit or publication.

Accessibility reference: [W3C APG search landmark](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/search.html), using a labelled search form and input.
