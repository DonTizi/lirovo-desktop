/**
 * The error taxonomy. One code per distinguishable failure a caller can act on.
 *
 * Every surface (CLI exit codes, MCP tool errors, desktop IPC) branches on
 * `code`, never on message text.
 */
export const ERROR_CODES = [
  // source + media
  "SOURCE_NOT_FOUND",
  "SOURCE_UNSUPPORTED",
  "SOURCE_TOO_LONG",
  "SOURCE_TRUNCATED",
  "NOTHING_TO_EXTRACT",
  "DOWNLOAD_FAILED",
  "PROBE_FAILED",
  "NORMALIZE_FAILED",
  "SCENE_DETECT_FAILED",
  "DEDUP_FAILED",
  "FRAME_BUDGET_EXCEEDED",
  // transcription
  "TRANSCRIBE_FAILED",
  "NO_ASR_BACKEND",
  // inference
  "NO_INFERENCE_BACKEND",
  "INFERENCE_FAILED",
  "INFERENCE_TRUNCATED",
  "INFERENCE_QUOTA_EXCEEDED",
  "INFERENCE_AUTH_FAILED",
  "SCHEMA_VALIDATION_FAILED",
  // harness-specific
  "HARNESS_NOT_FOUND",
  "HARNESS_UNSUPPORTED_CAPABILITY",
  "HARNESS_ISOLATION_UNAVAILABLE",
  // store
  "MIGRATION_FAILED",
  "RUN_ALREADY_CLAIMED",
  "LEASE_LOST",
  "STORE_BUSY",
  "ARTIFACT_MISSING",
  "ARTIFACT_CHECKSUM_MISMATCH",
  // dependencies
  "DEPENDENCY_MISSING",
  "MODEL_MISSING",
  "MODEL_CHECKSUM_MISMATCH",
  // control
  "CANCELLED",
  "TIMED_OUT",
  "DISK_FULL",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface LirovoErrorContext {
  readonly stage?: string;
  readonly runId?: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export class LirovoError extends Error {
  readonly code: ErrorCode;
  readonly context: LirovoErrorContext;

  constructor(code: ErrorCode, message: string, context: LirovoErrorContext = {}) {
    super(message);
    this.name = "LirovoError";
    this.code = code;
    this.context = context;
  }

  /** Serializable form, for IPC and for `--json` output. */
  toJSON(): { code: ErrorCode; message: string; context: LirovoErrorContext } {
    return { code: this.code, message: this.message, context: this.context };
  }
}

export const isLirovoError = (err: unknown): err is LirovoError =>
  err instanceof LirovoError;

/** Narrow an unknown throw into a LirovoError without losing the original text. */
export const asLirovoError = (
  err: unknown,
  fallback: ErrorCode = "INTERNAL",
  context: LirovoErrorContext = {},
): LirovoError => {
  if (isLirovoError(err)) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new LirovoError(fallback, message, context);
};

/**
 * Result, not exceptions, at every process and IPC boundary. Nothing throws
 * across the Electron bridge or out of a CLI command handler.
 */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { code: ErrorCode; message: string; context: LirovoErrorContext } };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = (error: LirovoError): Result<never> => ({ ok: false, error: error.toJSON() });
