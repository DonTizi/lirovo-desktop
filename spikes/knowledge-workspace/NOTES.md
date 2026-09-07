# Knowledge retrieval spike

Direct invocation before regression tests: `node spikes/knowledge-workspace/probe.mjs` against actual node:sqlite memory database and built runtime modules. Two successful run rows with French/English full values returned two source-preserving hits for local; comparison grouped both entries under topic; integrity_check returned ok. First hand-written probe used SQLite double-quoted literals and failed; production queries bind parameters and the corrected probe uses binds.

Verdict: adapt. Existing review projection can feed cross-run retrieval without overwriting original rows. Initial retrieval is explicitly keyword-based; no semantic or agreement claim. Run content is complete per retrieved record. Search and comparison need browser integration and scaling work; this spike does not establish model answer accuracy.

Prior art: corpus-rag-with-citations vault page and lirovo-agent/packages/agent/src/tools/ask-corpus.ts, read before adopting source-preserving retrieval. Official SQLite FTS5 documentation reviewed; no FTS migration/dependency introduced in this initial projection.
