import { access, constants, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AsrRequest, AsrStrategy, Exec, Transcript, TranscriptSegment } from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";
import type { LirovoPaths } from "@lirovo/core";
import { resolveBinary } from "../binaries.js";

export const DEFAULT_WHISPER_MODEL = "ggml-base.en-q5_1.bin";

export interface WhisperCppDeps {
  readonly exec: Exec;
  readonly paths: LirovoPaths;
  readonly env?: NodeJS.ProcessEnv;
}

interface WhisperJson {
  transcription?: {
    offsets?: { from?: number; to?: number };
    text?: string;
  }[];
}

/** whisper.cpp reports offsets in milliseconds. */
export const parseWhisperJson = (raw: string): { segments: TranscriptSegment[]; text: string; durationS: number } => {
  const parsed = JSON.parse(raw) as WhisperJson;
  const segments: TranscriptSegment[] = [];
  let durationS = 0;

  for (const item of parsed.transcription ?? []) {
    const text = (item.text ?? "").trim();
    if (text === "") continue;
    const tStart = (item.offsets?.from ?? 0) / 1000;
    const tEnd = (item.offsets?.to ?? 0) / 1000;
    durationS = Math.max(durationS, tEnd);
    segments.push({
      id: `seg_${segments.length}`,
      // whisper.cpp does not diarize. Claiming a speaker we cannot hear would
      // put a name on the wrong sentence, so the field stays null and the
      // downstream prompt reads it as unknown.
      speaker: null,
      tStart,
      tEnd,
      text,
      words: [],
    });
  }
  return { segments, text: segments.map((s) => s.text).join(" "), durationS };
};

export const resolveModelPath = (paths: LirovoPaths, env: NodeJS.ProcessEnv = process.env): string =>
  env["LIROVO_WHISPER_MODEL"] ?? path.join(paths.models, DEFAULT_WHISPER_MODEL);

/**
 * Local transcription with whisper.cpp.
 *
 * The default when there are no subtitles: nothing leaves the machine, there is
 * no key and no quota. Chosen over a Python/MLX stack because a single Metal
 * binary is the only thing that can be signed and notarised inside an app
 * bundle without dragging an interpreter along.
 */
export const createWhisperCppStrategy = (deps: WhisperCppDeps): AsrStrategy => {
  const env = deps.env ?? process.env;

  return {
    name: "whisper-cpp",

    async isAvailable(): Promise<boolean> {
      if ((await resolveBinary("whisper-cli", deps.paths, env)) === null) return false;
      try {
        await access(resolveModelPath(deps.paths, env), constants.R_OK);
        return true;
      } catch {
        // The binary alone is not enough; without weights it cannot transcribe.
        return false;
      }
    },

    async transcribe(req: AsrRequest): Promise<Transcript> {
      const bin = await resolveBinary("whisper-cli", deps.paths, env);
      if (bin === null) throw new LirovoError("DEPENDENCY_MISSING", "whisper-cli not found", { stage: "asr" });
      const model = resolveModelPath(deps.paths, env);

      const ffmpeg = await resolveBinary("ffmpeg", deps.paths, env);
      if (ffmpeg === null) throw new LirovoError("DEPENDENCY_MISSING", "ffmpeg not found", { stage: "asr" });

      const dir = await mkdtemp(path.join(tmpdir(), "lirovo-whisper-"));
      try {
        // whisper.cpp only reads 16 kHz mono PCM WAV.
        const wav = path.join(dir, "audio.wav");
        await deps.exec(
          ffmpeg.path,
          ["-y", "-i", req.audioPath, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav],
          { signal: req.signal as AbortSignal, timeoutMs: 20 * 60 * 1000 },
        );

        const prefix = path.join(dir, "out");
        await deps.exec(
          bin.path,
          [
            "-m", model,
            "-f", wav,
            "-oj",           // JSON output
            "-of", prefix,
            "-np",           // no progress prints
            ...(req.language !== undefined ? ["-l", req.language] : []),
          ],
          { signal: req.signal as AbortSignal, timeoutMs: 60 * 60 * 1000 },
        );

        const parsed = parseWhisperJson(await readFile(`${prefix}.json`, "utf8"));
        if (parsed.segments.length === 0) {
          throw new LirovoError("TRANSCRIBE_FAILED", "whisper produced no speech segments", { stage: "asr" });
        }

        return {
          engine: "whisper-cpp",
          model: path.basename(model),
          language: req.language ?? null,
          durationS: parsed.durationS,
          text: parsed.text,
          segments: parsed.segments,
        };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
};
