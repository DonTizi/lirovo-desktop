import { z } from "zod";

/**
 * The pipeline stages, in order.
 *
 * `asr` and `vision` run concurrently after `dedup`; every other edge is
 * sequential. The order here is the order a progress UI renders, which is why
 * it is a single ordered tuple rather than a set.
 */
export const STAGES = [
  "ingest",
  "normalize",
  "scene-detect",
  "dedup",
  "asr",
  "vision",
  "graph",
  "reason",
] as const;

export type Stage = (typeof STAGES)[number];
export const stageSchema = z.enum(STAGES);

/** Stages that produce identical bytes for identical input. Only these can be golden-diffed. */
export const DETERMINISTIC_STAGES: ReadonlySet<Stage> = new Set<Stage>([
  "ingest",
  "normalize",
  "scene-detect",
  "dedup",
]);

/** Stages whose failure degrades the run instead of failing it. */
export const OPTIONAL_STAGES: ReadonlySet<Stage> = new Set<Stage>(["vision"]);

export const stageIndex = (stage: Stage): number => STAGES.indexOf(stage);

/**
 * Merge a stage into a monotonic pointer.
 *
 * `asr` and `vision` interleave, so a naive "latest stage wins" pointer moves
 * backwards on screen. A progress pointer must never regress: users read a
 * backwards step as a failure.
 */
export const mergeStagePointer = (current: Stage | null, next: Stage): Stage =>
  current === null || stageIndex(next) > stageIndex(current) ? next : current;
