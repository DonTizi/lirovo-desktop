export interface GraphNode {
  id: string;
  label: string;
  type: string;
  t: number | null;
  x: number;
  y: number;
  degree: number;
  radius: number;
}
export interface GraphLink {
  a: string;
  b: string;
  label: string;
}
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function graphLabel(node: Record<string, unknown>): string {
  for (const key of ["label", "text", "id"]) {
    const value = node[key];
    if (typeof value === "string" && value !== "") return value;
  }
  return "Untitled node";
}

export function graphTime(node: Record<string, unknown>): number | null {
  for (const key of ["t_start", "t"]) {
    const value = node[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0)
      return value;
  }
  return null;
}

/** Stable, display-only positions. Never mutate the persisted graph or animate under a pointer. */
export function graphModel(
  rawNodes: readonly Record<string, unknown>[],
  rawEdges: readonly Record<string, unknown>[],
) {
  const sourceIds = new Set(
    rawNodes.flatMap((node) => (node.id == null ? [] : [String(node.id)])),
  );
  const ids = new Set<string>();
  const nodes: GraphNode[] = rawNodes.map((node, i) => {
    const original = node.id == null ? null : String(node.id);
    let id = original ?? `node-${i}`;
    if (original === null || ids.has(id)) {
      id = `node-${i}`;
      while (ids.has(id) || sourceIds.has(id)) id += "-";
    }
    ids.add(id);
    const angle = i * 2.399963229728653;
    const radius = Math.sqrt(i + 1) * 32;
    return {
      id,
      label: graphLabel(node),
      type: String(node.type ?? "node"),
      t: graphTime(node),
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      degree: 0,
      radius: 4,
    };
  });
  const links: GraphLink[] = rawEdges
    .map((edge) => ({
      a: String(edge.from ?? edge.source ?? ""),
      b: String(edge.to ?? edge.target ?? ""),
      label: String(edge.type ?? edge.label ?? "related"),
    }))
    .filter((edge) => sourceIds.has(edge.a) && sourceIds.has(edge.b));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const neighbors = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  for (const link of links) {
    if (link.a === link.b) continue;
    neighbors.get(link.a)!.add(link.b);
    neighbors.get(link.b)!.add(link.a);
  }
  for (const node of nodes) {
    node.degree = neighbors.get(node.id)!.size;
    node.radius = Math.min(13, 4 + Math.sqrt(node.degree) * 1.4);
  }
  // Bound quadratic work. Large graphs retain the deterministic spiral layout.
  if (nodes.length <= 300) {
    for (let step = 0; step < 140; step++) {
      const forces = new Map(
        nodes.map((n) => [n.id, { x: -n.x * 0.002, y: -n.y * 0.002 }]),
      );
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const push =
            1800 / (distance * distance) + Math.max(0, 42 - distance) * 0.3;
          const fa = forces.get(a.id)!,
            fb = forces.get(b.id)!;
          fa.x -= (dx / distance) * push;
          fa.y -= (dy / distance) * push;
          fb.x += (dx / distance) * push;
          fb.y += (dy / distance) * push;
        }
      }
      for (const link of links) {
        const a = byId.get(link.a)!,
          b = byId.get(link.b)!;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const pull = (distance - 95) * 0.008;
        const fa = forces.get(a.id)!,
          fb = forces.get(b.id)!;
        fa.x += (dx / distance) * pull;
        fa.y += (dy / distance) * pull;
        fb.x -= (dx / distance) * pull;
        fb.y -= (dy / distance) * pull;
      }
      for (const node of nodes) {
        const force = forces.get(node.id)!;
        node.x += Math.max(-8, Math.min(8, force.x));
        node.y += Math.max(-8, Math.min(8, force.y));
      }
    }
  }
  // The desktop canvas is landscape. Spread its horizontal axis without changing topology.
  for (const node of nodes) node.x *= 1.7;
  return { nodes, links, byId, omittedEdges: rawEdges.length - links.length };
}

export function fitGraph(nodes: readonly GraphNode[]): Viewport {
  if (nodes.length === 0) return { x: -250, y: -180, width: 500, height: 360 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  }
  return {
    x: minX - 36,
    y: minY - 36,
    width: maxX - minX + 72,
    height: maxY - minY + 72,
  };
}

export function zoomGraph(
  view: Viewport,
  factor: number,
  fit: Viewport,
  anchor = { x: view.x + view.width / 2, y: view.y + view.height / 2 },
): Viewport {
  const width = Math.max(
    fit.width / 4,
    Math.min(fit.width * 2, view.width * factor),
  );
  const height = (width * view.height) / view.width;
  return {
    x: anchor.x - ((anchor.x - view.x) * width) / view.width,
    y: anchor.y - ((anchor.y - view.y) * height) / view.height,
    width,
    height,
  };
}

/** Selection describes connections; it never filters the graph's node/edge arrays. */
export function connections(
  links: readonly GraphLink[],
  selected: string | null,
): GraphLink[] {
  return selected === null
    ? []
    : links.filter((link) => link.a === selected || link.b === selected);
}
