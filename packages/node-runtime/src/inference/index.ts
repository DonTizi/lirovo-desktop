import type { InferenceBackend } from "@lirovo/contracts";
import type { LirovoPaths } from "@lirovo/core";
import type { Exec } from "@lirovo/contracts";
import { createOpenAiCompatibleBackend } from "./openai-compatible.js";
import { createClaudeBackend } from "./harness/claude.js";
import { createCodexBackend } from "./harness/codex.js";
import type { HarnessDeps, HarnessTuning } from "./harness/adapter.js";

export * from "./json.js";
export * from "./schema.js";
export * from "./openai-compatible.js";
export * from "./harness/adapter.js";
export * from "./harness/isolate.js";
export * from "./harness/claude.js";
export * from "./harness/codex.js";

export interface BackendRegistryDeps {
  readonly exec: Exec;
  readonly paths: LirovoPaths;
  readonly env?: NodeJS.ProcessEnv;
  readonly tuning?: HarnessTuning;
}

const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:11434/v1";
const DEFAULT_LOCAL_MODEL = "qwen2.5vl:7b";

/**
 * Every backend the machine could use, in preference order.
 *
 * The local server comes first on purpose. It is persistent, so a run's dozens
 * of vision calls are dozens of HTTP requests rather than dozens of process
 * launches; it has no weekly cap to exhaust; and it raises no question about
 * whether batch use of somebody's coding subscription is within its terms.
 * The agent CLIs sit last and text-only.
 */
export const buildBackends = (deps: BackendRegistryDeps): readonly InferenceBackend[] => {
  const env = deps.env ?? process.env;
  const harnessDeps: HarnessDeps = {
    exec: deps.exec,
    paths: deps.paths,
    ...(deps.env ? { env: deps.env } : {}),
    ...(deps.tuning ? { tuning: deps.tuning } : {}),
  };

  const apiKey = env["LIROVO_OPENAI_API_KEY"];
  const local = createOpenAiCompatibleBackend({
    id: "local",
    baseUrl: env["LIROVO_OPENAI_BASE_URL"] ?? DEFAULT_LOCAL_BASE_URL,
    model: env["LIROVO_MODEL"] ?? DEFAULT_LOCAL_MODEL,
    ...(apiKey !== undefined ? { apiKey } : {}),
    // Named for the default port. A user pointing LIROVO_OPENAI_BASE_URL at LM
    // Studio gets a wrong instruction here, which is why it is a suggestion
    // next to the real reason rather than the reason itself.
    setup: { label: "Start", command: `ollama serve && ollama pull ${env["LIROVO_MODEL"] ?? DEFAULT_LOCAL_MODEL}` },
  });

  return [local, createCodexBackend(harnessDeps), createClaudeBackend(harnessDeps)];
};

/** First available backend that can do what the caller needs. */
export const selectBackend = async (
  backends: readonly InferenceBackend[],
  need: { readonly images: boolean },
): Promise<InferenceBackend | null> => {
  for (const backend of backends) {
    if (need.images && backend.capabilities.images === "none") continue;
    const probe = await backend.detect().catch(() => ({ available: false }));
    if (probe.available) return backend;
  }
  return null;
};
export * from "./pass-a.js";
export * from "./pass-b.js";
export * from "./stages.js";
export * from "./strict-schema.js";
export * from "./vision.js";
