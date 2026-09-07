# Spike: electron-preload-cjs

- goal: determine why a preload configured as CommonJS sometimes contains an ESM import in development
- hypothesis: using Rollup input/output directly produces one deterministic CommonJS artifact
- materiality: sandboxed security boundary, public renderer bridge, and observed runtime failure

## What was exercised

Built the real `src/preload/index.ts` through the installed `vite-plugin-electron` 1.1.1 and Vite 6.4.3 using both the current library-entry configuration and an explicit Rollup input/output configuration.

## Outputs observed

- Current library-entry configuration emitted the same `index.cjs` path twice (4.27 kB and 2.97 kB).
- The running watch build left `import { contextBridge, ipcRenderer, webUtils } from "electron"` in `index.cjs` and Electron rejected it with `Cannot use import statement outside a module`.
- Explicit Rollup input/output emitted `index.cjs` once (2.97 kB).
- The resulting artifact starts with `"use strict"` and loads Electron through `require("electron")`.
- `node --check` accepted the resulting artifact.

## Edge cases found

- Vite merges library format arrays, so adding `cjs` does not replace the plugin's ESM default in a `type: module` package.
- Giving both formats the same filename makes the final development artifact order-dependent.

## Limitations found

- `vite-plugin-electron` 1.1.1 passes a `platform` option that Vite 6 warns about; it is unrelated to the preload syntax failure and remains outside this focused fix.

## Verdict: adopt

Use an explicit Rollup input and a single CommonJS output for the sandboxed preload.

## Productionization checklist

- [x] rewritten outside spikes/, scaffolding/secrets stripped
- [x] real preload source exercised before implementation
- [x] regression guard added for CommonJS syntax and bridge exposure
- [x] verified against the running Electron app (DoD)
- [x] limitation cited in the ADR
