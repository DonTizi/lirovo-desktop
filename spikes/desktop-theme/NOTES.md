# Desktop theme runtime probe

- Date: 2026-09-05
- Runtime: installed Electron 44, hidden scratch window, no user data.
- Invocation: `apps/desktop/node_modules/.bin/electron spikes/desktop-theme/probe.cjs`.
- Observed: `CSS.supports('color', 'oklch(light-dark(98% 0 0, 10% 0 0) / 1)')` is false.
- Observed: full `light-dark(#fafafa, #181818)` tokens through `rgb(from var(--probe) r g b / 0.7)` resolve to `color(srgb 0.980392 0.980392 0.980392 / 0.7)` in light and `color(srgb 0.0941176 0.0941176 0.0941176 / 0.7)` in dark.
- Verdict: adapt. Preserve the existing color-scheme preference contract; replace raw-channel aliases with full colors and use relative RGB at the Tailwind adapter.
- Productionization: one token family, semantic aliases for existing consumers, full-color light-dark arguments, valid shadow colors, keyboard focus and real screenshots of both palettes.
- Limits: the probe proves color parsing/resolution, not every CSS selector, browser version, contrast ratio or packaged runtime.
