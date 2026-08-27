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
  /** Which stored revision this run was asked with, when it came from one. */
  schemaRevisionId: z.string().nullable().optional(),
});
export type ExtractRequest = z.infer<typeof extractRequestSchema>;

export const runIdSchema = z.object({ runId: z.string().min(1) });

/** Look at a source without ingesting it, so the field can say what it understood. */
export const inspectRequestSchema = z.object({ source: z.string().min(1) });

export const fieldSpecSchema = z.object({
  name: z.string(),
  kind: z.enum(["text", "list", "number", "date"]),
  description: z.string().optional(),
});

export const saveSchemaRequestSchema = z.object({
  schemaId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(fieldSpecSchema),
});

export const schemaIdSchema = z.object({ schemaId: z.string().min(1) });

/** Null clears the choice and returns the app to picking the first available. */
export const updateChannelSchema = z.object({ channel: z.enum(["latest", "beta"]) });

/**
 * The renderer telling the main process whether a run is in flight.
 *
 * The main process cannot see the engine's state, and the one question it must
 * answer instantly — may I quit and install? — depends on it.
 */
export const busySchema = z.object({ busy: z.boolean() });

export interface UpdateState {
  readonly version: string;
  readonly channel: "latest" | "beta";
  /** Whether this copy can update at all: a dev run has no feed to ask. */
  readonly supported: boolean;
}

/** What a purge is allowed to remove. Named, never a free path. */
export const purgeSchema = z.object({ what: z.enum(["runs", "everything"]) });
export const revealSchema = z.object({ path: z.string().min(1) });

/** Defined where it is computed. Two copies of a shape are two shapes. */
export type { StorageReport } from "@lirovo/node-runtime";

/** Which of the two fetchable dependencies to install. */
export const installSchema = z.object({
  what: z.enum(["whisper-model", "yt-dlp"]),
  /** Which speech model. Ignored for anything else. */
  model: z.string().optional(),
});

export interface InstallOutcome {
  readonly what: string;
  readonly path: string;
  readonly bytes: number;
  readonly alreadyPresent: boolean;
}

export const defaultBackendSchema = z.object({ backendId: z.string().min(1).nullable() });

export interface Preferences {
  /** Which model runs the next extraction, when the user has said. */
  readonly defaultBackendId: string | null;
  /** Which speech model transcribes, when more than one is installed. */
  readonly whisperModelId: string | null;
  /** Stable or preview. Read before the window exists, so it lives here. */
  readonly updateChannel: "latest" | "beta";
}

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

export { CHANNELS } from "./channels.js";

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

/**
 * One recorded attempt at one stage.
 *
 * The row the database already kept and nobody could see. It is the whole
 * troubleshooting story: which stage, which try, how long, and the error the
 * failure actually carried rather than the one the UI guessed.
 */
export interface StageAttempt {
  readonly stage: string;
  readonly attempt: number;
  readonly status: string;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: number;
  readonly finishedAt: number | null;
}

export interface RunDetail {
  readonly runId: string;
  /** Derived, not stored: `stopped` when nobody is renewing the lease. */
  readonly status: string;
  readonly title: string | null;
  readonly durationS: number | null;
  readonly sourcePath: string | null;
  readonly transcriptEngine: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly stages: readonly StageAttempt[];
  readonly values: readonly ValueRow[];
}

/**
 * Everything a finished run left on disk, addressed for the renderer.
 *
 * Separate from RunDetail because it is bigger, read from files rather than
 * rows, and only wanted once a run is opened — a list of fifty runs must not
 * pay to parse fifty knowledge graphs.
 */
export interface RunArtifacts {
  /** `lirovo-media://` for the normalized stream; null when normalize never ran. */
  readonly videoUrl: string | null;
  readonly durationS: number | null;
  readonly transcript: {
    readonly engine: string | null;
    readonly model: string | null;
    /** The transcript's own measure of the audio, when the manifest has none. */
    readonly durationS: number | null;
    readonly text: string;
    readonly segments: readonly {
      readonly id: string;
      readonly speaker: string | null;
      readonly tStart: number;
      readonly tEnd: number;
      readonly text: string;
    }[];
  } | null;
  readonly frames: readonly {
    readonly idx: number;
    readonly tMs: number;
    readonly kept: boolean;
    readonly url: string;
  }[];
  readonly analyses: readonly {
    readonly frameIdx: number;
    readonly tMs: number;
    readonly sceneType: string;
    readonly describes: string;
    readonly ocrText: string | null;
    readonly salientObjects: readonly string[];
  }[];
  readonly graph: {
    readonly nodes: readonly Record<string, unknown>[];
    readonly edges: readonly Record<string, unknown>[];
  } | null;
}

export interface RunSummary {
  readonly runId: string;
  /** Derived, not stored: `stopped` when nobody is renewing the lease. */
  readonly status: string;
  readonly title: string | null;
  readonly createdAt: number;
  readonly valueCount: number;
  /** How many of those point at a moment. The number that decides trust. */
  readonly groundedCount: number;
  readonly durationS: number | null;
  readonly sourceType: string | null;
  readonly schemaName: string | null;
  /** Null when dedup never finished, which is not the same as zero frames. */
  readonly frameCount: number | null;
}
