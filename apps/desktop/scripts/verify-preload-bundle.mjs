import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const preloadUrl = new URL(
  "../dist-electron/preload/index.cjs",
  import.meta.url,
);
const preloadPath = fileURLToPath(preloadUrl);
const preload = await readFile(preloadUrl, "utf8");

// `--check` parses this as `.cjs`, catching ESM syntax wherever a bundler puts
// it rather than relying on a line-oriented text match.
execFileSync(process.execPath, ["--check", preloadPath], { stdio: "inherit" });

if (!/\brequire\(\s*(["'])electron\1\s*\)/.test(preload)) {
  throw new Error(`${preloadPath} does not load Electron through CommonJS`);
}

if (!/\bexposeInMainWorld\(\s*(["'])lirovo\1\s*,/.test(preload)) {
  throw new Error(`${preloadPath} does not expose the renderer bridge`);
}
