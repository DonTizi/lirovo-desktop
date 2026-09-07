# ADR 0005: Stable, non-destructive knowledge graph exploration

- status: accepted
- date: 2026-09-05
- spike: [native interaction probe](../../spikes/graph-interactions/NOTES.md)

## Context

Selecting graph content appeared to hide other content and could trigger source playback. The user requested Obsidian-style exploration while preserving the existing translucent desktop shell and real extraction data.

## Decision

Apply a **stable graph model with independent selection and viewport**. Render every node and valid edge throughout inspection. Emphasize the active neighborhood without filtering the graph. Keep source playback behind an explicit action.

## Why

A deterministic layout avoids selection-induced movement and a separate viewport avoids coupling pan/zoom to evidence playback. Small degree-sized dots, thin links and purple emphasis follow the supplied Obsidian references. A static screenshot or invented extra nodes would not provide meaningful exploration. No new dependency is needed for the observed 66-node graph.

## How it was implemented

`graph-model.ts` owns lossless node adaptation, stable synthetic IDs, unique-neighbor degree, bounded force placement, fitting, anchored zoom and label visibility. `graph-view.tsx` owns native pointer capture, SVG-coordinate panning, wheel/keyboard navigation, selection and full-text inspection. Only the graph tab expands across the result width; its recording remains below.

## How to implement it correctly next time

- Reserve every genuine source ID before allocating synthetic IDs; retain duplicate and missing-ID nodes without assigning their edges to another genuine node.
- Snapshot the inverse screen transform at pointer-down. Map movement into that fixed coordinate space and distinguish clicks from drags.
- Keep all graph elements rendered during highlighting. Display full text in the inspector and accessible labels; declutter whole canvas labels without rewriting content.
- Use a non-passive wheel listener when preventing page scroll. Anchor zoom under the pointer; provide Fit and keyboard alternatives.
- Observe real data and native gestures before writing regression expectations.

## Proof and limitations

Direct invocation on the existing extraction retained 66 nodes and 149 links with no omitted edges or source mutation, in about 26 ms. Native selection, Escape/Return, dragging, wheel/button/keyboard zoom and Fit were exercised; all nodes/links remained present and video stayed paused at zero during inspection. Desktop build/typecheck/preload guard and 51 tests passed, including 11 graph tests. Formatting and diff checks passed; root lint has no configured tasks. Fresh review accepted the ID-collision correction and the later label-decluttering change.

Force placement is bounded to 140 iterations for at most 300 nodes; larger graphs retain all nodes in a deterministic spiral rather than receiving an unbounded simulation. Label boxes estimate text width, so unusual glyphs may still need visual tuning. Tests establish display and interaction invariants, not extraction truth, exhaustive accessibility, packaged-app behavior or performance on vault-sized graphs. Changes are local and uncommitted.

## Links

- [Contract](../design/graph-interaction-contract.md)
- [Design QA](../../design-qa.md)
- [Obsidian graph behavior](https://help.obsidian.md/plugins/graph) — adapted visual and interaction conventions, not a pixel-identical clone.
- [SVG screen transforms](https://developer.mozilla.org/en-US/docs/Web/API/SVGGraphicsElement/getScreenCTM)
- [Pointer capture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)
- [Wheel events](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event)
- Vault project: `/Users/dontizi/Obsidian/vault/projects/lirovo/lirovo.md`; this repository ADR is canonical.
