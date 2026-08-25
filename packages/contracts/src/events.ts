import { z } from "zod";
import { stageSchema } from "./stages.js";

/**
 * Progress events.
 *
 * The zod schema is the source of truth and the TS type is inferred from it, so
 * an event that a producer emits and a consumer cannot parse is a test failure
 * rather than a runtime surprise. Validated at the IPC boundary for free.
 */
export const pipelineEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run:start"), runId: z.string(), at: z.number() }),
  z.object({ type: z.literal("stage:start"), runId: z.string(), stage: stageSchema, attempt: z.number().int().min(1) }),
  z.object({ type: z.literal("stage:resumed"), runId: z.string(), stage: stageSchema }),
  // A stage that will never run for THIS source — no frames to dedup, no
  // backend to see them. Distinct from "waiting", which a user reads as
  // "still to come" and which never resolves.
  z.object({ type: z.literal("stage:skipped"), runId: z.string(), stage: stageSchema, why: z.string() }),
  z.object({
    type: z.literal("stage:progress"),
    runId: z.string(),
    stage: stageSchema,
    done: z.number().int().min(0),
    total: z.number().int().min(0),
    note: z.string().optional(),
  }),
  z.object({ type: z.literal("stage:done"), runId: z.string(), stage: stageSchema, ms: z.number().min(0) }),
  z.object({
    type: z.literal("stage:degraded"),
    runId: z.string(),
    stage: stageSchema,
    code: z.string(),
    message: z.string(),
  }),
  z.object({ type: z.literal("run:done"), runId: z.string(), ms: z.number().min(0) }),
  z.object({
    type: z.literal("run:failed"),
    runId: z.string(),
    stage: stageSchema.nullable(),
    code: z.string(),
    message: z.string(),
  }),
  z.object({ type: z.literal("run:cancelled"), runId: z.string(), stage: stageSchema.nullable() }),
]);

export type PipelineEvent = z.infer<typeof pipelineEventSchema>;

/**
 * A plain callback, not an event bus.
 *
 * One consumer per run is the real shape: the CLI renders it, or the engine
 * host forwards it over IPC. A host that needs fan-out wraps this once.
 */
export type PipelineEventListener = (event: PipelineEvent) => void;
