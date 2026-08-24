import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AsrRequest, AsrStrategy, Transcript, TranscriptSegment } from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";

/** Placeholder keys are common in copied .env files and produce a confusing 401. */
const PLACEHOLDER = /^(sk-)?(your|xxx+|replace|changeme|todo|placeholder)/i;

interface ApiProvider {
  readonly id: string;
  readonly envKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

const PROVIDERS: readonly ApiProvider[] = [
  { id: "openai", envKey: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1", model: "whisper-1" },
  { id: "groq", envKey: "GROQ_API_KEY", baseUrl: "https://api.groq.com/openai/v1", model: "whisper-large-v3-turbo" },
];

export const selectApiProvider = (env: NodeJS.ProcessEnv): ApiProvider | null => {
  for (const provider of PROVIDERS) {
    const key = env[provider.envKey];
    if (key !== undefined && key.trim() !== "" && !PLACEHOLDER.test(key)) return provider;
  }
  return null;
};

interface VerboseJson {
  language?: string;
  duration?: number;
  text?: string;
  segments?: { id?: number; start?: number; end?: number; text?: string }[];
}

export const parseVerboseJson = (payload: VerboseJson): { segments: TranscriptSegment[]; durationS: number } => {
  const segments: TranscriptSegment[] = [];
  let durationS = payload.duration ?? 0;
  for (const raw of payload.segments ?? []) {
    const text = (raw.text ?? "").trim();
    if (text === "") continue;
    const tEnd = raw.end ?? 0;
    durationS = Math.max(durationS, tEnd);
    segments.push({
      id: `seg_${segments.length}`,
      speaker: null,
      tStart: raw.start ?? 0,
      tEnd,
      text,
      words: [],
    });
  }
  return { segments, durationS };
};

export interface WhisperApiDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Hosted Whisper, last in the chain and opt-in.
 *
 * It only becomes available when the user has deliberately exported a key, and
 * it is the only ASR path that sends audio off the machine — which is exactly
 * why it never runs unless the two local links have both declined.
 */
export const createWhisperApiStrategy = (deps: WhisperApiDeps = {}): AsrStrategy => {
  const env = deps.env ?? process.env;
  const doFetch = deps.fetch ?? globalThis.fetch;

  return {
    name: "whisper-api",

    async isAvailable(): Promise<boolean> {
      return selectApiProvider(env) !== null;
    },

    async transcribe(req: AsrRequest): Promise<Transcript> {
      const provider = selectApiProvider(env);
      if (provider === null) throw new LirovoError("NO_ASR_BACKEND", "no transcription API key set", { stage: "asr" });

      const audio = await readFile(req.audioPath);
      const form = new FormData();
      form.append("file", new Blob([audio]), path.basename(req.audioPath));
      form.append("model", provider.model);
      form.append("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "segment");
      if (req.language !== undefined) form.append("language", req.language);

      const res = await doFetch(`${provider.baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: { authorization: `Bearer ${env[provider.envKey] ?? ""}` },
        body: form,
        signal: req.signal as AbortSignal,
      });

      if (res.status === 401 || res.status === 403) {
        throw new LirovoError("INFERENCE_AUTH_FAILED", `${provider.id} rejected ${provider.envKey}`, { stage: "asr" });
      }
      if (res.status === 429) {
        throw new LirovoError("INFERENCE_QUOTA_EXCEEDED", `${provider.id} rate-limited the request`, { stage: "asr" });
      }
      if (!res.ok) {
        throw new LirovoError("TRANSCRIBE_FAILED", `${provider.id} returned ${res.status}`, { stage: "asr" });
      }

      const payload = (await res.json()) as VerboseJson;
      const parsed = parseVerboseJson(payload);
      return {
        engine: "whisper-api",
        model: `${provider.id}/${provider.model}`,
        language: payload.language ?? req.language ?? null,
        durationS: parsed.durationS,
        text: payload.text ?? parsed.segments.map((s) => s.text).join(" "),
        segments: parsed.segments,
      };
    },
  };
};
