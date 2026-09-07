# Native sidebar material spike

Observed on Electron 44.0.0/macOS: sandboxed BrowserWindow accepts `vibrancy: sidebar`, `titleBarStyle: hiddenInset` and a transparent background without enabling `transparent: true`. The window remained resizable; diagnostics reported zoom 1 and sandbox true. `getBackgroundColor()` returned #000000 (not an alpha oracle).

Verdict: adapt. Preserve normal window behavior, paint only the workspace opaque and leave the sidebar to the system material. Native screenshot verification is still required in the real app because the UI controller selected the existing app instance rather than the independent probe. Do not claim the diagnostic establishes visual translucency.

Production checklist: macOS-only constructor options; transparent root and sidebar only in Electron on Mac; opaque browser/other-platform fallback; reduced-transparency fallback; preserve native theme preference and sandbox; validate desktop light/dark and collapse/expand.

Official API: https://www.electronjs.org/docs/latest/api/base-window
