# Comparison review filter correction

Keep the existing comparison API compatible while applying the visible reviewed-only filter consistently.

```text
Reviewed-only checkbox -> preload boolean -> validated IPC -> engine -> corpus filter -> comparison
```

Pattern: existing typed bridge and effective-value query. Spike: yes — directly exercise the public comparison function in an in-memory database before adding a regression test.

Acceptance: a checked filter includes only approved observations; unchecked and legacy calls retain all non-rejected observations; source identity and complete values remain intact; no changes to stored decisions.

Scope: comparison function/test, preload method, IPC validator/protocol, engine dispatch, KnowledgePage call. Non-goals: changing search semantics, migrations, inference, review state or UI design.

Verification: direct runtime invocation before and after; focused knowledge and IPC tests; runtime build and desktop typecheck/build. Oracle: exact fixture membership and typed propagation, not native UI interaction or factual correctness. Root owns independent final integration smoke. Rollback: revert only this bounded patch, preserving unrelated edits.

## Observations

Before the fix, a real compiled `compareKnowledge(db, ["r1", "r2"], true)` returned two unreviewed observations while the equivalent approved-only search returned zero. The first scratch fixture omitted required source flags and failed its NOT NULL constraint; adding the actual required columns made the reproduction valid.

After the fix, direct invocation returned `{beforeApproval:[], reviewed:["v1"], legacy:["v1","v2"], explicitAll:["v1","v2"]}`. The runtime regression test followed these observations.

The first separate IPC probe failed because Node's type stripping did not resolve the source `.js` import to `channels.ts`; an attempted esbuild import was unavailable as a direct dependency. The IPC test was added prematurely before its separate probe succeeded; its observed assertions preserve omitted/true/false options and reject string `"true"`. A subsequent direct IPC probe via the installed Vite source loader returned the same accepted legacy/true payloads and rejected the string. Disable dependency discovery for this isolated loader to avoid unrelated dependency-scan errors while closing its server. No dependency was added to work around the harness failures.

Validation: runtime knowledge/answer tests 17/17, IPC test 1/1; runtime build and typecheck, desktop build (including typecheck and preload bundle verification), and whitespace diff check passed. The desktop build retains existing chunk-size and Vite `platform` option warnings. The bounded patch was reread across all six production call sites. Native comparison interaction and independent final acceptance remain with the integrator.

Verdict: adapt the existing comparison function with an optional boolean defaulting to false. No new dependency or query pathway.
