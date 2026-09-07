# Darker desktop background

Deepen the dark workspace without changing the navigation's original translucency, layout, typography, controls or light theme.

`macOS material -> darker translucent shell -> existing readable surfaces`

- Pattern: existing semantic tokens and native-material overrides; no new abstraction.
- Acceptance (user clarification): dark canvas #141414; native workspace 65% charcoal tint. Navigation restored exactly to main: sidebar rgb24/22%, opaque sidebar #353535, divider white/4%, toolbar rgb24/8%. Light values unchanged; reduced-transparency fallback remains opaque.
- Files: renderer/globals.css, this validation record, existing material ADR after proof.
- Spike: no new architecture/API; existing material probe and ADR already establish the mechanism. Compare old/new CSS in the real Electron window before accepting the tuning.
- Verify: desktop build/typecheck/tests, configured lint, native computed colors and screenshots, fresh-context diff review.
- Oracle: proves CSS branches, native rendering and existing regressions; cannot prove aesthetic preference on every wallpaper/display. Human visual approval remains appropriate.
- Rollback: revert only this CSS diff. No commit, push or release authorized.

## Validation — 2026-09-07

Main b6afd69 fetched and fast-forwarded; user files preserved. 97 desktop tests/18 files, typecheck, build and preload check passed. Final divider adjustment rebuilt successfully. Lint has no configured tasks; existing bundle-size/platform warnings remain.

Real Electron app and engine booted in an isolated profile with working bridge. Computed dark main rgba(12,12,12,.65), sidebar rgba(18,18,18,.7), body transparent, composer rgb40. Injected old CSS reproduced main rgba24/.3 and sidebar rgba24/.22. Light main rgba250/.3 and sidebar rgba255/.22 unchanged. Removing the native marker gives opaque main rgb20/sidebar rgb29. Reduced-transparency routing inspected, OS preference not changed.

Before/after renderer captures and native window inspection completed at 1180x800; scratch evidence in /tmp/lirovo-dark-background-QO2zyu. Renderer capture does not include full native compositing. Fresh review accepted after strengthening divider to white/8%. Human aesthetic approval remains separate. No commit/push.

User clarification supersedes the sidebar tuning above: navigation must retain its original transparency. All sidebar/toolbar rules and sidebar token restored byte-identically to main. Only central canvas and native workspace tint remain changed. Rebuilt and reran 97 desktop tests successfully; native probe repeated with sidebar rgba(24,24,24,.22). No lint task configured. Documentation and prior-art note corrected rather than treating reviewer acceptance as aesthetic approval.

Final visual approval received on 2026-09-07 with an explicit request to create a PR. The commit/push/PR checkpoint is approved; merge and release remain outside this request.
