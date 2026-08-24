import type { Modality, TranscriptSegment } from "@lirovo/contracts";

export interface KgNode {
  readonly id: string;
  readonly type: string;
  readonly label?: string;
  readonly text?: string;
  readonly t?: number;
  readonly t_start?: number;
  readonly t_end?: number;
  readonly [key: string]: unknown;
}
export interface KgEdge {
  readonly from: string;
  readonly to: string;
  readonly type: string;
}
export interface KgEvidence {
  readonly node_id: string;
  readonly modality: Modality;
  readonly source_ref: string;
  readonly span?: readonly [number, number];
}
export interface Kg {
  readonly version: string;
  readonly duration_s: number;
  readonly nodes: readonly KgNode[];
  readonly edges: readonly KgEdge[];
  readonly evidence: readonly KgEvidence[];
}

/** `asr#seg_3` or `frame#000042` — anything else is not an anchor we can seek to. */
export const SOURCE_REF = /^(asr#seg_[A-Za-z0-9_]+|frame#\d{6})$/;

export interface CleanReport {
  readonly kg: Kg;
  readonly droppedEdges: number;
  readonly droppedEvidence: number;
  readonly droppedNodes: number;
}

/**
 * Drop everything that does not resolve.
 *
 * A model that invents a node id produces an edge pointing at nothing and a
 * citation that cannot be seeked to. Both look harmless in JSON and both
 * become a broken "jump to source" the first time a user clicks one, so they
 * are removed here rather than surfaced later.
 *
 * Orphan nodes go too: a node with no evidence is an assertion with nothing
 * behind it, which is the one thing this product must not ship.
 */
export const cleanKg = (kg: Kg): CleanReport => {
  const nodeIds = new Set(kg.nodes.map((n) => n.id));

  const evidence = kg.evidence.filter((e) => nodeIds.has(e.node_id) && SOURCE_REF.test(e.source_ref));
  const backed = new Set(evidence.map((e) => e.node_id));
  const nodes = kg.nodes.filter((n) => backed.has(n.id));
  const kept = new Set(nodes.map((n) => n.id));
  const edges = kg.edges.filter((e) => kept.has(e.from) && kept.has(e.to));

  return {
    kg: { ...kg, nodes, edges, evidence: evidence.filter((e) => kept.has(e.node_id)) },
    droppedNodes: kg.nodes.length - nodes.length,
    droppedEdges: kg.edges.length - edges.length,
    droppedEvidence: kg.evidence.length - evidence.length,
  };
};

/**
 * Give every node a timestamp it can be seeked to.
 *
 * Models routinely omit `t` on a claim even when the evidence they attached to
 * it carries an exact span. Deriving it here is deterministic and replay-safe,
 * and it is the difference between a value you can click and one you cannot.
 */
export const backfillNodeTimestamps = (kg: Kg): Kg => {
  const spans = new Map<string, { start: number; end: number }>();
  for (const e of kg.evidence) {
    if (e.span === undefined) continue;
    const [start, end] = e.span;
    const current = spans.get(e.node_id);
    spans.set(e.node_id, {
      start: current === undefined ? start : Math.min(current.start, start),
      end: current === undefined ? end : Math.max(current.end, end),
    });
  }

  return {
    ...kg,
    nodes: kg.nodes.map((node) => {
      if (node.t !== undefined || node.t_start !== undefined) return node;
      const span = spans.get(node.id);
      return span === undefined ? node : { ...node, t_start: span.start, t_end: span.end };
    }),
  };
};

export interface Window {
  readonly index: number;
  readonly tStart: number;
  readonly tEnd: number;
  readonly segments: readonly TranscriptSegment[];
}

/**
 * Split a transcript into windows small enough to reason over.
 *
 * The alternative — truncating the prompt — silently discards the end of every
 * long recording, which is exactly the content a user who uploaded a two-hour
 * conference cares about. Windows are cut on segment boundaries so no sentence
 * is split, and they overlap by one segment so a claim spanning the seam is
 * visible whole to at least one window.
 */
export const planWindows = (
  segments: readonly TranscriptSegment[],
  maxChars: number,
  durationS: number,
): readonly Window[] => {
  if (segments.length === 0) return [];

  const windows: Window[] = [];
  let current: TranscriptSegment[] = [];
  let size = 0;

  const flush = (): void => {
    if (current.length === 0) return;
    windows.push({
      index: windows.length,
      tStart: current[0]?.tStart ?? 0,
      tEnd: current.at(-1)?.tEnd ?? durationS,
      segments: current,
    });
  };

  for (const segment of segments) {
    const cost = segment.text.length + 64; // the rendered prefix costs too
    if (size + cost > maxChars && current.length > 0) {
      flush();
      // One segment of overlap, so a claim on the boundary is complete somewhere.
      const last = current.at(-1);
      current = last === undefined ? [] : [last];
      size = last === undefined ? 0 : last.text.length + 64;
    }
    current.push(segment);
    size += cost;
  }
  flush();
  return windows;
};

/**
 * Merge per-window graphs into one.
 *
 * Node ids are only unique WITHIN a graph — every window independently names
 * its first node `n1`. Prefixing by window is what stops window 2's `n1` from
 * silently absorbing window 1's edges, which would attach a speaker to the
 * wrong claim with no error anywhere.
 */
export const mergeWindowKgs = (parts: readonly { window: Window; kg: Kg }[], durationS: number): Kg => {
  const nodes: KgNode[] = [];
  const edges: KgEdge[] = [];
  const evidence: KgEvidence[] = [];
  const seenEdge = new Set<string>();

  for (const { window, kg } of parts) {
    const rename = (id: string): string => `w${window.index}_${id}`;
    for (const node of kg.nodes) nodes.push({ ...node, id: rename(node.id) });
    for (const edge of kg.edges) {
      const key = `${rename(edge.from)}|${rename(edge.to)}|${edge.type}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      edges.push({ from: rename(edge.from), to: rename(edge.to), type: edge.type });
    }
    for (const e of kg.evidence) evidence.push({ ...e, node_id: rename(e.node_id) });
  }

  return { version: "1.0", duration_s: durationS, nodes, edges, evidence };
};
