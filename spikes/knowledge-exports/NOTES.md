# Provenance export probe

2026-09-07. Scope: pure trusted-store export; native destination and UI wiring remain integrator-owned. Pattern: read-transaction snapshot with schema-shaped effective result and immutable review audit. No dependency or schema migration added.

Before tests, built node-runtime and directly invoked real openMemoryDatabase → persistExtraction → reviewValue → buildRunExport through compiled modules. Observed nested approved array item at original items[1] exported as items[0], explicit original/export path mapping, numeric and boolean types unchanged, all original values and reviews retained in audit. JSON parsed, CSV and Markdown produced complete content. Production data was not opened.

Verdict: adapt. Persisted leaf rows omit empty containers, so exports cannot promise exact original schema reconstruction. Export missing-required/schema errors as warnings; never invent null array holes. All-results intentionally includes rejected rows, labelled in UI/output; accepted-only excludes them from Results but audit still contains originals and notes. Clear sharing disclosure is mandatory.

Security research: https://owasp.org/www-community/attacks/CSV_Injection (quote every cell, guard formula-leading text); https://obsidian.md/help/syntax (footnotes, escaped Markdown and variable-length fences). JSON columns preserve complete canonical strings even when spreadsheet-safe display columns receive an apostrophe. Markdown only links credential-free HTTP(S) sources; local source locations stay literal provenance, not active file links.

Oracle: deterministic memory-SQLite round trips prove serializer fidelity, filtering, schema warning behavior and basic injection protections, not universal spreadsheet-import behavior, subjective UI quality or native save-dialog integration. No paid calls or external writes.

Checkpoint follow-up: direct compiled-runtime probe revealed bare negative-number JSON CSV cells received the formula-defense apostrophe, so JSON.parse(cell) failed. Adapted value_json to an object wrapper {value: typedValue}; every typed JSON column now begins with an object/array, and csvEncoding metadata describes JSON.parse(cell).value. Display-column apostrophe guards are explicit; canonical ids/paths remain in metadata and audit JSON. Added negative integer/decimal/string/null/boolean round-trip regression coverage.

The same direct probe confirmed an originally-null legacy value could not be corrected. Review now treats unresolved-schema null as unknown, permits explicit finite JSON, retains resolvable schema constraints and original history, and always reopens edits for separate acceptance. The renderer retains JSON mode for originally-null fields after a correction and discloses the limited validation. Probed actual correction null → -2.5 with originalValue:null and decision:reopened before writing regression tests.
