import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Maximize,
  Minus,
  Pause,
  Play,
  Plus,
  Search,
  X,
  Orbit,
} from "lucide-react";
import { formatTime, type Lens } from "./lens";
import {
  connections,
  fitGraph,
  graphModel,
  zoomGraph,
  type Viewport,
} from "./graph-model";
import {
  GRAPH_ACCENT,
  GRAPH_COLORS,
  graphCanvasLabels,
  graphConnectionCurve,
  graphHasPulse,
  graphDotRadius,
  graphFamily,
  graphPositions,
  graphTopics,
  type NodePositions,
} from "./graph-presentation";
import { useGraphMotion, useGraphReducedMotion } from "./use-graph-motion";

interface Drag {
  pointerId: number;
  clientX: number;
  clientY: number;
  start: DOMPoint;
  inverse: DOMMatrix;
  view: Viewport;
  node: string | null;
  position: { x: number; y: number } | null;
  moved: boolean;
}

/** Selection, presentation motion, node placement and source playback remain independent. */
export function GraphView({
  nodes,
  edges,
  lens,
}: {
  nodes: readonly Record<string, unknown>[];
  edges: readonly Record<string, unknown>[];
  lens: Lens;
}): JSX.Element {
  const model = useMemo(() => graphModel(nodes, edges), [nodes, edges]);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [paused, setPaused] = useState(false);
  const [pointerInside, setPointerInside] = useState(false);
  const [keyboardInside, setKeyboardInside] = useState(false);
  const [pinned, setPinned] = useState<NodePositions>(new Map());
  const [size, setSize] = useState({ width: 800, height: 500 });
  const reducedMotion = useGraphReducedMotion();
  const drag = useRef<Drag | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const inspectorId = useId();
  const inspector = useRef<HTMLDivElement | null>(null);
  const motionAllowed = !reducedMotion && model.nodes.length <= 300;
  const elapsed = useGraphMotion(
    svg,
    motionAllowed && !paused && !pointerInside && !keyboardInside,
    model,
  );
  const positions = useMemo(
    () =>
      motionAllowed
        ? graphPositions(model.nodes, elapsed, pinned)
        : model.nodes.map((node) => ({ ...node, ...pinned.get(node.id) })),
    [model, elapsed, pinned, motionAllowed],
  );
  const positioned = useMemo(
    () => new Map(positions.map((node) => [node.id, node])),
    [positions],
  );
  const fit = useMemo(
    () =>
      fitGraph(
        model.nodes.map((node) => ({ ...node, ...pinned.get(node.id) })),
      ),
    [model, pinned],
  );
  const view = viewport ?? fit;
  const unit = Math.max(view.width / size.width, view.height / size.height);
  const active = selected === null ? undefined : model.byId.get(selected);
  const related = useMemo(
    () => connections(model.links, selected),
    [model, selected],
  );
  const highlighted = hover ?? selected;
  const nearby = useMemo(
    () =>
      new Set(
        connections(model.links, highlighted).flatMap((link) => [
          link.a,
          link.b,
        ]),
      ),
    [model, highlighted],
  );
  const topics = useMemo(() => graphTopics(model.nodes, query), [model, query]);
  const labels = useMemo(
    () =>
      graphCanvasLabels(
        model.nodes.map((node) => ({ ...node, ...pinned.get(node.id) })),
        highlighted,
        unit,
        view,
      ),
    [model, pinned, highlighted, unit, view],
  );
  const zoom = fit.width / view.width;
  const hovered = hover === null ? undefined : model.byId.get(hover);

  useEffect(() => {
    setViewport(null);
    setSelected(null);
    setHover(null);
    setQuery("");
    setPinned(new Map());
    drag.current = null;
  }, [model]);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [model]);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (drag.current !== null) return;
      const matrix = element.getScreenCTM();
      if (matrix === null) return;
      const anchor = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
      const deltaUnit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientHeight
            : 1;
      const factor = Math.exp(
        Math.max(-0.3, Math.min(0.3, event.deltaY * deltaUnit * 0.002)),
      );
      setViewport((current) => zoomGraph(current ?? fit, factor, fit, anchor));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [fit]);

  if (!model.nodes.length)
    return (
      <p className="p-5 text-sm text-ink-subtle">
        No graph nodes were saved for this extraction.
      </p>
    );

  return (
    <div
      className="guided-graph"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setSelected(null);
          setHover(null);
        }
      }}
    >
      <aside className="graph-topic-index" aria-label="Graph topics">
        <h2>
          Explore topics <span>{topics.length}</span>
        </h2>
        <label className="graph-search">
          <Search size={14} aria-hidden="true" />
          <input
            aria-label="Search graph nodes"
            placeholder="Search topics…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              aria-label="Clear graph search"
              onClick={() => setQuery("")}
            >
              <X size={13} />
            </button>
          )}
        </label>
        <nav className="graph-topic-list" aria-label="Explore graph nodes">
          <button
            className={selected === null ? "is-selected" : ""}
            aria-pressed={selected === null}
            onClick={() => {
              setSelected(null);
              setHover(null);
              setQuery("");
            }}
          >
            <Orbit size={15} aria-hidden="true" />
            <span>All connections</span>
          </button>
          {topics.map((node) => (
            <button
              key={node.id}
              className={selected === node.id ? "is-selected" : ""}
              aria-pressed={selected === node.id}
              aria-controls={inspectorId}
              onClick={() => {
                setSelected(node.id);
                setHover(null);
              }}
            >
              <i
                className="graph-topic-dot"
                style={{ background: GRAPH_COLORS[graphFamily(node.type)] }}
                aria-hidden="true"
              />
              <span>{node.label}</span>
            </button>
          ))}
          {topics.length === 0 && (
            <p className="graph-no-matches" role="status">
              No matching nodes. Try another word.
            </p>
          )}
        </nav>
        <p className="graph-index-hint">
          Select a topic to explore its connections.
        </p>
      </aside>

      <div className="graph-exploration">
        <header className="graph-heading">
          <div>
            <span className="graph-eyebrow">Knowledge map</span>
            <h2>Ideas, connected.</h2>
            <p>Explore the relationships behind your extraction.</p>
          </div>
          <button
            className="graph-control graph-motion-control"
            aria-label={paused ? "Resume graph motion" : "Pause graph motion"}
            aria-pressed={paused}
            disabled={!motionAllowed}
            title={
              !motionAllowed
                ? reducedMotion
                  ? "System reduced motion is enabled"
                  : "Motion is disabled for large graphs"
                : "Decorative motion rests while you inspect the canvas"
            }
            onClick={() => setPaused((value) => !value)}
          >
            {paused || !motionAllowed ? (
              <Play size={12} />
            ) : (
              <Pause size={12} />
            )}
            <span>
              {!motionAllowed
                ? "Static view"
                : paused
                  ? "Motion paused"
                  : "Motion on"}
            </span>
          </button>
        </header>
        <div className="graph-canvas">
          <svg
            ref={svg}
            tabIndex={0}
            viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
            role="group"
            aria-label={`Knowledge graph, ${model.nodes.length} nodes. Drag a node to move it, or the background to pan.`}
            data-motion={
              motionAllowed && !paused && !pointerInside && !keyboardInside
                ? "running"
                : "paused"
            }
            onPointerEnter={() => setPointerInside(true)}
            onPointerLeave={() => {
              setPointerInside(false);
              setHover(null);
            }}
            onFocusCapture={() => setKeyboardInside(true)}
            onBlurCapture={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setKeyboardInside(false);
            }}
            onKeyDown={(event) => {
              if (["+", "=", "-"].includes(event.key)) {
                event.preventDefault();
                setViewport(
                  zoomGraph(view, event.key === "-" ? 1.25 : 0.8, fit),
                );
              }
              const direction = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              }[event.key];
              if (direction) {
                event.preventDefault();
                const step = view.width * (event.shiftKey ? 0.15 : 0.05);
                setViewport({
                  ...view,
                  x: view.x + direction[0]! * step,
                  y: view.y + direction[1]! * step,
                });
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0 || !event.isPrimary) return;
              const matrix = event.currentTarget.getScreenCTM();
              if (!matrix) return;
              const inverse = matrix.inverse();
              const target =
                event.target instanceof Element
                  ? event.target.closest("[data-node-id]")
                  : null;
              const id = target?.getAttribute("data-node-id") ?? null;
              drag.current = {
                pointerId: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY,
                start: new DOMPoint(
                  event.clientX,
                  event.clientY,
                ).matrixTransform(inverse),
                inverse,
                view,
                node: id,
                position: id === null ? null : (positioned.get(id) ?? null),
                moved: false,
              };
              setViewport(view);
              event.currentTarget.setPointerCapture(event.pointerId);
              event.currentTarget.focus({ preventScroll: true });
            }}
            onPointerMove={(event) => {
              const gesture = drag.current;
              if (!gesture || gesture.pointerId !== event.pointerId) return;
              gesture.moved ||=
                Math.hypot(
                  event.clientX - gesture.clientX,
                  event.clientY - gesture.clientY,
                ) > 4;
              if (!gesture.moved) return;
              setHover(null);
              const point = new DOMPoint(
                event.clientX,
                event.clientY,
              ).matrixTransform(gesture.inverse);
              const dx = point.x - gesture.start.x,
                dy = point.y - gesture.start.y;
              if (gesture.node !== null && gesture.position !== null) {
                const { node, position } = gesture;
                setPinned((current) =>
                  new Map(current).set(node, {
                    x: position.x + dx,
                    y: position.y + dy,
                  }),
                );
              } else
                setViewport({
                  ...gesture.view,
                  x: gesture.view.x - dx,
                  y: gesture.view.y - dy,
                });
            }}
            onPointerUp={(event) => {
              const gesture = drag.current;
              drag.current = null;
              if (
                gesture &&
                gesture.pointerId === event.pointerId &&
                !gesture.moved
              )
                setSelected(gesture.node);
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
          >
            <defs>
              {Object.entries({ ...GRAPH_COLORS, accent: GRAPH_ACCENT }).map(
                ([family, color]) => (
                  <radialGradient
                    key={family}
                    id={`${inspectorId}-glow-${family}`}
                  >
                    <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                    <stop offset="45%" stopColor={color} stopOpacity="0.1" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                  </radialGradient>
                ),
              )}
            </defs>
            {model.links.map((link, i) => {
              const a = positioned.get(link.a)!,
                b = positioned.get(link.b)!;
              const connected =
                link.a === highlighted || link.b === highlighted;
              const curve = graphConnectionCurve(a, b, i);
              const phase = (elapsed / 7200 + i * 0.137) % 1;
              const pulse = curve.point(phase);
              return (
                <g key={i} className="graph-link" aria-hidden="true">
                  {connected && (
                    <path
                      d={curve.path}
                      fill="none"
                      stroke={GRAPH_ACCENT}
                      strokeWidth={5}
                      opacity={0.07}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <path
                    data-graph-edge=""
                    d={curve.path}
                    fill="none"
                    stroke={connected ? GRAPH_ACCENT : "var(--graph-link)"}
                    strokeWidth={connected ? 1.1 : 0.65}
                    opacity={
                      connected ? 0.9 : highlighted === null ? 0.34 : 0.16
                    }
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray={
                      link.label === "contradicts" ? "4 3" : undefined
                    }
                  />
                  {motionAllowed && graphHasPulse(i, model.links.length) && (
                    <circle
                      data-graph-pulse=""
                      cx={pulse.x}
                      cy={pulse.y}
                      r={1.5 * unit}
                      fill={connected ? GRAPH_ACCENT : "var(--graph-pulse)"}
                      opacity={
                        Math.sin(phase * Math.PI) ** 2 *
                        (highlighted === null || connected ? 0.65 : 0.12)
                      }
                    />
                  )}
                </g>
              );
            })}
            {positions.map((node) => (
              <g
                key={node.id}
                data-node-id={node.id}
                role="button"
                tabIndex={0}
                aria-label={`Inspect ${node.label}`}
                aria-pressed={selected === node.id}
                aria-controls={inspectorId}
                onPointerEnter={() => {
                  if (!drag.current) setHover(node.id);
                }}
                onPointerLeave={() => setHover(null)}
                onClick={(event) => {
                  if (event.detail === 0) setSelected(node.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(node.id);
                  }
                }}
                className="graph-node"
              >
                <title>{node.label}</title>
                {(node.id === selected ||
                  node.id === hover ||
                  graphFamily(node.type) === "context") && (
                  <circle
                    className="graph-node-halo"
                    cx={node.x}
                    cy={node.y}
                    r={(node.id === selected ? 30 : 20) * unit}
                    fill={`url(#${inspectorId}-glow-${node.id === selected || node.id === hover ? "accent" : graphFamily(node.type)})`}
                    pointerEvents="none"
                  />
                )}
                {node.id === selected && (
                  <circle
                    className="graph-selection-ring"
                    cx={node.x}
                    cy={node.y}
                    r={
                      (graphDotRadius(node) +
                        5 +
                        (motionAllowed ? Math.sin(elapsed / 1000) : 0)) *
                      unit
                    }
                    fill="none"
                    stroke={GRAPH_ACCENT}
                    strokeWidth={1}
                    strokeOpacity={0.5}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <circle
                  className="graph-dot"
                  cx={node.x}
                  cy={node.y}
                  r={graphDotRadius(node) * unit}
                  stroke={
                    node.id === selected
                      ? "var(--graph-core)"
                      : GRAPH_COLORS[graphFamily(node.type)]
                  }
                  strokeWidth={0.8}
                  vectorEffect="non-scaling-stroke"
                  fill={
                    node.id === selected || node.id === hover
                      ? GRAPH_ACCENT
                      : GRAPH_COLORS[graphFamily(node.type)]
                  }
                  fillOpacity={
                    highlighted === null ||
                    node.id === highlighted ||
                    node.id === selected ||
                    nearby.has(node.id)
                      ? 1
                      : 0.75
                  }
                />
                <circle
                  cx={node.x - unit}
                  cy={node.y - unit}
                  r={1.3 * unit}
                  fill="var(--graph-core)"
                  opacity={0.65}
                  pointerEvents="none"
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={11 * unit}
                  fill="transparent"
                />
              </g>
            ))}
            {labels.map((label) => (
              <g
                key={label.id}
                className="graph-label-group"
                aria-hidden="true"
              >
                <line
                  x1={positioned.get(label.id)!.x}
                  y1={positioned.get(label.id)!.y}
                  x2={Math.max(
                    label.x,
                    Math.min(
                      label.x + label.width,
                      positioned.get(label.id)!.x,
                    ),
                  )}
                  y2={Math.max(
                    label.y,
                    Math.min(
                      label.y + label.height,
                      positioned.get(label.id)!.y,
                    ),
                  )}
                  stroke="currentColor"
                  strokeWidth={0.5}
                  opacity={0.3}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={label.x}
                  y={label.y}
                  fontSize={12 * unit}
                  fill={label.id === selected ? GRAPH_ACCENT : "currentColor"}
                  className="graph-canvas-label"
                  aria-hidden="true"
                >
                  {label.lines.map((line, i) => (
                    <tspan
                      key={i}
                      x={label.x}
                      dy={i === 0 ? 12 * unit : 16 * unit}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            ))}
          </svg>
          {hovered && hovered.id !== selected && (
            <div className="graph-hover-label">
              <span>{hovered.type}</span>
              {hovered.label}
            </div>
          )}
        </div>

        <div
          id={inspectorId}
          ref={inspector}
          tabIndex={-1}
          className="graph-inspector"
          aria-label="Selected node"
        >
          {active ? (
            <motion.section
              key={active.id}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
            >
              <div className="graph-inspector-caption">
                <span>
                  Selected {active.type} · {related.length} connections
                </span>
                <button
                  className="graph-control"
                  aria-label="Clear graph selection"
                  onClick={() => setSelected(null)}
                >
                  <X size={14} />
                </button>
              </div>
              <p className="graph-selected-text">{active.label}</p>
              <div className="graph-inspector-actions">
                {active.t !== null && (
                  <button
                    className="graph-source-action"
                    aria-label={`Play graph source at ${formatTime(active.t)}`}
                    onClick={() => lens.seek(active.t!)}
                  >
                    <span>{formatTime(active.t)}</span>
                    <Play size={13} />
                    Play source
                  </button>
                )}
                <details key={active.id} className="graph-connections">
                  <summary>
                    {related.length
                      ? "View connections"
                      : "No saved connections"}
                  </summary>
                  <ul>
                    {related.map((link, i) => {
                      const other = model.byId.get(
                        link.a === active.id ? link.b : link.a,
                      )!;
                      return (
                        <li key={i}>
                          <button
                            onClick={() => {
                              setSelected(other.id);
                              inspector.current?.focus({ preventScroll: true });
                            }}
                          >
                            <span>{link.label.replaceAll("_", " ")}</span>
                            {other.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </div>
            </motion.section>
          ) : (
            <div className="graph-inspector-empty">
              <Orbit size={22} strokeWidth={1.25} aria-hidden="true" />
              <p>Start with an idea.</p>
              <span>
                Choose a topic or a point to read its details and play the
                source.
              </span>
            </div>
          )}
        </div>
      </div>

      <footer className="graph-footer">
        <div className="graph-legend">
          {Object.entries(GRAPH_COLORS).map(([family, color]) => (
            <span key={family}>
              <i style={{ background: color }} />
              {family}
            </span>
          ))}
        </div>
        <span className="graph-count">
          {model.nodes.length} nodes · {model.links.length} links
        </span>
        <div
          className="graph-controls"
          role="group"
          aria-label="Graph viewport"
        >
          <button
            className="graph-control"
            aria-label="Zoom out graph"
            disabled={zoom <= 0.5}
            onClick={() => setViewport(zoomGraph(view, 1.25, fit))}
          >
            <Minus size={15} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            className="graph-control"
            aria-label="Zoom in graph"
            disabled={zoom >= 4}
            onClick={() => setViewport(zoomGraph(view, 0.8, fit))}
          >
            <Plus size={15} />
          </button>
          <button className="graph-control" onClick={() => setViewport(null)}>
            <Maximize size={14} />
            Fit
          </button>
        </div>
      </footer>
      {model.omittedEdges > 0 && (
        <p className="graph-warning">
          {model.omittedEdges} connections reference missing nodes and cannot be
          drawn.
        </p>
      )}
    </div>
  );
}
