import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime, type Lens } from "./lens";
import { cn } from "../../lib/cn";

interface Sim {
  id: string;
  label: string;
  type: string;
  t: number | null;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Link {
  readonly a: string;
  readonly b: string;
  readonly label: string;
  readonly contradicts: boolean;
}

/**
 * Colour is the node's kind, and it is the only thing colour says here.
 *
 * Four families rather than eleven: who spoke, what it was about, what was
 * asserted, and what was measured. A palette with a shade per node type is a
 * legend nobody reads.
 */
const FAMILY: Record<string, "actor" | "context" | "claim" | "measure"> = {
  speaker: "actor",
  person: "actor",
  org: "actor",
  topic: "context",
  theme: "context",
  product: "context",
  slide: "context",
  frame: "context",
  claim: "claim",
  quote: "claim",
  decision: "claim",
  metric: "measure",
  kpi: "measure",
  investment: "measure",
};

const COLOR = {
  actor: "var(--kumo-text-subtle)",
  context: "var(--kumo-warning)",
  claim: "var(--kumo-link)",
  measure: "var(--kumo-success)",
} as const;

const familyOf = (type: string): keyof typeof COLOR => FAMILY[type] ?? "context";

const textOf = (node: Record<string, unknown>): string => {
  for (const key of ["label", "text", "id"] as const) {
    const value = node[key];
    if (typeof value === "string" && value !== "") return value;
  }
  return "node";
};

const timeOf = (node: Record<string, unknown>): number | null => {
  for (const key of ["t_start", "t"] as const) {
    const value = node[key];
    if (typeof value === "number") return value;
  }
  return null;
};

const WIDTH = 900;
const HEIGHT = 560;

/**
 * A knowledge graph the way a graph looks.
 *
 * A column diagram of the same nodes is easier to lay out and answers a
 * different question: it shows what KINDS of thing were found. This shows what
 * is connected to what, which is the question a graph is for — a claim with
 * five edges is visibly the centre of the video, and an island is visibly
 * ungrounded.
 *
 * The simulation is written out rather than pulled in: repulsion between every
 * pair, a spring along every edge, and a pull to the middle. At the sizes a
 * single video produces — tens of nodes, rarely hundreds — the quadratic pass
 * is cheaper than the dependency, and it stops after it settles instead of
 * spinning a frame loop forever.
 */
export function GraphView({
  nodes,
  edges,
  lens,
}: {
  nodes: readonly Record<string, unknown>[];
  edges: readonly Record<string, unknown>[];
  lens: Lens;
}): JSX.Element {
  const [tick, setTick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ id: string | null; x: number; y: number } | null>(null);

  const links: Link[] = useMemo(
    () =>
      edges
        .map((edge) => ({
          a: String(edge["from"] ?? edge["source"] ?? ""),
          b: String(edge["to"] ?? edge["target"] ?? ""),
          label: String(edge["type"] ?? edge["label"] ?? ""),
          contradicts: String(edge["type"] ?? "") === "contradicts",
        }))
        .filter((l) => l.a !== "" && l.b !== ""),
    [edges],
  );

  const sim = useRef<Sim[]>([]);

  // Seeded from the node list, not from the animation: re-running the layout
  // every time the parent re-renders would make the graph jump under the
  // pointer while somebody is reading it.
  useMemo(() => {
    const degree = new Map<string, number>();
    for (const link of links) {
      degree.set(link.a, (degree.get(link.a) ?? 0) + 1);
      degree.set(link.b, (degree.get(link.b) ?? 0) + 1);
    }
    sim.current = nodes.map((node, i) => {
      const id = String(node["id"] ?? i);
      // A ring rather than random placement: two nodes starting on the same
      // point push each other to infinity, and a deterministic start means the
      // same graph settles the same way twice.
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      return {
        id,
        label: textOf(node),
        type: String(node["type"] ?? "node"),
        t: timeOf(node),
        degree: degree.get(id) ?? 0,
        x: WIDTH / 2 + Math.cos(angle) * 180,
        y: HEIGHT / 2 + Math.sin(angle) * 180,
        vx: 0,
        vy: 0,
      };
    });
  }, [nodes, links]);

  useEffect(() => {
    let alpha = 1;
    let frame = 0;
    const step = (): void => {
      const items = sim.current;
      const byId = new Map(items.map((n) => [n.id, n]));

      for (let i = 0; i < items.length; i++) {
        const a = items[i] as Sim;
        for (let j = i + 1; j < items.length; j++) {
          const b = items[j] as Sim;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = Math.max(60, dx * dx + dy * dy);
          const force = 5200 / d2;
          const d = Math.sqrt(d2);
          a.vx -= (dx / d) * force;
          a.vy -= (dy / d) * force;
          b.vx += (dx / d) * force;
          b.vy += (dy / d) * force;
        }
      }

      for (const link of links) {
        const a = byId.get(link.a);
        const b = byId.get(link.b);
        if (a === undefined || b === undefined) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const pull = (d - 110) * 0.012;
        a.vx += (dx / d) * pull;
        a.vy += (dy / d) * pull;
        b.vx -= (dx / d) * pull;
        b.vy -= (dy / d) * pull;
      }

      for (const node of items) {
        node.vx += (WIDTH / 2 - node.x) * 0.004;
        node.vy += (HEIGHT / 2 - node.y) * 0.004;
        node.vx *= 0.82;
        node.vy *= 0.82;
        if (dragging.current?.id !== node.id) {
          node.x += node.vx * alpha;
          node.y += node.vy * alpha;
        }
      }

      alpha *= 0.985;
      setTick((n) => n + 1);
      // Stops when it settles. A simulation that keeps running is a fan that
      // keeps spinning for a picture that has not moved in ten seconds.
      if (alpha > 0.02) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [links, nodes]);

  const items = sim.current;
  const byId = new Map(items.map((n) => [n.id, n]));
  const neighbours = useMemo(() => {
    if (hover === null) return null;
    const near = new Set<string>([hover]);
    for (const link of links) {
      if (link.a === hover) near.add(link.b);
      if (link.b === hover) near.add(link.a);
    }
    return near;
  }, [hover, links]);

  const dimmed = (id: string): boolean => neighbours !== null && !neighbours.has(id);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="bg-recessed h-[560px] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onWheel={(e) => setZoom((z) => Math.min(3, Math.max(0.4, z - e.deltaY * 0.001)))}
        onPointerDown={(e) => {
          dragging.current = { id: null, x: e.clientX - pan.x, y: e.clientY - pan.y };
        }}
        onPointerMove={(e) => {
          const drag = dragging.current;
          if (drag === null) return;
          if (drag.id === null) {
            setPan({ x: e.clientX - drag.x, y: e.clientY - drag.y });
            return;
          }
          const node = byId.get(drag.id);
          if (node === undefined) return;
          const box = e.currentTarget.getBoundingClientRect();
          node.x = ((e.clientX - box.left) / box.width) * WIDTH;
          node.y = ((e.clientY - box.top) / box.height) * HEIGHT;
          setTick((n) => n + 1);
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerLeave={() => {
          dragging.current = null;
          setHover(null);
        }}
        data-tick={tick}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {links.map((link, i) => {
            const a = byId.get(link.a);
            const b = byId.get(link.b);
            if (a === undefined || b === undefined) return null;
            const faded = neighbours !== null && !(neighbours.has(link.a) && neighbours.has(link.b));
            return (
              <line
                key={`${link.a}-${link.b}-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={link.contradicts ? "var(--kumo-danger-text)" : "var(--kumo-hairline)"}
                strokeWidth={link.contradicts ? 1.5 : 1}
                strokeDasharray={link.contradicts ? "4 3" : undefined}
                opacity={faded ? 0.15 : 1}
              />
            );
          })}

          {items.map((node) => {
            const r = 5 + Math.min(9, node.degree * 1.6);
            const faded = dimmed(node.id);
            return (
              <g
                key={node.id}
                opacity={faded ? 0.2 : 1}
                onPointerEnter={() => setHover(node.id)}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragging.current = { id: node.id, x: 0, y: 0 };
                }}
                onClick={() => {
                  if (node.t !== null) lens.seek(node.t);
                }}
                className={node.t === null ? "cursor-default" : "cursor-pointer"}
              >
                <circle cx={node.x} cy={node.y} r={r} fill={COLOR[familyOf(node.type)]} />
                {(zoom > 0.8 || hover === node.id) && (
                  <text
                    x={node.x}
                    y={node.y + r + 11}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--kumo-text-label)"
                    className="pointer-events-none"
                  >
                    {node.label.length > 34 ? `${node.label.slice(0, 33)}…` : node.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="text-ink-subtle pointer-events-none absolute left-3 top-3 flex flex-wrap gap-3 text-[11px]">
        {(Object.keys(COLOR) as (keyof typeof COLOR)[]).map((family) => (
          <span key={family} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: COLOR[family] }} />
            {family}
          </span>
        ))}
      </div>

      {hover !== null && (
        <div className="bg-base shadow-popover pointer-events-none absolute bottom-3 left-3 right-3 rounded px-3 py-2">
          <p className="text-ink-strong truncate text-sm">{byId.get(hover)?.label}</p>
          <p className="text-ink-subtle text-xs">
            {byId.get(hover)?.type}
            {byId.get(hover)?.t !== null && byId.get(hover)?.t !== undefined
              ? ` · ${formatTime(byId.get(hover)?.t as number)} — click to seek`
              : ""}
          </p>
        </div>
      )}

      <button
        onClick={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
        className={cn(
          "bg-base shadow-ring text-ink-subtle hover:text-ink absolute right-3 top-3 rounded px-2 py-1 text-xs transition-colors",
        )}
      >
        Reset view
      </button>
    </div>
  );
}
