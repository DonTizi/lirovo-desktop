import type {
  CompletionRequest,
  FrameAnalysis,
  InferenceBackend,
  Message,
  TranscriptSegment,
} from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";
import { backfillNodeTimestamps, cleanKg, mergeWindowKgs, planWindows, type Kg, type Window } from "@lirovo/core";
import { KG_JSON_SCHEMA, validateAgainst } from "./schema.js";

/** Roughly 50k characters per window: comfortable for a small local model. */
export const DEFAULT_WINDOW_CHARS = 50_000;

export const SYSTEM_PROMPT_PASS_A = `You build a temporal knowledge graph from a video's transcript and per-frame visual analyses.

Rules:
- Output ONLY a JSON object. No prose, no explanation, no markdown fences.
- Exactly five top-level keys: "version", "duration_s", "nodes", "edges", "evidence".
- "version" is "1.0".
- A node is { "id": a short id like "n1", "type": one of "speaker"|"claim"|"decision"|"kpi"|"slide"|"topic"|"contradiction", "label" or "text": a short human-readable string, optional "t" or "t_start"/"t_end" in seconds }.
- An edge is { "from": node id, "to": node id, "type": one of "said_by"|"about"|"contradicts"|"references"|"owns" }.
- An evidence row is { "node_id": the node it backs, "modality": "audio"|"visual"|"both", "source_ref": "asr#seg_N" for speech or "frame#NNNNNN" (six digits) for a frame, optional "span": [t_start, t_end] in seconds }.
- EVERY node needs at least one evidence row. A node with nothing behind it is invalid.
- Every edge endpoint and every evidence node_id must be a node id you declared.
- Cite only source_refs that appear in the material below. Never invent one.
- Capture structure — who said what, what contradicts what, which slide accompanies which claim — not a re-transcription. Skip filler.`;

const renderSegments = (segments: readonly TranscriptSegment[]): string =>
  segments
    .map((s) => `[seg ${s.id} | ${s.tStart.toFixed(1)}s-${s.tEnd.toFixed(1)}s | ${s.speaker ?? "unknown"}] ${s.text}`)
    .join("\n");

const renderFrames = (frames: readonly FrameAnalysis[]): string => {
  if (frames.length === 0) return "(no visual analyses — audio-only)";
  return frames
    .map((f) => {
      const parts = [`[frame#${String(f.frameIdx).padStart(6, "0")} | ${(f.tMs / 1000).toFixed(1)}s | ${f.sceneType}]`];
      if (f.describes !== "") parts.push(f.describes);
      if (f.ocrText !== null && f.ocrText !== "") parts.push(`text="${f.ocrText.replace(/"/g, "'")}"`);
      if (f.salientObjects.length > 0) parts.push(`objects=[${f.salientObjects.join(", ")}]`);
      return parts.join(" ");
    })
    .join("\n");
};

export interface PassAInput {
  readonly segments: readonly TranscriptSegment[];
  readonly frames: readonly FrameAnalysis[];
  readonly durationS: number;
  readonly windowChars?: number;
  readonly signal: AbortSignal;
}

export interface PassADeps {
  readonly backend: InferenceBackend;
  readonly onWindow?: (done: number, total: number) => void;
}

export interface PassAResult {
  readonly kg: Kg;
  readonly windows: number;
  readonly repaired: number;
  readonly droppedNodes: number;
  readonly droppedEdges: number;
  readonly droppedEvidence: number;
  /** Every prompt sent, kept whole for the run manifest. */
  readonly prompts: Record<string, string>;
}

const framesInWindow = (frames: readonly FrameAnalysis[], window: Window): FrameAnalysis[] =>
  frames.filter((f) => f.tMs / 1000 >= window.tStart && f.tMs / 1000 <= window.tEnd);

/**
 * One model call per window, with a single repair turn on invalid output.
 *
 * The repair is a real conversation turn — the bad answer goes back as the
 * assistant message and the validation errors follow as the user's reply —
 * because a model shown its own mistake fixes it far more reliably than one
 * handed the same instructions a second time.
 */
const buildWindowKg = async (
  window: Window,
  frames: readonly FrameAnalysis[],
  durationS: number,
  deps: PassADeps,
  signal: AbortSignal,
): Promise<{ kg: Kg; prompt: string; repaired: boolean }> => {
  const user = [
    `Video duration: ${durationS.toFixed(1)}s. This excerpt covers ${window.tStart.toFixed(1)}s to ${window.tEnd.toFixed(1)}s.`,
    "",
    "## Transcript",
    renderSegments(window.segments),
    "",
    "## Visual analyses",
    renderFrames(framesInWindow(frames, window)),
  ].join("\n");

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT_PASS_A },
    { role: "user", content: user },
  ];

  const call = async (msgs: readonly Message[]): Promise<{ json: unknown; text: string }> => {
    const request: CompletionRequest = { messages: msgs, schema: KG_JSON_SCHEMA, maxTokens: 8192, temperature: 0.1, signal };
    const result = await deps.backend.complete(request);
    return { json: result.json ?? null, text: result.text };
  };

  const first = await call(messages);
  let errors = validateAgainst(KG_JSON_SCHEMA, first.json);
  if (errors.length === 0) {
    return { kg: { ...(first.json as Kg), duration_s: durationS }, prompt: user, repaired: false };
  }

  const repaired = await call([
    ...messages,
    { role: "assistant", content: first.text },
    {
      role: "user",
      content: `That output failed validation:\n${errors.join("\n")}\n\nReturn the corrected JSON object only.`,
    },
  ]);
  errors = validateAgainst(KG_JSON_SCHEMA, repaired.json);
  if (errors.length > 0) {
    throw new LirovoError("SCHEMA_VALIDATION_FAILED", `Pass A output invalid after one repair: ${errors[0]}`, {
      stage: "graph",
    });
  }
  return { kg: { ...(repaired.json as Kg), duration_s: durationS }, prompt: user, repaired: true };
};

/**
 * Build the knowledge graph.
 *
 * Long inputs are WINDOWED rather than truncated. Cutting a prompt at a
 * character budget silently discards the end of every long recording — which
 * on a two-hour conference is most of it — and the failure looks like a model
 * that just did not notice the later half.
 */
export const runPassA = async (input: PassAInput, deps: PassADeps): Promise<PassAResult> => {
  const windows = planWindows(input.segments, input.windowChars ?? DEFAULT_WINDOW_CHARS, input.durationS);
  if (windows.length === 0) {
    throw new LirovoError("INFERENCE_FAILED", "nothing to build a graph from — the transcript is empty", {
      stage: "graph",
    });
  }

  const parts: { window: Window; kg: Kg }[] = [];
  const prompts: Record<string, string> = {};
  let repaired = 0;

  // Sequential on purpose: a local model server serves one request at a time,
  // and firing every window at once just queues them behind each other while
  // making cancellation and progress reporting harder to reason about.
  for (const window of windows) {
    const built = await buildWindowKg(window, input.frames, input.durationS, deps, input.signal);
    parts.push({ window, kg: built.kg });
    prompts[`pass_a_window_${window.index}`] = built.prompt;
    if (built.repaired) repaired += 1;
    deps.onWindow?.(parts.length, windows.length);
  }

  const merged = mergeWindowKgs(parts, input.durationS);
  const cleaned = cleanKg(merged);
  return {
    kg: backfillNodeTimestamps(cleaned.kg),
    windows: windows.length,
    repaired,
    droppedNodes: cleaned.droppedNodes,
    droppedEdges: cleaned.droppedEdges,
    droppedEvidence: cleaned.droppedEvidence,
    prompts,
  };
};
