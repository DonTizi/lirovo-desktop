# Technical research workflow: contract and pilot protocol

## Summary

Add two focused presets for a repeatable technical-research task without replacing existing schemas or claiming that prompt instructions establish factual accuracy.

```text
Technical talk / benchmark video
    -> existing preset compiler -> source-linked extraction
    -> inspect source -> correct -> accept -> export
    -> compare source observations, not unqualified rankings
```

Pattern: additive configuration on the existing flat FieldSpec compiler; common field keys preserve comparison compatibility. Spike: yes, directly compile/decompile and validate real preset functions in a scratch invocation before tests. No new model API, dependency, nested-schema editor or storage format.

Presentation: the preset selector retains four Everyday extraction choices and adds a separate two-item Technical research group. Optional category metadata affects presentation only, never the compiled schema or saved identity. The compact picker adds first-outcome guidance only when fields exactly match a research preset.

Acceptance: technical-talk and benchmark-comparison appear through existing preset consumers; the four existing ids and definitions remain unchanged; compiled fields are closed/required and round-trip through the editor; descriptions require source attribution, stated units/conditions and explicit unknowns; no invented metrics, ranks or timestamps. Preset instructions are guidance, not an accuracy guarantee.

Files: packages/core/src/schema-builder.ts and tests, narrowly scoped SchemaPicker guidance if approved by integrator, this protocol and scratch probe notes. Non-goals: automatic semantic comparison, new telemetry, contacting participants, claims of market validation or automatic external exports.

Verification: real compiled compileSchema/decompileSchema/isStrictSchema/validateAgainst invocation; core preset tests, node-runtime schema validation tests where relevant, touched package builds/typechecks and final integrator smoke. Oracle: proves representability, schema shape and visible workflow wiring, not actual extraction quality or usefulness. Human evidence remains mandatory. Rollback: remove only these two additive presets/hint/tests; do not rename or rewrite saved schemas or historical runs.

## Preset semantics

- Technical talk: title, topics, key_claims, metrics, limitations, source_context. Distinguish assertions, demonstrated observations and attributed opinions. Capture only stated technical conditions and numbers.
- Benchmark comparison: title, systems, key_claims, metrics, limitations, source_context. Preserve model/version, benchmark/version, score, units, setup and attribution as complete strings when present. Do not combine scores from different setups into a ranking.
- Lists remain arrays of strings because the current visual builder cannot faithfully edit nested record schemas. Each metric string is a complete observation, not an invented normalized numeric record. Unknown list content is []; a missing title is an empty string. Source fields contain only named speakers, organizations, papers or versions from the source; source-time links remain the existing evidence envelope, never model-invented timestamps.

## Human pilot: execute only after consent and approval

Recruiting/outreach is not authorized by this implementation. The following is a protocol, not a report of completed research. Technical researchers doing weekly conference/demo review are a candidate audience, not a validated market.

1. With consent, recruit 5–8 people who already do this work. Use their own authorized material or a supplied local corpus. Record only participant codes; no names, raw media, transcripts or credentials in study notes.
2. Prepare equivalent FR and EN tasks with a manually checked source ledger: exact timestamp, claim, metric string/units/setup, caveat and known absent information. Include a slide/speech disagreement, an unstated metric and a sponsor claim. Two reviewers adjudicate disagreements before scoring.
3. Baseline: participant uses their normal workflow to produce a short comparison with three checked observations and one limitation. Counterbalance task order and use different but matched clips for Lirovo to limit learning effects.
4. Lirovo task: select a preset, start extraction with explicit backend policy, leave/return to review, inspect each source, correct a planted error if present, reject an unsupported claim, accept three observations, and export. Ask for the outcome, not a list of buttons to click; record assistance separately.
5. Reopen the export outside Lirovo locally. A reviewer checks exact values, attribution, source timestamps and whether the caveat survived. No result is considered usable solely because the user clicked Accept.
6. Offer an optional seven-day follow-up after consent. Ask whether they independently used Lirovo on a new real task and can show a local artifact; do not interpret an intention to return as actual repeat usage.

## Measurements (local manual worksheet; no telemetry added)

| Measure | Definition / denominator |
| --- | --- |
| Time to usable verified result | Task start to first exported artifact satisfying the predefined claim/source/caveat rubric, including wait and correction time. Report task failures separately rather than dropping them. |
| Completion | Unassisted completed tasks / all attempted tasks; assisted completions are a separate category. |
| Correction burden | Changed or rejected observations / inspected observations, plus active correction minutes. Report omissions found against the source ledger separately. |
| Grounding precision | Inspected exported observations correctly supported at the linked source / all inspected exported observations. Acceptance and link presence are not the oracle. |
| Critical errors | Wrong attribution, fabricated number/unit, reversed claim, unsupported ranking or broken source pointer escaping into the final artifact. |
| Repeat use | Consenting participants with a second independently completed real task within seven days / consenting participants eligible for follow-up. Record unavailable follow-up separately. |
| Perceived usefulness | Task-level 1–5 response and an open question: what would make you choose your old workflow? Qualitative, not proof of retention. |

Record each session as participant code, task/corpus id, app/model/schema versions, language/backend policy, baseline/Lirovo order, start/end, pass/assisted/fail, inspected/corrected/rejected/missing counts, critical errors, artifact verification and optional follow-up. Keep raw notes local under a user-approved location; agree retention and deletion before research. No automatic logging of private source content.

## Decision gates proposed before collecting results

Technical release gate: no critical evidence/value-loss defect in the scripted engineering corpus; all serializer/review/state checks green; any extraction quality failure remains visible and actionable.

Pilot continuation gate (proposed, not validated): at least 4 of the first 5 participants complete the artifact without assistance; no critical unsupported metric escapes final verification; median paired usable-result time improves relative to baseline without worse evidence precision. Small-sample numbers guide iteration only, not statistical generalization.

Stop and revise if users cannot distinguish claim from verified fact, confuse correction with acceptance, or trust an incompatible benchmark ranking. If meaningful repeat usage is absent, revisit audience/task before adding team/cloud features. Preserve negative findings and failures in the report.

## Research basis and known gap

The vault's Lirovo competitive note recommends technical research as an unvalidated candidate and emphasizes provenance. No completed recurring-user pilot was found in the scoped recall. Evidence-chain notes distinguish source pointers from factual correctness.

[NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/playbook/measure/) emphasizes validity in the intended context and documented test sets. [GOV.UK usability benchmarking](https://www.gov.uk/service-manual/measuring-success/usability-benchmarking-a-website-or-whole-service) supports realistic tasks, task completion and time measures. The proposed thresholds above are project hypotheses, not requirements from either source.
