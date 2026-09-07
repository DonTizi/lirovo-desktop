import { LirovoError, type AsrStrategy, type Exec, type Logger } from "@lirovo/contracts";
import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import type { LirovoPaths } from "@lirovo/core";
import { createCaptionsStrategy } from "./captions.js";
import { createWhisperCppStrategy, resolveModelPath } from "./whisper-cpp.js";
import { createWhisperApiStrategy, selectApiProvider } from "./whisper-api.js";
import { createAsrChain } from "./smart.js";
import { assertTranscriptQuality, TranscriptQualityError } from "./quality.js";
import { createFsArtifactStore } from "../store/artifacts.js";

export * from "./vtt.js";
export * from "./captions.js";
export * from "./whisper-cpp.js";
export * from "./whisper-api.js";
export * from "./smart.js";
export * from "./probe.js";
export * from "./quality.js";

export interface AsrDeps {
  readonly exec: Exec;
  readonly paths: LirovoPaths;
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: Logger;
  /** Explicit per-run consent to send audio to a hosted transcription API. */
  readonly allowRemote?: boolean;
  readonly language?: string;
}

/** The chain, in preference order: free, then local, then remote. */
export const buildAsrStrategies = (deps: AsrDeps): readonly AsrStrategy[] => {
  const shared = { exec: deps.exec, paths: deps.paths, ...(deps.env ? { env: deps.env } : {}) };
  return [
    createCaptionsStrategy(shared),
    createWhisperCppStrategy(shared),
    createWhisperApiStrategy(deps.env ? { env: deps.env } : {}),
  ];
};

export const buildAsrChain = (deps: AsrDeps): AsrStrategy => {
  const chain = createAsrChain(buildAsrStrategies(deps).filter((strategy) => deps.allowRemote === true || strategy.name !== "whisper-api"), deps.logger);
  const env = deps.env ?? process.env;
  const model = resolveModelPath(deps.paths, env);
  let weights: { size: number; modified: number } | null = null;
  try {
    const stat = statSync(model);
    weights = { size: stat.size, modified: stat.mtimeMs };
  } catch { /* Availability and transcription report missing weights. */ }
  const language = deps.language ?? "auto";
  return {
    ...chain,
    cacheIdentity: JSON.stringify({ version: "quality-v1", language, model, weights,
      remote: deps.allowRemote === true ? selectApiProvider(env)?.model ?? null : false }),
    validateTranscript: assertTranscriptQuality,
    transcribe: async (req) => {
      try { return await chain.transcribe({ ...req, language: req.language ?? language }); }
      catch (error) {
        if (!(error instanceof TranscriptQualityError)) throw error;
        const relativePath = `asr-quality-${randomUUID()}.json`;
        await createFsArtifactStore(deps.paths.runs).put(req.runId, relativePath, JSON.stringify({
          createdAt: new Date().toISOString(), status: "needs-review", issues: error.issues,
          transcript: error.transcript, note: "Rejected candidate, not trusted source evidence. No automatic provider fallback was attempted.",
        }, null, 2));
        throw new LirovoError(error.code, `${error.message} The complete candidate was saved as ${relativePath} in this extraction's artifacts. No automatic provider fallback was attempted.`, {
          stage: "asr", runId: req.runId, detail: { qualityIssues: error.issues, qualityArtifact: relativePath },
        });
      }
    },
  };
};
