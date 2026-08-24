import type { ArtifactStore, InferenceBackend } from "@lirovo/contracts";
import type { InferenceStages } from "@lirovo/core";
import { runPassA } from "./pass-a.js";
import { runPassB } from "./pass-b.js";
import { runVision } from "./vision.js";

export interface InferenceStagesDeps {
  readonly backend: InferenceBackend;
  readonly store: ArtifactStore;
  readonly onWindow?: (done: number, total: number) => void;
  readonly onVisionBatch?: (done: number, total: number) => void;
  /** Vision may run on a cheaper backend than reasoning. Defaults to the same one. */
  readonly visionBackend?: InferenceBackend;
}

/** Bind the two model stages to one backend. */
export const buildInferenceStages = (deps: InferenceStagesDeps): InferenceStages => ({
  describeFrames: async (input) => {
    const backend = deps.visionBackend ?? deps.backend;
    if (backend.capabilities.images === "none") {
      return { analyses: [], sessions: 0, framesMissing: 0 };
    }
    const result = await runVision(
      { runId: input.runId, signal: input.signal as AbortSignal },
      {
        backend,
        store: deps.store,
        ...(deps.onVisionBatch ? { onProgress: deps.onVisionBatch } : {}),
      },
    );
    return { analyses: result.analyses, sessions: result.sessions, framesMissing: result.framesMissing };
  },

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
