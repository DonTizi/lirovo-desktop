# ADR 0006: Guided connections with bounded presentation motion

- status: accepted
- date: 2026-09-05
- spike: [real graph probes](../../spikes/graph-interactions/NOTES.md)

## Context

The user selected the third proposed design: a topic index, airy connection canvas and inline source inspector integrated into the translucent desktop shell. The extraction contains long labels and 149 genuine connections, unlike the illustrative mock's short labels and sparse topology.

## Decision

Extend ADR-0005's **stable model and independent interaction state** with a bounded presentation layer. Keep all nodes and links, apply gentle settling/drift to copied coordinates, and pin individually dragged nodes. Selection emphasizes connections but never filters data or starts playback.

## Why

A live force simulation could continually move inspection targets. A static image would not support real exploration. Bounded presentation motion supplies the requested movement without changing semantic relationships or introducing a dependency. Use the existing system type, Lucide icons and theme tokens.

## How it was implemented

`graph-presentation.ts` owns full-content topic search, theme color families, small screen-sized dots, bounded motion and collision-aware whole-label placement. `use-graph-motion.ts` runs at approximately 30 updates/second only while visible, foregrounded and not paused/under inspection; reduced-motion changes use React's external-store subscription. `graph-view.tsx` owns topic selection, fixed-transform node dragging, viewport controls and the inline full-text/source inspector. Scoped CSS and the graph branch of `run-view.tsx` remove nested cards and the redundant heading without changing other tabs.

## How to implement it correctly next time

- Keep source records, viewport, selection, pinned coordinates and animation clock independent.
- Pause movement under pointer/keyboard inspection; provide a manual pause and honor live accessibility preference changes, not only their mount-time value.
- Place labels against stable coordinates, not every animation frame. Keep full text in the index, accessible label and inspector; omit an entire canvas label if it cannot fit safely.
- Retain focus on a stable inspector parent before replacing a keyed selected-details section.
- Use light/dark semantic color tokens; don't reuse dark-only pastels on a light surface.

## Proof and limitations

Direct invocation on the real extraction retained 66 nodes, 149 links and eight default topics. Searching `token` returned 16 full-content matches. Animated copies moved while pins remained exact; source records were unchanged. Native tests proved Pause/Resume (positions unchanged/changed across 500ms), topic search including empty results, selection retaining all graph elements, keyboard connection-follow with focus retained, individual node dragging, background panning, zoom and Fit. Explicit Play source sought to 6:00 and started playback; graph inspection alone did not.

Build/typecheck/preload guard and 56 desktop tests passed. Root lint has no configured tasks. Fresh review approved after two fixes (focus and light-theme contrast); native QA then identified the installed motion hook's stale live preference behavior, replaced with a stable `matchMedia` change subscription and independently source-reviewed. See current QA for remaining runtime coverage limits.

The real graph is denser than the mock. Canvas labels are selectively displayed, never rewritten. Text-width estimates are not full font shaping. Motion is disabled above 300 nodes; layout then uses the existing complete deterministic spiral. These checks do not certify all codecs, assistive devices, packaged distributions, vault-scale performance or extracted claim truth. No source data, backend, dependency or publication changes.

## Links

### Visual refinement — 2026-09-06

The same bounded presentation pattern now uses shallow quadratic connections, semantic node halos/cores, a subtly lit canvas, and at most twelve decorative pulses driven by the existing gated clock. Pause moved into the heading; topic hierarchy and inspector were refined without changing graph semantics. Pulse movement represents decoration, not processing or causal direction. 79 desktop tests/build and browser selection/search/zoom/keyboard/source/pause/reduced-motion checks passed; fresh review accepted. See [refinement contract](../design/graph-polish-contract.md). Native app relaunched Ready, but real-history rendering remains unvalidated because the library is empty. SVG geometry follows [MDN paths](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Paths).

### References

- [Contract](../design/guided-graph-contract.md), [QA](../../design-qa.md), [ADR-0005](0005-stable-knowledge-graph.md)
- [React browser API subscriptions](https://react.dev/reference/react/useSyncExternalStore) — followed for live reduced-motion state.
- [Motion accessibility](https://motion.dev/docs/react-accessibility) — reduced-motion guidance; custom coordinate animation is gated explicitly.
- [Lucide Pause](https://lucide.dev/icons/pause) — existing icon library.
- Vault owner: `/Users/dontizi/Obsidian/vault/projects/lirovo/lirovo.md`; this repository ADR is canonical. Local working tree only, no commit.
