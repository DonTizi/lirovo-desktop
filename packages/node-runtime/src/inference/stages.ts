import type { InferenceBackend } from "@lirovo/contracts";
import type { InferenceStages } from "@lirovo/core";
import { runPassA } from "./pass-a.js";
import { runPassB } from "./pass-b.js";

export interface InferenceStagesDeps {
  readonly backend: InferenceBackend;
  readonly onWindow?: (done: number, total: number) => void;
}

/** Bind the two model stages to one backend. */
export const buildInferenceStages = (deps: InferenceStagesDeps): InferenceStages => ({
  buildGraph: async (input) => {
    const result = await runPassA(
      { ...input, signal: input.signal as AbortSignal },
      { backend: deps.backend, ...(deps.onWindow ? { onWindow: deps.onWindow } : {}) },
    );
    return { kg: result.kg, windows: result.windows, repaired: result.repaired, prompts: result.prompts };
  },

  extract: async (input) => {
    const result = await runPassB({ ...input, signal: input.signal as AbortSignal }, { backend: deps.backend });
    return {
      data: result.data,
      evidenceByField: result.evidenceByField,
      repaired: result.repaired,
      prompt: result.prompt,
    };
  },
});
