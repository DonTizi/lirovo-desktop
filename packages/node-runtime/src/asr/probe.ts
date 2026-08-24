import { access, constants } from "node:fs/promises";
import type { AsrStrategy } from "@lirovo/contracts";
import type { AsrProbe, LirovoPaths } from "@lirovo/core";
import { resolveBinary } from "../binaries.js";
import { resolveModelPath } from "./whisper-cpp.js";
import { selectApiProvider } from "./whisper-api.js";

const noop = new AbortController().signal;

const probeRequest = (kind: "url" | "file") => ({
  runId: "doctor",
  sourceKind: kind,
  sourceUri: kind === "url" ? "https://example.invalid/video" : "/dev/null",
  audioPath: "/dev/null",
  signal: noop,
});

/**
 * Why a link is off, phrased as the thing the user would do about it.
 *
 * A doctor that says "unavailable" and stops is a doctor the user has to
 * reverse-engineer.
 */
const hintFor = async (
  name: string,
  paths: LirovoPaths,
  env: NodeJS.ProcessEnv,
): Promise<string | null> => {
  if (name === "captions") {
    return (await resolveBinary("yt-dlp", paths, env)) === null
      ? "install yt-dlp (brew install yt-dlp)"
      : "only applies to URLs, and only when the platform publishes subtitles";
  }
  if (name === "whisper-cpp") {
    if ((await resolveBinary("whisper-cli", paths, env)) === null) {
      return "install whisper.cpp (brew install whisper-cpp)";
    }
    const model = resolveModelPath(paths, env);
    try {
      await access(model, constants.R_OK);
      return null;
    } catch {
      return `no model at ${model} — download one, or set LIROVO_WHISPER_MODEL`;
    }
  }
  if (name === "whisper-api") {
    return selectApiProvider(env) === null ? "set OPENAI_API_KEY or GROQ_API_KEY to enable (audio leaves the machine)" : null;
  }
  return null;
};

export const makeAsrProbe =
  (strategies: readonly AsrStrategy[], paths: LirovoPaths, env: NodeJS.ProcessEnv = process.env) =>
  async (): Promise<readonly AsrProbe[]> =>
    Promise.all(
      strategies.map(async (strategy) => {
        const [forUrl, forFile] = await Promise.all([
          strategy.isAvailable(probeRequest("url")).catch(() => false),
          strategy.isAvailable(probeRequest("file")).catch(() => false),
        ]);
        return {
          name: strategy.name,
          forUrl,
          forFile,
          hint: forUrl && forFile ? null : await hintFor(strategy.name, paths, env),
        };
      }),
    );
