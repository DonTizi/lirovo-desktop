import { z } from "zod";
import { pipelineEventSchema } from "@lirovo/contracts";

/**
 * Everything that crosses the bridge, validated on the way in.
 *
 * The renderer is a web page. It runs code we wrote, but it also runs whatever
 * a bug lets in, so a channel that trusts its arguments is a channel that
 * hands the filesystem to whoever finds the bug.
 */
export const extractRequestSchema = z.object({
  source: z.string().min(1),
  schemaJson: z.string().nullable(),
  backendId: z.string().nullable(),
});
export type ExtractRequest = z.infer<typeof extractRequestSchema>;

export const runIdSchema = z.object({ runId: z.string().min(1) });

/** Look at a source without ingesting it, so the field can say what it understood. */
export const inspectRequestSchema = z.object({ source: z.string().min(1) });

export interface SourceInspection {
  readonly kind: "url" | "file";
  /** youtube | vimeo | loom | url, or the file extension. */
  readonly label: string;
  readonly title: string | null;
  readonly durationS: number | null;
  readonly bytes: number | null;
  /** Why it cannot be used, if it cannot. */
  readonly problem: string | null;
}

/** What the engine process sends back. Same union the CLI renders. */
export const engineMessageSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("event"), event: pipelineEventSchema }),
  z.object({ kind: z.literal("done"), runId: z.string(), summary: z.unknown() }),
  z.object({
    kind: z.literal("failed"),
    runId: z.string(),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
]);
export type EngineMessage = z.infer<typeof engineMessageSchema>;

export const CHANNELS = {
  doctor: "lirovo:doctor",
  extract: "lirovo:extract",
  cancel: "lirovo:cancel",
  runDetail: "lirovo:run-detail",
  listRuns: "lirovo:list-runs",
  pickFile: "lirovo:pick-file",
  inspect: "lirovo:inspect",
  engineEvent: "lirovo:engine-event",
} as const;

/** One extracted value and the moments that prove it. */
export interface ValueRow {
  readonly observationId: string;
  readonly fieldPath: string;
  readonly value: string;
  readonly reviewPriority: number;
  readonly evidence: readonly {
    readonly sourceRef: string;
    readonly modality: string;
    readonly tStart: number;
    readonly tEnd: number;
    readonly quote: string | null;
  }[];
}

export interface RunDetail {
  readonly runId: string;
  readonly status: string;
  readonly title: string | null;
  readonly durationS: number | null;
  readonly sourcePath: string | null;
  readonly transcriptEngine: string | null;
  readonly values: readonly ValueRow[];
}

export interface RunSummary {
  readonly runId: string;
  readonly status: string;
  readonly title: string | null;
  readonly createdAt: number;
  readonly valueCount: number;
}
