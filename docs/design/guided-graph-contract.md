# Guided connections — selected third design

Replace the boxed graph with the selected Lirovo-native topic index, airy canvas and inline source inspector. Preserve complete real data and make movement controllable.

```text
Real extraction -> stable graph model -> animated positions -> nodes + links
                      |                         |
                  topic index -> selection -> full text / explicit source play
                                  viewport and node drag remain independent
```

Pattern: stable model, independent interaction state, bounded presentation-only motion. Source visual: `/Users/dontizi/.codex/generated_images/01a07225-ecc5-7a71-ab9e-126276414083/exec-e1cb5101-dbfd-41db-ae4e-e7b9efe94510.png` (third displayed image). Real labels/relationships replace invented mock copy; preserve all 66 nodes/149 links. Native SF system font and existing Lucide icons match the shell. The graph is live data visualization, not a raster asset. No other image asset is needed.

Acceptance: compact topic search/index; no nested graph cards or duplicate heading; muted sage/pearl/amber nodes and lavender selection; full-text inspector below canvas; small screen-sized dots and collision-aware whole labels; gentle entry and drift, individual node dragging, Pause, no motion under pointer/keyboard inspection, reduced-motion and offscreen/background suspension; pan/zoom/Fit/keyboard/list alternatives retained. Source playback only explicit. Responsive 900px and large native window.

Non-goals: backend/schema/extraction changes, fake semantic clusters, new dependencies, unrelated shell redesign, publishing. Touch graph presentation/model tests/view, scoped run-view/CSS and QA/ADR records. Preserve earlier dirty worktree changes.

spike: yes — direct real-data motion/label probe plus native pointer and frame-state inspection before test expectations. Production code is separate from scratch probes.

Verify: direct helper invocation; relevant tests; desktop build/typecheck/preload guard; formatter and diff checks (root lint has no configured tasks); fresh source review; native motion/pause/drag/selection/search/Fit/keyboard and reference screenshot comparison. Oracle: exercises retention, presentation and native interactions, not extracted claim truth, every assistive device or vault-scale performance. Rollback only these graph-specific hunks and new files; no commit/push.
