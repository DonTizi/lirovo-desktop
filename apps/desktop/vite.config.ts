import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

/**
 * Three outputs from one config: the main process, the preload bridge, and the
 * renderer.
 *
 * The native dependencies stay external. `better-sqlite3` is a compiled addon
 * and bundling it produces a build that fails at require time rather than at
 * build time, which is the worst place to find out.
 */
/**
 * Runtime builtins the bundler must not try to resolve.
 *
 * Vite's builtin list predates `node:sqlite`, so left alone it rewrites the
 * import to `__vite-browser-external` and the main process starts with a
 * database module that exports nothing.
 */
const EXTERNAL = ["node:sqlite", "sqlite"];

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: "src/main/index.ts",
        vite: { build: { outDir: "dist-electron/main", rollupOptions: { external: ["electron", ...EXTERNAL] } } },
      },
      {
        entry: "src/main/engine-host.ts",
        vite: { build: { outDir: "dist-electron/main", rollupOptions: { external: ["electron", ...EXTERNAL] } } },
      },
      {
        entry: "src/preload/index.ts",
        onstart: ({ reload }) => reload(),
        vite: {
          build: {
            outDir: "dist-electron/preload",
            // CommonJS, with a `.cjs` extension because the package is
            // `type: module`. A SANDBOXED preload cannot be ESM: Electron
            // loads it, the import fails, `contextBridge` never runs, and the
            // window comes up looking fine with no `window.lirovo` on it and
            // nothing in any log. Found exactly that way.
            //
            // Set through `lib`, not `rollupOptions.output.format` — the
            // plugin builds its own `lib` config and the output override is
            // discarded.
            lib: {
              entry: "src/preload/index.ts",
              formats: ["cjs"],
              fileName: () => "index.cjs",
            },
            rollupOptions: { external: ["electron"] },
          },
        },
      },
    ]),
    renderer(),
  ],
  // Pinned: a shifting port makes Electron load a stale URL and the window
  // comes up blank with no error anywhere.
  server: { port: 5183, strictPort: true },
  build: { outDir: "dist" },
});
