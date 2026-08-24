import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ArtifactStore, Exec } from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";
import type { LirovoPaths, MediaStages } from "@lirovo/core";
import { resolveBinary } from "../binaries.js";
import { ingest } from "./ingest.js";
import { normalize } from "./normalize.js";
import { sceneDetect } from "./scene-detect.js";
import { dedupFrames } from "./dedup.js";

export interface MediaStagesDeps {
  readonly exec: Exec;
  readonly store: ArtifactStore;
  readonly paths: LirovoPaths;
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Bind the media stages to the binaries this machine actually has.
 *
 * Resolution happens once, up front, rather than per stage: discovering
 * halfway through a run that ffmpeg is missing wastes whatever the download
 * already cost.
 */
export const buildMediaStages = async (deps: MediaStagesDeps): Promise<MediaStages> => {
  const env = deps.env ?? process.env;
  const [ffmpeg, ffprobe, ytDlp] = await Promise.all([
    resolveBinary("ffmpeg", deps.paths, env),
    resolveBinary("ffprobe", deps.paths, env),
    resolveBinary("yt-dlp", deps.paths, env),
  ]);
  if (ffmpeg === null) throw new LirovoError("DEPENDENCY_MISSING", "ffmpeg not found");
  if (ffprobe === null) throw new LirovoError("DEPENDENCY_MISSING", "ffprobe not found");

  return {
    async ingest(input) {
      // Downloads land in the run's own directory, so a cancelled run leaves
      // its partial file where `remove(runId)` will collect it.
      const workDir = path.join(path.dirname(deps.store.resolve(input.runId, "x")), "source");
      await mkdir(workDir, { recursive: true });
      return ingest(
        { runId: input.runId, source: input.source, signal: input.signal as AbortSignal },
        { exec: deps.exec, store: deps.store, ffprobe: ffprobe.path, ytDlp: ytDlp?.path ?? null, workDir },
      );
    },

    normalize: (input) =>
      normalize(
        { ...input, signal: input.signal as AbortSignal },
        { exec: deps.exec, store: deps.store, ffmpeg: ffmpeg.path },
      ),

    sceneDetect: async (input) => {
      const result = await sceneDetect(
        { ...input, signal: input.signal as AbortSignal },
        { exec: deps.exec, store: deps.store, ffmpeg: ffmpeg.path },
      );
      return { rawFrameCount: result.rawFrameCount };
    },

    dedup: async (input) => {
      const result = await dedupFrames({ runId: input.runId, signal: input.signal as AbortSignal }, { store: deps.store });
      return { keptCount: result.keptCount, droppedCount: result.droppedCount };
    },
  };
};
