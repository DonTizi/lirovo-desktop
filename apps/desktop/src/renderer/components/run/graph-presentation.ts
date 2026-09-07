import type { GraphNode, Viewport } from "./graph-model";

export const GRAPH_COLORS = {
  context: "var(--graph-context)",
  claim: "var(--graph-claim)",
  measure: "var(--graph-measure)",
  actor: "var(--graph-actor)",
};
export const GRAPH_ACCENT = "var(--graph-accent)";
export function graphFamily(type: string): keyof typeof GRAPH_COLORS {
  if (["topic", "theme", "product", "slide", "frame"].includes(type))
    return "context";
  if (["metric", "kpi", "investment"].includes(type)) return "measure";
  if (["speaker", "person", "org"].includes(type)) return "actor";
  return "claim";
}

export function graphTopics(
  nodes: readonly GraphNode[],
  query: string,
): GraphNode[] {
  const search = query.trim().toLocaleLowerCase();
  if (search)
    return nodes.filter((node) =>
      node.label.toLocaleLowerCase().includes(search),
    );
  const topics = nodes.filter(
    (node) => node.type === "topic" || node.type === "theme",
  );
  return topics.length ? topics : [...nodes];
}

export type NodePositions = ReadonlyMap<string, { x: number; y: number }>;

/** A shallow, deterministic curve; endpoints always remain on the actual nodes. */
export function graphConnectionCurve(
  a: { x: number; y: number },
  b: { x: number; y: number },
  index: number,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const bend = Math.min(28, length * 0.12) * (index % 2 ? 1 : -1);
  const control = {
    x: (a.x + b.x) / 2 - (length ? dy / length : 0) * bend,
    y: (a.y + b.y) / 2 + (length ? dx / length : 0) * bend,
  };
  return {
    path: `M ${a.x} ${a.y} Q ${control.x} ${control.y} ${b.x} ${b.y}`,
    point: (t: number) => ({
      x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t ** 2 * b.x,
      y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t ** 2 * b.y,
    }),
  };
}

/** Decorative highlights only, not activity or inferred direction. At most twelve. */
export const graphHasPulse = (index: number, total: number): boolean =>
  total > 0 && index % Math.max(1, Math.ceil(total / 12)) === 0;

/** Gentle presentation motion; offsets pin dragged nodes and never alter source coordinates. */
export function graphPositions(
  nodes: readonly GraphNode[],
  elapsed: number,
  pinned: NodePositions,
): GraphNode[] {
  const settle = 1 - 0.14 * Math.exp(-elapsed / 380);
  const amplitude = 3 * (1 - Math.exp(-elapsed / 1000));
  return nodes.map((node, i) => {
    const fixed = pinned.get(node.id);
    return {
      ...node,
      x:
        fixed?.x ??
        node.x * settle + Math.sin(elapsed / 2600 + i * 1.7) * amplitude,
      y:
        fixed?.y ??
        node.y * settle + Math.cos(elapsed / 3100 + i * 2.3) * amplitude,
    };
  });
}

export function graphDotRadius(node: GraphNode): number {
  return Math.min(6.5, 3 + Math.sqrt(node.degree) * 0.55);
}

export interface GraphCanvasLabel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
}

/** Whole labels only. Reserve both text boxes and node hit areas in viewport coordinates. */
export function graphCanvasLabels(
  nodes: readonly GraphNode[],
  selected: string | null,
  unit: number,
  view: Viewport,
): GraphCanvasLabel[] {
  const result: GraphCanvasLabel[] = [];
  const ordered = [...nodes].sort(
    (a, b) =>
      Number(b.id === selected) - Number(a.id === selected) ||
      Number(b.type === "topic") - Number(a.type === "topic") ||
      b.degree - a.degree,
  );
  for (const node of ordered) {
    if (
      node.label.length > 90 ||
      (node.id !== selected && graphFamily(node.type) !== "context")
    )
      continue;
    const lines: string[] = [];
    for (const word of node.label.split(/\s+/)) {
      const last = lines.length - 1;
      if (last >= 0 && lines[last]!.length + word.length < 23)
        lines[last] += ` ${word}`;
      else lines.push(word);
    }
    const width = Math.max(...lines.map((line) => line.length), 1) * 6.6 * unit;
    const height = lines.length * 16 * unit;
    const candidates = [12, 32, 56, 88, 120].flatMap((distance) => {
      const gap = distance * unit;
      return [
        { x: node.x + gap, y: node.y - height / 2 },
        { x: node.x - width - gap, y: node.y - height / 2 },
        { x: node.x - width / 2, y: node.y + gap },
        { x: node.x - width / 2, y: node.y - height - gap },
      ];
    });
    for (const point of candidates) {
      const box = { ...point, width, height, id: node.id, lines };
      if (
        box.x < view.x ||
        box.y < view.y ||
        box.x + width > view.x + view.width ||
        box.y + height > view.y + view.height
      )
        continue;
      const overlapsText = result.some(
        (other) =>
          box.x < other.x + other.width + 8 * unit &&
          box.x + width + 8 * unit > other.x &&
          box.y < other.y + other.height + 6 * unit &&
          box.y + height + 6 * unit > other.y,
      );
      const overlapsNode = nodes.some(
        (other) =>
          other.x + 9 * unit > box.x &&
          other.x - 9 * unit < box.x + width &&
          other.y + 9 * unit > box.y &&
          other.y - 9 * unit < box.y + height,
      );
      if (overlapsText || overlapsNode) continue;
      result.push(box);
      break;
    }
  }
  return result;
}
