/**
 * The contract between the window and the process behind it.
 *
 * These shapes were declared inside `main/`, which meant eight renderer files
 * and the preload all reached across into the main process's directory to
 * learn what a run looks like. The dependency ran the wrong way: the renderer
 * does not depend on the main process, it depends on the BRIDGE, and the
 * bridge had no home of its own.
 *
 * Types only, and no runtime import — not even zod. The preload is bundled
 * separately and one value import from a zod-carrying module put 122 KB of
 * schema parser into it once already.
 */

/**
 * What a run is asked for.
 *
 * Declared here rather than inferred from the zod schema that guards it, so
 * that this module needs no runtime import. `main/ipc.ts` asserts the two
 * agree, and tsc fails there if they ever stop agreeing.
 */
export interface ExtractRequest {
  readonly source: string;
  readonly schemaJson: string | null;
  readonly backendId: string | null;
  /**
   * Which stored revision this run was asked with, when it came from one.
   *
   * `undefined` is spelled out because the project runs with
   * `exactOptionalPropertyTypes`, under which an optional zod field is not the
   * same type as an optional property. The assertion in `main/ipc.ts` caught
   * that the first time it ran.
   */
  readonly schemaRevisionId?: string | null | undefined;
}

/**
 * Passed through from where it is computed. Two copies of a shape are two
 * shapes; a type-only re-export is neither a runtime dependency nor a second
 * definition to keep in step.
 */
export type { StorageReport } from "@lirovo/node-runtime";

export interface UpdateState {
  readonly version: string;
  readonly channel: "latest" | "beta";
  /** Whether this copy can update at all: a dev run has no feed to ask. */
  readonly supported: boolean;
}

export interface InstallOutcome {
  readonly what: string;
  readonly path: string;
  readonly bytes: number;
  readonly alreadyPresent: boolean;
}

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
