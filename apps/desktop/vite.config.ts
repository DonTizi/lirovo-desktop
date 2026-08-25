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
        vite: { build: { outDir: "dist-electron/preload", rollupOptions: { external: ["electron"] } } },
      },
    ]),
    renderer(),
  ],
  // Pinned: a shifting port makes Electron load a stale URL and the window
  // comes up blank with no error anywhere.
  server: { port: 5183, strictPort: true },
  build: { outDir: "dist" },
});
