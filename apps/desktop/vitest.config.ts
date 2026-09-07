import { defineConfig } from "vitest/config";

// Main-process tests must use Node builtins, not Vite's Electron renderer shims.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
