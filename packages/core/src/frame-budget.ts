import type { DedupFrameEntry } from "@lirovo/contracts";

/**
 * What one wave of vision sessions costs, measured IN THE PIPELINE.
 *
 * A stripped-down experiment — four sessions of twenty frames, minimal prompt —
 * finished in 64s, and that number is misleading. The real stage asks for scene
 * type, description, full OCR and salient objects, and the run that produced
 * this constant took 196.7s for six sessions at concurrency four: two waves,
 * about 98s each.
 *
 * A hundred is that measurement rounded up. Using the experiment's 65 would
 * make every budget under-estimate by half, which is precisely the failure a
 * budget exists to prevent — a promised ten minutes that quietly takes fifteen
 * is worse than an honest fifteen.
 */
export const SECONDS_PER_WAVE = 100;

export interface BudgetPlan {
  readonly frameBudget: number;
  readonly sessions: number;
  readonly waves: number;
  readonly estimatedSeconds: number;
}

/**
 * How many frames fit inside a wall-clock budget.
 *
 * Raising concurrency shortens the clock; raising the batch shortens it too but
 * costs more tokens per frame past twenty. So the batch stays where it is and
 * the budget is spent on waves.
 */
export const planForBudget = (budgetSeconds: number, batchSize: number, concurrency: number): BudgetPlan => {
  const waves = Math.max(1, Math.floor(budgetSeconds / SECONDS_PER_WAVE));
  const sessions = waves * concurrency;
  return {
    frameBudget: sessions * batchSize,
    sessions,
    waves,
    estimatedSeconds: waves * SECONDS_PER_WAVE,
  };
};

/**
 * Choose which frames to describe when there are more than the budget allows.
 *
 * Stratified by time, not by rank. Dividing the video into as many equal
 * stretches as there is budget and taking one frame from each guarantees the
 * last ten minutes of a two-hour recording get looked at — a purely
 * score-ranked selection can spend the entire budget on a busy opening and
 * describe nothing after the halfway mark, which is the failure that makes a
 * user distrust the whole result.
 *
 * Within a stretch the frame whose cluster is largest wins: a shot held on
 * screen longer is more likely to be the substance and less likely to be a
 * transition caught mid-fade.
 */
export const selectFrames = (
  kept: readonly DedupFrameEntry[],
  all: readonly DedupFrameEntry[],
  budget: number,
): readonly DedupFrameEntry[] => {
  if (kept.length <= budget || budget <= 0) return kept;

  const clusterSize = new Map<number, number>();
  for (const frame of all) clusterSize.set(frame.cluster_id, (clusterSize.get(frame.cluster_id) ?? 0) + 1);

  const sorted = [...kept].sort((a, b) => a.t_ms - b.t_ms);
  const span = (sorted.at(-1)?.t_ms ?? 0) - (sorted[0]?.t_ms ?? 0);
  if (span <= 0) return sorted.slice(0, budget);

  const start = sorted[0]?.t_ms ?? 0;
  const buckets = new Map<number, DedupFrameEntry>();

  for (const frame of sorted) {
    // The last frame must land in the final bucket, not one past it.
    const bucket = Math.min(budget - 1, Math.floor(((frame.t_ms - start) / span) * budget));
    const held = buckets.get(bucket);
    if (held === undefined || (clusterSize.get(frame.cluster_id) ?? 1) > (clusterSize.get(held.cluster_id) ?? 1)) {
      buckets.set(bucket, frame);
    }
  }

  return [...buckets.values()].sort((a, b) => a.t_ms - b.t_ms);
};
