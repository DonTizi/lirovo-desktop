import { describe, expect, it } from "vitest";
import {
  connections,
  fitGraph,
  graphLabel,
  graphModel,
  graphTime,
  zoomGraph,
} from "./graph-model";

const nodes = [
  {
    id: "a",
    label: "A complete label\nwith a second line",
    type: "speaker",
    t_start: 0,
  },
  { id: "b", text: "A claim", type: "claim", t: 12 },
  { id: "c", label: "Unrelated node", type: "metric" },
];
const edges = [{ from: "b", to: "a", type: "said_by" }];

describe("stable graph model", () => {
  it("retains all nodes and full labels without mutating input", () => {
    const before = JSON.stringify({ nodes, edges });
    const model = graphModel(nodes, edges);
    expect(model.nodes.map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(model.nodes[0]?.label).toBe(nodes[0]?.label);
    expect(JSON.stringify({ nodes, edges })).toBe(before);
    expect(graphModel(nodes, edges)).toEqual(model);
  });
  it("selection only returns connections; unrelated nodes remain in the model", () => {
    const model = graphModel(nodes, edges);
    expect(connections(model.links, "a")).toEqual([
      { a: "b", b: "a", label: "said_by" },
    ]);
    expect(connections(model.links, "c")).toEqual([]);
    expect(connections(model.links, null)).toEqual([]);
    expect(model.nodes).toHaveLength(3);
    expect(model.links).toHaveLength(1);
  });
  it("fits every node including its radius and handles empty/isolated graphs", () => {
    for (const input of [nodes, [], [{ id: "single" }]]) {
      const model = graphModel(input, []);
      const fit = fitGraph(model.nodes);
      expect(fit.width).toBeGreaterThan(0);
      expect(fit.height).toBeGreaterThan(0);
      for (const node of model.nodes) {
        expect(node.x - 15).toBeGreaterThanOrEqual(fit.x);
        expect(node.x + 15).toBeLessThanOrEqual(fit.x + fit.width);
        expect(node.y - 15).toBeGreaterThanOrEqual(fit.y);
        expect(node.y + 15).toBeLessThanOrEqual(fit.y + fit.height);
      }
    }
  });
  it("reports dangling edges and retains duplicate-ID node records", () => {
    const model = graphModel(
      [{ id: "same" }, { id: "same" }],
      [{ source: "same", target: "absent" }],
    );
    expect(model.nodes).toHaveLength(2);
    expect(new Set(model.nodes.map((n) => n.id)).size).toBe(2);
    expect(model.omittedEdges).toBe(1);
  });
  it("preserves the viewport center during zoom and bounds scale", () => {
    const fit = fitGraph(graphModel(nodes, edges).nodes);
    const panned = { ...fit, x: fit.x + 30, y: fit.y - 40 };
    const zoomed = zoomGraph(panned, 0.8, fit);
    expect(zoomed.x + zoomed.width / 2).toBeCloseTo(
      panned.x + panned.width / 2,
    );
    expect(zoomed.y + zoomed.height / 2).toBeCloseTo(
      panned.y + panned.height / 2,
    );
    expect(zoomGraph(fit, 0.0001, fit).width).toBe(fit.width / 4);
    expect(zoomGraph(fit, 1000, fit).width).toBe(fit.width * 2);
  });
  it("never lets synthetic IDs steal genuine edge endpoints", () => {
    const model = graphModel(
      [
        { id: "same", label: "Original" },
        { id: "same", label: "Duplicate" },
        { id: "same-1", label: "Real target" },
        { id: "node-1" },
        {},
      ],
      [
        { from: "same", to: "same-1" },
        { from: "same", to: "node-1" },
      ],
    );
    expect(model.byId.get("same-1")?.label).toBe("Real target");
    expect(model.nodes[1]?.id).not.toBe("node-1");
    expect(new Set(model.nodes.map((n) => n.id)).size).toBe(5);
    expect(model.links).toHaveLength(2);
  });
  it("uses a finite bounded-cost layout for large inputs without dropping nodes", () => {
    const input = Array.from({ length: 301 }, (_, i) => ({ id: String(i) }));
    const model = graphModel(input, []);
    expect(model.nodes).toHaveLength(301);
    expect(
      model.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)),
    ).toBe(true);
  });
  it("only exposes valid playback times", () => {
    expect(graphTime({ t_start: 0 })).toBe(0);
    expect(graphTime({ t_start: NaN, t: 12 })).toBe(12);
    expect(graphTime({ t_start: -1 })).toBeNull();
    expect(graphLabel({ text: "Full text" })).toBe("Full text");
  });
  it("sizes nodes by distinct neighbors, not duplicate links or self links", () => {
    const model = graphModel(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
        { from: "a", to: "a" },
      ],
    );
    expect(model.nodes.map((node) => node.degree)).toEqual([1, 1, 0]);
    expect(model.nodes.map((node) => node.radius)).toEqual([5.4, 5.4, 4]);
    expect(model.links).toHaveLength(3);
  });
  it("keeps the cursor anchor fixed during bounded zoom", () => {
    const fit = fitGraph(graphModel(nodes, edges).nodes);
    const anchor = { x: fit.x + fit.width * 0.2, y: fit.y + fit.height * 0.7 };
    for (const factor of [0.8, 1.25, 0.0001, 1000]) {
      const view = zoomGraph(fit, factor, fit, anchor);
      expect((anchor.x - view.x) / view.width).toBeCloseTo(0.2);
      expect((anchor.y - view.y) / view.height).toBeCloseTo(0.7);
    }
  });
});
