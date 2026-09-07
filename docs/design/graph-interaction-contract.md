# Knowledge graph interaction repair

Keep the graph visible and stable while users inspect a node. Separate reading its connections from playing a source.

Visual amendment — match the supplied Obsidian screenshots: a wide charcoal canvas, small gray/green/yellow nodes sized by unique connections, thin gray links, purple active node and incident links. Remove numeric node badges. Reveal complete short labels with zoom and full text on hover/inspection; never shorten stored content. Preserve surrounding nodes during selection. The graph uses the full result width, with the source recording below on this tab only. Add cursor-anchored wheel zoom and keyboard viewport navigation, retaining Fit graph and explicit source playback. No fake nodes to imitate the reference's much larger vault.

```text
Graph data -> deterministic layout -> all nodes + connections
                                   -> select node -> full details + related nodes
                                                  -> explicit source playback
Viewport: drag background / zoom buttons / Fit graph (independent of selection)
```

Pattern: stable graph model with explicit selection and a separate viewport. Acceptance: selecting/hovering never hides unrelated nodes; no implicit video playback; full selected labels and connection types are readable; click is not drag; zoom/pan use SVG coordinates; Fit restores every node; keyboard selection and Escape clear work; preserve every node, source and existing shell. No new dependency, data rewrite, extraction, release or unrelated redesign.

Files: graph-view.tsx, pure graph model and regression tests; scoped graph CSS if needed. Existing graph list remains available.

spike: yes — native SVG pointer/viewport behavior is the weak oracle. Inspect the current real 66-node graph, verify coordinate mapping in the native renderer, then smoke the replacement. No network or schema change.

Verify: direct invocation on existing graph before writing tests, focused tests, desktop build/typecheck/tests, formatting/whitespace, fresh-context review; native clicks/selection/clear/zoom/fit and 900px layout. Oracle: proves data retention, model invariants and exercised interactions, not extraction truth or every assistive device. Roll back only graph repair files/hunks, preserving previous uncommitted reader/media/shell work. No commit or publication.
