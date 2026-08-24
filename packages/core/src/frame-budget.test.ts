import { describe, expect, it } from "vitest";
import type { DedupFrameEntry } from "@lirovo/contracts";
import { planForBudget, selectFrames, SECONDS_PER_WAVE } from "./frame-budget.js";

const f = (idx: number, tMs: number, cluster = idx, kept = true): DedupFrameEntry => ({
  idx,
  t_ms: tMs,
  kept,
  cluster_id: cluster,
  phash: "0".repeat(16),
});

describe("planForBudget", () => {
  it("turns ten minutes into a frame budget", () => {
    const plan = planForBudget(600, 20, 4);
    expect(plan.waves).toBe(6);
    expect(plan.sessions).toBe(24);
    expect(plan.frameBudget).toBe(480);
    expect(plan.estimatedSeconds).toBeLessThanOrEqual(600);
  });

  it("never estimates over a budget that fits at least one wave", () => {
    for (const seconds of [200, 600, 1200, 3600]) {
      expect(planForBudget(seconds, 20, 4).estimatedSeconds).toBeLessThanOrEqual(seconds);
    }
  });

  it("overruns a budget smaller than one wave, on purpose", () => {
    // Describing nothing is worse than overrunning by a few seconds, so the
    // floor of one wave wins. The contract is "no more than the budget once
    // the budget fits a wave at all".
    const plan = planForBudget(70, 20, 4);
    expect(plan.waves).toBe(1);
    expect(plan.estimatedSeconds).toBeGreaterThan(70);
  });

  it("still allows one wave when the budget is under a wave", () => {
    // Refusing to look at anything is worse than overrunning a tight budget.
    const plan = planForBudget(10, 20, 4);
    expect(plan.waves).toBe(1);
    expect(plan.frameBudget).toBe(80);
  });

  it("scales with concurrency, which is the lever that is free", () => {
    expect(planForBudget(600, 20, 8).frameBudget).toBe(planForBudget(600, 20, 4).frameBudget * 2);
  });

  it("prices a wave at what the pipeline measured, not what an experiment suggested", () => {
    // 196.7s for two waves in a real run. A stripped-down probe said 64s; using
    // that would make every budget under-estimate by half.
    expect(SECONDS_PER_WAVE).toBe(100);
  });
});

describe("selectFrames", () => {
  const hour = Array.from({ length: 600 }, (_, i) => f(i, i * 6000));

  it("keeps everything when it already fits", () => {
    expect(selectFrames(hour.slice(0, 10), hour, 20)).toHaveLength(10);
  });

  it("covers the whole video, not just the beginning", () => {
    // A score-ranked selection can spend the budget on a busy opening and
    // describe nothing after halfway. That is the failure this prevents.
    const chosen = selectFrames(hour, hour, 30);
    const last = chosen.at(-1)?.t_ms ?? 0;
    const first = chosen[0]?.t_ms ?? 0;
    expect(first).toBeLessThan(60_000);
    expect(last).toBeGreaterThan(3_400_000);
    expect(chosen.length).toBeLessThanOrEqual(30);
  });

  it("spreads roughly evenly through the video", () => {
    const chosen = selectFrames(hour, hour, 20);
    const gaps = chosen.slice(1).map((c, i) => c.t_ms - (chosen[i]?.t_ms ?? 0));
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    // No gap should be wildly larger than the average stride.
    expect(Math.max(...gaps)).toBeLessThan(mean * 2.5);
  });

  it("prefers the frame whose shot was held longest inside a stretch", () => {
    const all = [
      f(0, 0, 100),
      f(1, 1000, 200),
      // cluster 200 appears three times, so frame 1 represents a held shot
      f(2, 1100, 200, false),
      f(3, 1200, 200, false),
      f(4, 10_000, 300),
    ];
    const kept = all.filter((a) => a.kept);
    const chosen = selectFrames(kept, all, 2);
    expect(chosen.map((c) => c.idx)).toContain(1);
  });

  it("returns frames in time order", () => {
    const chosen = selectFrames(hour, hour, 25);
    expect([...chosen].sort((a, b) => a.t_ms - b.t_ms)).toEqual(chosen);
  });

  it("handles every frame sharing one instant", () => {
    const same = [f(0, 5000), f(1, 5000), f(2, 5000)];
    expect(selectFrames(same, same, 2)).toHaveLength(2);
  });
});
