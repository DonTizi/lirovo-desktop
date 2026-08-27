import type { EvidenceDraft, InferenceBackend, Message, Modality } from "@lirovo/contracts";
import { LirovoError } from "@lirovo/contracts";
import type { Kg, KgNode } from "@lirovo/core";
import { passBSchema, validateAgainst } from "./schema.js";

export const SYSTEM_PROMPT_PASS_B = `You turn a temporal knowledge graph extracted from a video into one JSON object matching a caller-supplied JSON Schema.

Rules:
- Output ONLY a JSON object. No prose, no explanation, no markdown fences.
- Exactly two top-level keys: "data" and "evidence".
- "data" must conform to the schema: correct types, every required property present, every enum respected.
- A field's "description" in the schema is an INSTRUCTION, not a label. It says what belongs in that field and what does not. Where it draws a boundary — asserted rather than asked, committed rather than considered, shown rather than mentioned — honour the boundary. A value that fits the type but breaks the description is wrong.
- "evidence" is an array of { "field_path": string, "node_id": string }.
  "field_path" is a path into "data" — "title", "decisions[0]", "attendees[2].name".
  "node_id" must be one of the node ids listed in the graph below.
- Every leaf value in "data" needs at least one evidence row. Where a value draws on several nodes, emit one row per node, all sharing the field_path.
- Extract only what the graph supports. If it gives no basis for a required value, use the most neutral schema-valid value and cite the closest relevant node.
- Never invent a fact. Never invent a node id.`;

/**
 * Render the graph deterministically.
 *
 * Nodes grouped by type and sorted by id, edges sorted: the same graph always
 * produces byte-identical prompt text, which is what makes a run reproducible
 * from its manifest rather than merely described by it.
 */
export const renderKgForPrompt = (kg: Kg): string => {
  const byType = new Map<string, KgNode[]>();
  for (const node of kg.nodes) {
    const bucket = byType.get(node.type) ?? [];
    bucket.push(node);
    byType.set(node.type, bucket);
  }

  const lines: string[] = [`# Knowledge graph (duration ${kg.duration_s}s)`, "", "## Nodes"];
  for (const type of [...byType.keys()].sort()) {
    lines.push(`### ${type}`);
    for (const node of (byType.get(type) ?? []).sort((a, b) => a.id.localeCompare(b.id))) {
      const parts = [`id=${node.id}`];
      if (node.label !== undefined) parts.push(`label="${node.label.replace(/"/g, "'")}"`);
      if (node.text !== undefined) parts.push(`text="${node.text.replace(/"/g, "'")}"`);
      if (node.t !== undefined) parts.push(`t=${node.t}`);
      if (node.t_start !== undefined) parts.push(`t_start=${node.t_start} t_end=${node.t_end ?? node.t_start}`);
      lines.push(`- ${parts.join(" ")}`);
    }
  }

  lines.push("", "## Edges");
  const edges = [...kg.edges].sort((a, b) => `${a.from}${a.to}${a.type}`.localeCompare(`${b.from}${b.to}${b.type}`));
  for (const edge of edges) lines.push(`- ${edge.from} --${edge.type}--> ${edge.to}`);
  return lines.join("\n");
};

export interface Citation {
  readonly field_path: string;
  readonly node_id: string;
}

/**
 * Turn the model's node citations into seekable evidence.
 *
 * A citation naming a node that does not exist is dropped rather than
 * repaired: it is a hallucinated id, and keeping it would produce a value the
 * UI presents as grounded and that jumps nowhere when clicked.
 */
export const resolveCitations = (citations: readonly Citation[], kg: Kg): Map<string, EvidenceDraft[]> => {
  const nodes = new Map(kg.nodes.map((n) => [n.id, n]));
  const evidenceByNode = new Map<string, typeof kg.evidence>();
  for (const e of kg.evidence) {
    const bucket = evidenceByNode.get(e.node_id) ?? [];
    evidenceByNode.set(e.node_id, [...bucket, e]);
  }

  const out = new Map<string, EvidenceDraft[]>();
  for (const citation of citations) {
    if (typeof citation.field_path !== "string" || citation.field_path.trim() === "") continue;
    if (!nodes.has(citation.node_id)) continue;

    const node = nodes.get(citation.node_id) as KgNode;
    for (const e of evidenceByNode.get(citation.node_id) ?? []) {
      const [tStart, tEnd] = e.span ?? [node.t_start ?? node.t ?? 0, node.t_end ?? node.t ?? 0];
      const draft: EvidenceDraft = {
        modality: e.modality as Modality,
        sourceRef: e.source_ref,
        tStart,
        tEnd,
        quote: node.text ?? node.label ?? null,
        nodeKey: citation.node_id,
      };
      const bucket = out.get(citation.field_path) ?? [];
      bucket.push(draft);
      out.set(citation.field_path, bucket);
    }
  }
  return out;
};

export interface PassBInput {
  readonly kg: Kg;
  readonly dataSchema: Record<string, unknown>;
  readonly signal: AbortSignal;
}

export interface PassBResult {
  readonly data: unknown;
  readonly evidenceByField: Map<string, EvidenceDraft[]>;
  readonly repaired: boolean;
  readonly citationsDropped: number;
  readonly prompt: string;
}

export const runPassB = async (
  input: PassBInput,
  deps: { backend: InferenceBackend },
): Promise<PassBResult> => {
  if (input.kg.nodes.length === 0) {
    throw new LirovoError("INFERENCE_FAILED", "the knowledge graph is empty — nothing to extract from", {
      stage: "reason",
    });
  }

  const envelope = passBSchema(input.dataSchema);
  const user = [
    renderKgForPrompt(input.kg),
    "",
    "## Target JSON Schema for `data`",
    JSON.stringify(input.dataSchema, null, 2),
  ].join("\n");

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT_PASS_B },
    { role: "user", content: user },
  ];

  const call = async (msgs: readonly Message[]): Promise<{ json: unknown; text: string }> => {
    const result = await deps.backend.complete({
      messages: msgs,
      schema: envelope,
      maxTokens: 8192,
      temperature: 0.1,
      signal: input.signal,
    });
    return { json: result.json ?? null, text: result.text };
  };

  let repaired = false;
  let payload = await call(messages);
  let errors = validateAgainst(envelope, payload.json);

  if (errors.length > 0) {
    repaired = true;
    payload = await call([
      ...messages,
      { role: "assistant", content: payload.text },
      {
        role: "user",
        content: `That output failed validation:\n${errors.join("\n")}\n\nReturn the corrected JSON object only.`,
      },
    ]);
    errors = validateAgainst(envelope, payload.json);
    if (errors.length > 0) {
      throw new LirovoError("SCHEMA_VALIDATION_FAILED", `extraction invalid after one repair: ${errors[0]}`, {
        stage: "reason",
      });
    }
  }

  const parsed = payload.json as { data: unknown; evidence: Citation[] };
  const evidenceByField = resolveCitations(parsed.evidence, input.kg);
  const citedFields = new Set(parsed.evidence.map((c) => c.field_path));

  return {
    data: parsed.data,
    evidenceByField,
    repaired,
    citationsDropped: citedFields.size - evidenceByField.size,
    prompt: user,
  };
};
