import type { InferenceBackend } from "@lirovo/contracts";
import { createHarnessBackend, type HarnessDeps, type HarnessSpec } from "./adapter.js";

/**
 * Claude Code, headless.
 *
 * `--json-schema` gives native structured output. Isolation is weaker than
 * Codex's: there is no single flag that refuses user-level memory, so the empty
 * sandbox directory plus an empty MCP config plus a stripped environment is as
 * far as flags reach. That gap is why this path stays experimental.
 *
 * Verified against Claude Code 2.1.241.
 */
export const claudeSpec: HarnessSpec = {
  id: "claude",
  bin: "claude",
  // Verified by running it: `--json-schema` parses its argument as JSON, and
  // rejects a file path with "not valid JSON: Unrecognized token '/'".
  schemaMode: "inline",
  versionArgs: ["--version"],

  buildArgs: ({ schemaInline }) => [
    "--print",
    "--output-format",
    "json",
    // Only the servers named below exist for this process...
    "--strict-mcp-config",
    // ...and that list is empty.
    "--mcp-config",
    '{"mcpServers":{}}',
    ...(schemaInline === null ? [] : ["--json-schema", schemaInline]),
  ],

  /**
   * `--output-format json` returns an envelope, not the answer. The answer is
   * the `result` field; anything else means the CLI changed shape and we should
   * fail loudly rather than feed an envelope to the JSON extractor.
   */
  parseOutput: (stdout) => {
    const trimmed = stdout.trim();
    if (trimmed === "") return "";
    try {
      const envelope = JSON.parse(trimmed) as { result?: unknown; is_error?: boolean; error?: unknown };
      if (envelope.is_error === true) {
        throw new Error(typeof envelope.error === "string" ? envelope.error : "claude reported an error");
      }
      if (typeof envelope.result === "string") return envelope.result;
      if (envelope.result !== undefined) return JSON.stringify(envelope.result);
      return trimmed;
    } catch (e) {
      if (e instanceof SyntaxError) return trimmed;
      throw e;
    }
  },
};

export const createClaudeBackend = (deps: HarnessDeps): InferenceBackend =>
  createHarnessBackend(claudeSpec, deps);
