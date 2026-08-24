import type {
  BackendCapabilities,
  CompletionRequest,
  CompletionResult,
  InferenceBackend,
  Message,
} from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";
import { extractJson, looksTruncated } from "./json.js";

export interface OpenAiCompatibleConfig {
  readonly id?: string;
  /** Ollama's default. LM Studio is :1234, llama.cpp is :8080. */
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey?: string;
  readonly fetch?: typeof globalThis.fetch;
}

const CAPABILITIES: BackendCapabilities = {
  // Honoured by servers that implement it; the repair loop covers the rest.
  nativeJsonSchema: true,
  // Bytes in the request: no session to amortise, but no filesystem either.
  images: "inline",
  // A persistent server, so dozens of vision calls cost dozens of requests
  // rather than dozens of process launches. This is why it is the default.
  spawnsProcessPerCall: false,
};

interface ChatContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

const toChatMessages = (
  messages: readonly Message[],
  images: CompletionRequest["images"],
): unknown[] => {
  const out = messages.map((m) => ({ role: m.role, content: m.content as string | ChatContentPart[] }));
  if (images === undefined || images.length === 0) return out;

  const lastUser = [...out].reverse().find((m) => m.role === "user");
  if (lastUser === undefined) return out;

  const parts: ChatContentPart[] = [{ type: "text", text: lastUser.content as string }];
  for (const image of images) {
    const b64 = Buffer.from(image.bytes).toString("base64");
    parts.push({ type: "image_url", image_url: { url: `data:${image.mime};base64,${b64}` } });
  }
  lastUser.content = parts;
  return out;
};

export const createOpenAiCompatibleBackend = (config: OpenAiCompatibleConfig): InferenceBackend => {
  const doFetch = config.fetch ?? globalThis.fetch;
  const base = config.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.apiKey !== undefined) headers["authorization"] = `Bearer ${config.apiKey}`;

  return {
    id: config.id ?? "openai-compatible",
    capabilities: CAPABILITIES,

    async detect() {
      try {
        const res = await doFetch(`${base}/models`, { headers, signal: AbortSignal.timeout(2500) });
        if (!res.ok) return { available: false, version: null, reason: `${base}/models returned ${res.status}` };
        const body = (await res.json()) as { data?: { id?: string }[] };
        const ids = (body.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string");
        if (!ids.includes(config.model)) {
          return {
            available: false,
            version: null,
            reason: `model "${config.model}" not served — available: ${ids.slice(0, 5).join(", ") || "none"}`,
          };
        }
        return { available: true, version: config.model };
      } catch (e) {
        // undici's bare "fetch failed" hides which endpoint was tried, which is
        // the one thing a user needs in order to fix it.
        const cause = e instanceof Error ? e.message : String(e);
        return { available: false, version: null, reason: `${base}: ${cause}` };
      }
    },

    async complete(req: CompletionRequest): Promise<CompletionResult> {
      const startedAt = Date.now();
      const body: Record<string, unknown> = {
        model: config.model,
        messages: toChatMessages(req.messages, req.images),
        stream: false,
      };
      if (req.maxTokens !== undefined) body["max_tokens"] = req.maxTokens;
      if (req.temperature !== undefined) body["temperature"] = req.temperature;
      if (req.schema !== undefined) {
        body["response_format"] = {
          type: "json_schema",
          json_schema: { name: "extraction", strict: true, schema: req.schema },
        };
      }

      let res: Response;
      try {
        res = await doFetch(`${base}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: req.signal as AbortSignal,
        });
      } catch (e) {
        throw new LirovoError("INFERENCE_FAILED", `${base}: ${e instanceof Error ? e.message : String(e)}`);
      }

      if (res.status === 401 || res.status === 403) {
        throw new LirovoError("INFERENCE_AUTH_FAILED", `${base} rejected the credentials (${res.status})`);
      }
      if (res.status === 429) {
        throw new LirovoError("INFERENCE_QUOTA_EXCEEDED", `${base} rate-limited the request`);
      }
      if (!res.ok) {
        throw new LirovoError("INFERENCE_FAILED", `${base} returned ${res.status}: ${await res.text()}`);
      }

      const payload = (await res.json()) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const choice = payload.choices?.[0];
      const text = choice?.message?.content ?? "";
      // `finish_reason: "length"` is the server telling us it stopped early.
      const truncated = choice?.finish_reason === "length" || (req.schema !== undefined && looksTruncated(text));
      if (truncated) {
        throw new LirovoError("INFERENCE_TRUNCATED", `${config.model} stopped before finishing its answer`);
      }

      const result: CompletionResult = {
        text,
        model: config.model,
        backendVersion: config.model,
        elapsedMs: Date.now() - startedAt,
        truncated: false,
        ...(req.schema !== undefined ? { json: extractJson(text) } : {}),
        ...(payload.usage !== undefined
          ? {
              usage: {
                ...(payload.usage.prompt_tokens !== undefined ? { inputTokens: payload.usage.prompt_tokens } : {}),
                ...(payload.usage.completion_tokens !== undefined
                  ? { outputTokens: payload.usage.completion_tokens }
                  : {}),
              },
            }
          : {}),
      };
      return result;
    },
  };
};
