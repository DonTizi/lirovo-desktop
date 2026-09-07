import { describe, expect, it } from "vitest";
import { graphModel } from "./graph-model";
import {
  graphCanvasLabels,
  graphConnectionCurve,
  graphHasPulse,
  graphDotRadius,
  graphFamily,
  graphPositions,
  graphTopics,
} from "./graph-presentation";

const model = graphModel(
  [
    {
      id: "topic",
      type: "topic",
      label: "Token efficiency vs cost efficiency",
    },
    {
      id: "claim",
      type: "claim",
      label: "The full claim, including all its source wording.",
      t: 0,
    },
    { id: "other", type: "metric", label: "62.7%" },
  ],
  [{ from: "topic", to: "claim", type: "about" }],
);

describe("guided graph presentation", () => {
  it("keeps curved links anchored and finite, including coincident endpoints", () => {
    const a = { x: 0, y: 0 },
      b = { x: 100, y: 0 };
    const curve = graphConnectionCurve(a, b, 0);
    expect(curve.path).toBe("M 0 0 Q 50 -12 100 0");
    expect(curve.point(0)).toEqual(a);
    expect(curve.point(1)).toEqual(b);
    expect(curve.point(0.5)).toEqual({ x: 50, y: -6 });
    expect(graphConnectionCurve(a, b, 1).point(0.5)).toEqual({ x: 50, y: 6 });
    expect(graphConnectionCurve(a, a, 0).point(0.5)).toEqual(a);
    expect(a).toEqual({ x: 0, y: 0 });
  });
  it("caps decorative pulse density independently of graph size", () => {
    for (const total of [0, 1, 12, 13, 66, 149, 1000]) {
      const count = Array.from({ length: total }, (_, i) => i).filter((i) =>
        graphHasPulse(i, total),
      ).length;
      expect(count).toBeLessThanOrEqual(12);
      expect(count).toBeLessThanOrEqual(total);
    }
    expect(graphHasPulse(0, 0)).toBe(false);
  });
  it("indexes actual topics and searches all complete node labels without filtering the graph", () => {
    expect(graphTopics(model.nodes, "").map((n) => n.id)).toEqual(["topic"]);
    expect(graphTopics(model.nodes, " FULL CLAIM ").map((n) => n.id)).toEqual([
      "claim",
    ]);
    expect(graphTopics(model.nodes, "missing")).toEqual([]);
    expect(model.nodes).toHaveLength(3);
    expect(
      graphTopics(
        model.nodes.filter((n) => n.type !== "topic"),
        "",
      ),
    ).toHaveLength(2);
  });
  it("animates every unpinned node while retaining complete records and source coordinates", () => {
    const before = JSON.stringify(model.nodes);
    const a = graphPositions(model.nodes, 1000, new Map());
    const b = graphPositions(model.nodes, 2000, new Map());
    expect(a.every((node, i) => node.x !== b[i]!.x || node.y !== b[i]!.y)).toBe(
      true,
    );
    expect(a.map((n) => n.label)).toEqual(model.nodes.map((n) => n.label));
    expect(JSON.stringify(model.nodes)).toBe(before);
  });
  it("pins dragged nodes exactly, independently of clock or other nodes", () => {
    for (const elapsed of [0, 1000, 2000, 100000]) {
      expect(
        graphPositions(
          model.nodes,
          elapsed,
          new Map([["topic", { x: 40, y: 50 }]]),
        )[0],
      ).toMatchObject({ id: "topic", x: 40, y: 50 });
    }
  });
  it("bounds settled drift to three units and is deterministic while paused", () => {
    const a = graphPositions(model.nodes, 20000, new Map());
    expect(graphPositions(model.nodes, 20000, new Map())).toEqual(a);
    a.forEach((node, i) => {
      expect(Math.abs(node.x - model.nodes[i]!.x)).toBeLessThanOrEqual(3.01);
      expect(Math.abs(node.y - model.nodes[i]!.y)).toBeLessThanOrEqual(3.01);
    });
  });
  it("keeps visual dots small and uses muted semantic families", () => {
    expect(graphDotRadius({ ...model.nodes[0]!, degree: 9999 })).toBe(6.5);
    expect(graphDotRadius({ ...model.nodes[0]!, degree: 0 })).toBe(3);
    expect(graphFamily("topic")).toBe("context");
    expect(graphFamily("metric")).toBe("measure");
    expect(graphFamily("speaker")).toBe("actor");
    expect(graphFamily("unknown")).toBe("claim");
  });
  it("places whole labels within the viewport, clear of nodes and other labels", () => {
    const input = model.nodes.map((node, i) => ({ ...node, x: i * 180, y: 0 }));
    const view = { x: -200, y: -200, width: 900, height: 400 };
    const labels = graphCanvasLabels(input, "claim", 1, view);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0]!.id).toBe("claim");
    labels.forEach((label) => {
      expect(label.lines.join(" ")).toBe(
        input.find((n) => n.id === label.id)!.label,
      );
      expect(label.x).toBeGreaterThanOrEqual(view.x);
      expect(label.y).toBeGreaterThanOrEqual(view.y);
      expect(label.x + label.width).toBeLessThanOrEqual(view.x + view.width);
      expect(label.y + label.height).toBeLessThanOrEqual(view.y + view.height);
      for (const node of input)
        expect(
          node.x + 9 > label.x &&
            node.x - 9 < label.x + label.width &&
            node.y + 9 > label.y &&
            node.y - 9 < label.y + label.height,
        ).toBe(false);
      for (const other of labels)
        if (other !== label)
          expect(
            label.x < other.x + other.width &&
              label.x + label.width > other.x &&
              label.y < other.y + other.height &&
              label.y + label.height > other.y,
          ).toBe(false);
    });
  });
});
