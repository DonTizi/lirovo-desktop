# Luminous knowledge map

Refine the approved guided graph into a quiet, futuristic constellation using the existing translucent shell, native type and stable graph interactions.

```text
Saved nodes + links -> stable layout -> curved connections + luminous points
Existing gated clock ----------------> bounded drift + decorative light pulses
Topic / node selection --------------> highlighted neighbors + source inspector
```

- Pattern: bounded presentation layer (ADR-0006), not a new simulation. Vault graph notes and web-animation-craft agree with Motion accessibility guidance: restrained effects, explicit pause and reduced motion.
- Acceptance: more intentional hierarchy, themed atmospheric canvas, refined semantic nodes and selected connections; no hidden data, changed labels, automatic playback, or changed pan/zoom/drag behavior. Ambient effects share the existing visibility/interaction-gated clock and stop under reduced motion; cap decorative pulses to twelve and disable on large graphs.
- Scope: graph-view, graph-presentation, graph CSS and focused tests/isolated production-component preview. No dependency, pipeline, source data, window material or navigation changes.
- Spike: no. Existing SVG/React and gated animation infrastructure are proven in this repository; only presentation geometry and styling change. Directly invoke new geometry before writing its tests.
- Checks: direct geometry invocation, desktop tests/typecheck/build/preload guard, scoped format/diff review, browser dark/light/narrow/selection/zoom/pause/source-action smoke; fresh-context reviewer required by project rules.
- Oracle: proves deterministic geometry and visible interaction states on controlled graphs, not extraction truth or native real-history rendering (current native library is empty). Human aesthetic judgment remains relevant.
- Rollback: revert only these scoped presentation changes; no data writes/migration.

## Validation — 2026-09-06

79 desktop tests, typecheck/build/preload guard and scoped Prettier/whitespace checks passed. No configured desktop lint task. Independent reviewer found no blockers and reran eight presentation tests. Direct curve invocation verified exact endpoints, finite coincident coordinates and twelve pulses for 149 links.

Browser smoke of the production component: 42 nodes/66 links retained through selection/search; keyboard selection/Escape, zoom/Fit and explicit source callback passed. Pulses moved across samples, froze under manual pause/pointer inspection, and disappeared under live reduced-motion emulation. Dark/light/420px-container screenshots reviewed; narrow canvas capped to 360px. Decorative pulses do not indicate processing activity or inferred causal direction. Screenshots: design-evidence/graph-polish-{dark,light,narrow}.png.

Native recheck initially blocked by locked Mac. At the user's subsequent relaunch request, no active extraction or running desktop process was found; dev frontend/engine launched and native window showed Ready on localhost:5183. Library is empty, so real-history native graph appearance remains unvalidated. No extraction, deletion, migration, commit or release was performed.
