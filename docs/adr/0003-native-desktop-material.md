# ADR 0003 — Native desktop material and shared system typography

Status: accepted locally, 2026-09-05; human commit gate remains open.

## Context

The flat sidebar, Inter typography and large form controls did not match the supplied Codex reference. The former screenshots also mixed viewport sizes and persisted Electron zoom levels.

## Decision

Use macOS `vibrancy: sidebar` with transparent window backing and `visualEffectState: active` so material persists while unfocused. The user clarified that the center and top navigation must also be translucent: the body is transparent, the sidebar uses a 12% tint, and the workspace uses a 30% tint over native material. Readable cards/composer remain distinct surfaces. Keep normal titled-window behavior, sandbox and context isolation; do not enable transparent-window mode. Use the operating system font across the app, 14px navigation text, 32px rows, a 270px sidebar and a 736px-wide, 102px-tall source composer. Schemas remain accessible through a compact context strip and expandable editor.

All semantic color aliases, including the older Kumo names, use the same relative-RGB Tailwind adapter so opacity modifiers compile correctly. Removing only the old full-color token errors was insufficient: direct `var()` aliases still lost opacity utilities and produced white warning borders.

## Evidence and limits

Final user-approved tuning supersedes the initial opaque-workspace evidence below: sidebar tint 22%, main tint 30%, extra toolbar tint 8%. Both shell surfaces become opaque under reduced transparency. The final whole-window translucent screenshot and navbar refinement were compared at the same 1180 × 800 logical viewport; see `design-evidence/fidelity-navigation-tint.png`. User feedback accepted the overall direction and requested only this smaller navigation adjustment.

Electron 44 sandboxed scratch probe exercised the constructor API; the real app demonstrated different active/inactive native sidebar material and preserved an opaque #181818 workspace. Native developer tools confirmed the system font, devicePixelRatio 2 and 102px composer; the comparison window was set to 1461 × 838, matching the supplied 2922 × 1676 reference at 2×. Library, schemas, preferences, source validation and real result filtering were exercised.

Material varies with macOS window activity and accessibility preferences. CSS provides an opaque reduced-transparency fallback. Other operating systems retain the opaque sidebar; they were not run. The extraction engine, saved data and IPC contract are unchanged. Pixel-identical Codex internals and packaged-app signing are not claimed.

## Alternatives and rollback

CSS blur alone cannot reveal the desktop behind an opaque native window. A fully transparent frameless window would introduce unnecessary window-behavior changes. Revert only the material options, renderer marker and corresponding CSS to return to the opaque sidebar.

Official API: https://www.electronjs.org/docs/latest/api/base-window
Contract: ../design/desktop-fidelity-contract.md
