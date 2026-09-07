# Spike: graph-interactions

- goal: retain graph context while inspecting and navigating the native renderer.
- hypothesis: stable layout plus independent selection/viewport eliminates disappearing nodes and coordinate jumps.
- materiality: runtime uncertainty in native SVG pointer capture and zoom coordinates.

## What was exercised
Opened the existing 66-node, 149-edge extraction in Electron. Inspected the original moving graph, then directly invoked the pure display model against its saved kg.json before writing regressions. Exercised node click, zoom buttons, a 100px/50px native drag, keyboard Right/+ and wheel zoom in the real graph. Instrumented DOM counts and playback state through the native DevTools console.

## Outputs observed
Initial direct model: 66 nodes, 149 links, 0 omitted, finite fitted positions, unchanged input, approximately 26ms. Degree-sized radii: 5.4–12.4. Cursor anchor after zoom: x=0.1999999999999999, y=0.7 (requested 0.2/0.7). Duplicate reciprocal links and self-links leave degrees [1,1,0], radii [5.4,5.4,4]. Overlapping-label probe: overview=[], zoom=[a], highlighted b=[b], complete labels unchanged.

Native gesture snapshots retained 66 nodes/149 edges and selected w0_sp1 throughout drag, keyboard and wheel events; minimum node opacity 0.6, minimum edge opacity 0.23, source currentTime=0, paused=true, no document overflow at 1180×800. Zoom controls reached156%, keyboard195%, wheel264%; Fit returned100%. Native dragging moved the selected hub with the graph instead of selecting a different node. Final build/typecheck/preload guard and51 desktop tests passed. Root lint has no tasks.

## Edge cases found
- Duplicate source IDs originally stole later genuine endpoints; allocate synthetic IDs outside the complete source-ID set. Regression covered.
- Pointer capture requires the starting inverse screen CTM; client-pixel deltas alone are wrong with viewBox letterboxing and zoom.
- Dense complete labels overlapped at closer zoom; prioritize the active label and reserve estimated text boxes.

## Limitations found
- Layout computation is bounded at300 nodes; larger graphs retain all nodes in a deterministic spiral rather than running the quadratic force pass.
- Native CUA snapshots can lag event delivery by a frame; confirm the later rendered state instead of interpreting the immediate stale screenshot as a failure.
- No multi-touch, all-codec, all-assistive-device or extraction-truth claim. Label bounds estimate Latin text widths, not arbitrary font shaping.

## Verdict: adapt
Preserve the native graph as live SVG data, with Obsidian-inspired dots/links and explicit inspection; no new dependency or raster replacement.

## Guided presentation continuation (2026-09-05)

Before new tests, invoked the presentation helpers on the same real kg.json: 66 nodes, 149 edges, eight topics, 16 full-label matches for `token`, all unpinned coordinates moved between 1000 and 2000ms, pinned w0_sp1 stayed exactly (40,50), original records unchanged. Near-node-only label placement returned zero labels in the dense graph; adapted to multiple candidate distances with faint visual leader lines, yielding four collision-free complete labels at an 850×410 canvas. Leader lines are presentation aids, not semantic graph edges.

Native pause probe: `motion=paused, moved=false, nodes=66, links=149, time=0, paused=true, overflow=false`. Resume probe after 500ms: `motion=running, moved=true` with the same graph counts and video still paused at zero. Search/clear/empty result worked; keyboard connection follow retained focus on the stable inspector. Play source explicitly sought to 360.2 seconds and played. Native node dragging moved only the selected point and incident lines, background dragging panned, Fit restored 100%. At a 957×865 renderer (DevTools docked), all 66/149 elements remained and document overflow was false.

Native accessibility emulation exposed a mount-time preference issue: `matchMedia(reduce)=true` but the installed motion hook left the control enabled. Replaced it with a stable React external-store subscription to the media query's change event, reviewed independently. This runtime finding was not concealed by the green unit tests. Final build/typecheck/preload guard and 56 desktop tests passed; no configured lint tasks. See QA for final native preference coverage.

Final native reduced-motion probe after the fix: `reduce=true, motion=paused, moved=false, disabled=true, nodes=66, links=149` across 500ms. Preference changes take effect without restarting the renderer. CSS-only light-theme emulation is not a valid oracle for native vibrancy; record light visual coverage as unvalidated instead of treating the mixed native/CSS state as the product appearance.

## Productionization checklist (if adopted — spike code is NEVER merged directly)
- [x] Production model and renderer live outside spikes; generated probe bundle removed.
- [x] Tests cover observed identity, retention, sizing, anchoring and label cases.
- [x] Build, tests, fresh review and native interaction checks completed.
- [x] Limitations recorded here and in the graph contract/ADR.
