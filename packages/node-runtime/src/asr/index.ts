import type { AsrStrategy, Exec, Logger } from "@lirovo/contracts";
import type { LirovoPaths } from "@lirovo/core";
import { createCaptionsStrategy } from "./captions.js";
import { createWhisperCppStrategy } from "./whisper-cpp.js";
import { createWhisperApiStrategy } from "./whisper-api.js";
import { createAsrChain } from "./smart.js";

export * from "./vtt.js";
export * from "./captions.js";
export * from "./whisper-cpp.js";
export * from "./whisper-api.js";
export * from "./smart.js";
export * from "./probe.js";

export interface AsrDeps {
  readonly exec: Exec;
  readonly paths: LirovoPaths;
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: Logger;
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

export const buildAsrChain = (deps: AsrDeps): AsrStrategy =>
  createAsrChain(buildAsrStrategies(deps), deps.logger);
