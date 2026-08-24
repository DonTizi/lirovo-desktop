import type {
  BackendCapabilities,
  CompletionRequest,
  CompletionResult,
  Exec,
  InferenceBackend,
} from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";
import { resolveBinary } from "../../binaries.js";
import { extractJson, looksTruncated } from "../json.js";
import { createSandbox, minimalEnv, renderConversation, type Sandbox } from "./isolate.js";
import type { LirovoPaths } from "@lirovo/core";

/** Capabilities every agent-CLI adapter shares, whatever the vendor. */
export const HARNESS_CAPABILITIES: Omit<BackendCapabilities, "nativeJsonSchema"> = {
  // Frames would have to be written to disk and read back through the agent's
  // file tool: slow, non-deterministic, and it re-opens the filesystem we just
  // closed. A one-hour video needs roughly 70 vision calls; this path is not it.
  images: false,
  // A full agent session per call. Two text calls per run is fine.
  spawnsProcessPerCall: true,
};

/**
 * How a CLI wants to be handed a JSON Schema.
 *
 * Established by running each one, not by reading its help text: Codex takes a
 * file path, Claude Code takes the JSON inline, and anything else falls back to
 * describing the schema in the prompt and repairing what comes back.
 *
 * Note the schema itself is our own text, never transcript content, so putting
 * it in argv leaks nothing — the rule about keeping argv clean is about the
 * untrusted prompt.
 */
export type SchemaMode = "file" | "inline" | "prompt";

export interface HarnessSpec {
  readonly id: string;
  readonly bin: string;
  readonly schemaMode: SchemaMode;
  /** Args that print a version and exit 0. */
  readonly versionArgs: readonly string[];
  /** Build the invocation for this call. */
  buildArgs(ctx: { schemaPath: string | null; schemaInline: string | null }): readonly string[];
  /** Pull the final assistant message out of whatever the CLI printed. */
  parseOutput(stdout: string): string;
}

export interface HarnessDeps {
  readonly exec: Exec;
  readonly paths: LirovoPaths;
  readonly env?: NodeJS.ProcessEnv;
}

const QUOTA_HINTS = ["rate limit", "quota", "usage limit", "too many requests", "429"];
const AUTH_HINTS = ["not logged in", "unauthorized", "authentication", "401", "login"];

const classify = (message: string): LirovoError => {
  const lower = message.toLowerCase();
  if (QUOTA_HINTS.some((h) => lower.includes(h))) {
    return new LirovoError("INFERENCE_QUOTA_EXCEEDED", message);
  }
  if (AUTH_HINTS.some((h) => lower.includes(h))) {
    return new LirovoError("INFERENCE_AUTH_FAILED", message);
  }
  return new LirovoError("INFERENCE_FAILED", message);
};

export const createHarnessBackend = (spec: HarnessSpec, deps: HarnessDeps): InferenceBackend => {
  const env = deps.env ?? process.env;

  return {
    id: spec.id,
    capabilities: { ...HARNESS_CAPABILITIES, nativeJsonSchema: spec.schemaMode !== "prompt" },

    async detect() {
      const resolved = await resolveBinary(spec.bin, deps.paths, env);
      if (resolved === null) return { available: false, version: null, reason: `${spec.bin} not on PATH` };
      try {
        const { stdout, stderr } = await deps.exec(resolved.path, spec.versionArgs, {
          env: minimalEnv(env),
          timeoutMs: 15_000,
        });
        const raw = (stdout || stderr).trim().split("\n")[0] ?? "";
        return { available: true, version: raw === "" ? null : raw };
      } catch (e) {
        return { available: false, version: null, reason: e instanceof Error ? e.message : String(e) };
      }
    },

    async complete(req: CompletionRequest): Promise<CompletionResult> {
      if (req.images !== undefined && req.images.length > 0) {
        throw new LirovoError(
          "HARNESS_UNSUPPORTED_CAPABILITY",
          `${spec.id} cannot analyse frames — configure a local or BYOK vision backend`,
        );
      }
      const resolved = await resolveBinary(spec.bin, deps.paths, env);
      if (resolved === null) throw new LirovoError("HARNESS_NOT_FOUND", `${spec.bin} not on PATH`);

      const startedAt = Date.now();
      let sandbox: Sandbox | null = null;
      try {
        sandbox = await createSandbox();
        const schemaInline = req.schema === undefined ? null : JSON.stringify(req.schema);
        const schemaPath =
          schemaInline !== null && spec.schemaMode === "file"
            ? await sandbox.file("schema.json", schemaInline)
            : null;

        let prompt = renderConversation(req.messages);
        if (schemaInline !== null && spec.schemaMode === "prompt") {
          // No native constraint: the schema travels in the prompt and the
          // caller's repair loop catches what the model gets wrong.
          prompt += `\n\nReturn ONLY one JSON object conforming to this JSON Schema:\n${schemaInline}`;
        }

        const { stdout, stderr } = await deps.exec(
          resolved.path,
          spec.buildArgs({ schemaPath, schemaInline }),
          {
            cwd: sandbox.dir,
            env: minimalEnv(env),
            // The prompt goes through stdin, never argv: argv is visible in the
            // process table to every process on the machine, and ARG_MAX caps it.
            stdin: prompt,
            signal: req.signal as AbortSignal,
            timeoutMs: 10 * 60 * 1000,
          },
        );

        const text = spec.parseOutput(stdout).trim();
        if (text === "") throw classify(stderr.trim() || `${spec.id} returned nothing`);
        if (req.schema !== undefined && looksTruncated(text)) {
          throw new LirovoError("INFERENCE_TRUNCATED", `${spec.id} stopped before finishing its answer`);
        }

        return {
          text,
          model: spec.id,
          backendVersion: (await this.detect()).version ?? spec.id,
          elapsedMs: Date.now() - startedAt,
          truncated: false,
          ...(req.schema !== undefined ? { json: extractJson(text) } : {}),
        };
      } catch (e) {
        if (e instanceof LirovoError) throw e;
        throw classify(e instanceof Error ? e.message : String(e));
      } finally {
        await sandbox?.dispose();
      }
    },
  };
};
