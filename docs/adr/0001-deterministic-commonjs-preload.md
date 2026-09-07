# ADR 0001: Build the sandboxed preload as deterministic CommonJS

- status: accepted
- date: 2026-09-05
- spike: [electron-preload-cjs](../../spikes/electron-preload-cjs/NOTES.md)

## Context

The desktop window uses Electron's default renderer sandbox and a preload bridge to expose the narrow `window.lirovo` API. The workspace is a `type: module` package. The flat `vite-plugin-electron` `entry` shortcut therefore supplied an ESM library format before the app configuration added CommonJS. Vite merged the format arrays instead of replacing them, and both outputs wrote `index.cjs`. In development watch mode, the ESM-flavoured artifact could win, Electron rejected its top-level import, and React crashed because the bridge was absent.

## Decision

Apply the **single-writer artifact** pattern: configure the preload through one explicit Rollup input and one CommonJS output. Keep Electron external so the sandbox's supported CommonJS loader resolves it at runtime. Verify the emitted artifact after every production build.

## Why

- Disabling the sandbox would weaken the security boundary to accommodate a build error.
- Keeping the library-entry shortcut with two formats leaves an order-dependent race.
- A direct Rollup input/output matches the preload preset documented by `vite-plugin-electron` while preserving the existing multi-entry flat configuration for the two main-process bundles.

## How it was implemented

- `apps/desktop/vite.config.ts` gives the preload an explicit input, `format: "cjs"`, inline dynamic imports, and a fixed `index.cjs` entry name.
- `apps/desktop/scripts/verify-preload-bundle.mjs` rejects ESM syntax, a missing CommonJS Electron load, or a missing `lirovo` context bridge.
- The desktop build runs that verifier after Vite.

## How to implement it correctly (for the next project)

1. Keep renderer sandboxing and context isolation enabled.
2. Bundle a sandboxed preload into one file.
3. In a `type: module` package, avoid a library-entry shortcut that injects an ESM default; set the build input and CommonJS output explicitly.
4. Give only that output the `.cjs` filename.
5. Inspect the real emitted artifact and launch the real Electron window; TypeScript alone cannot detect a module-format mismatch.

## Limitations and edge cases

- `vite-plugin-electron` 1.1.1 emits an unknown `platform` option warning under Vite 6.4.3. It did not cause this failure, but the dependency pair should be aligned separately.
- The verifier checks the emitted contract shape; it does not exercise every IPC method.
- A visible launch proves the initial bridge calls and renderer mount, not extraction workflows.

## Links

- vault gotcha: `electron-sandboxed-preload-module-format`
- source commit(s): pending local change
