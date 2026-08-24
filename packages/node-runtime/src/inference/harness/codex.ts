import type { InferenceBackend } from "@lirovo/contracts";
import { createHarnessBackend, type HarnessDeps, type HarnessSpec } from "./adapter.js";

/**
 * Codex CLI, non-interactive.
 *
 * The best-isolated of the agent CLIs: it is the only one that ships a flag for
 * every layer we need to switch off, and the only one that constrains output to
 * a JSON Schema natively (`--output-schema`), which removes a repair round-trip.
 *
 * Verified against codex-cli 0.147.0.
 */
export const codexSpec: HarnessSpec = {
  id: "codex",
  bin: "codex",
  // Verified by running it: `--output-schema` takes a FILE path.
  schemaMode: "file",
  versionArgs: ["--version"],

  buildArgs: ({ schemaPath, tuning }) => [
    "exec",
    // `-` reads the instructions from stdin, so the prompt never enters argv.
    "-",
    "--skip-git-repo-check",
    // No session written to disk: a transcript is untrusted input and should
    // not be persisted into the user's Codex history.
    "--ephemeral",
    // Do not load ~/.codex/config.toml — it can register MCP servers.
    "--ignore-user-config",
    // Do not load AGENTS.md or any project rules file.
    "--ignore-rules",
    "--sandbox",
    "read-only",
    ...(tuning.model === undefined ? [] : ["-m", tuning.model]),
    // Perception, not reasoning: the cheapest setting reads frames accurately
    // and leaves the user's thinking budget for their own work.
    ...(tuning.effort === undefined ? [] : ["-c", `model_reasoning_effort=${tuning.effort}`]),
    ...(schemaPath === null ? [] : ["--output-schema", schemaPath]),
  ],

  // Codex writes progress to stderr and the final agent message to stdout.
  parseOutput: (stdout) => stdout,
};

export const createCodexBackend = (deps: HarnessDeps): InferenceBackend =>
  createHarnessBackend(codexSpec, deps);
