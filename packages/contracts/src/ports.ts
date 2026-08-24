import type { AbortSignalLike } from "./cancel.js";
import type { Modality } from "./domain.js";

/** Injected so contracts and core stay free of platform APIs and stay testable. */
export interface Clock {
  now(): number;
}
export interface Random {
  bytes(n: number): Uint8Array;
}
export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export interface ExecResult {
  readonly stdout: string;
  readonly stderr: string;
}
export interface ExecOptions {
  readonly cwd?: string;
  /** Env is REPLACED, never merged, so a harness cannot inherit ambient credentials. */
  readonly env?: Readonly<Record<string, string>>;
  readonly stdin?: string;
  readonly signal?: AbortSignalLike;
  readonly timeoutMs?: number;
}
export type Exec = (bin: string, args: readonly string[], opts?: ExecOptions) => Promise<ExecResult>;

/**
 * Content-addressed artifact storage.
 *
 * Writes are atomic (temp file + rename) and checksummed, because a run that
 * resumes must be able to trust what an earlier attempt left on disk.
 */
export interface ArtifactStore {
  /** Absolute path for a run-relative key, for handing to ffmpeg and friends. */
  resolve(runId: string, relPath: string): string;
  put(runId: string, relPath: string, body: Uint8Array | string): Promise<{ sha256: string; bytes: number }>;
  putFile(runId: string, relPath: string, absSourcePath: string): Promise<{ sha256: string; bytes: number }>;
  get(runId: string, relPath: string): Promise<Uint8Array | null>;
  getText(runId: string, relPath: string): Promise<string | null>;
  exists(runId: string, relPath: string): Promise<boolean>;
  /** Verify a stored artifact still matches its recorded digest. */
  verify(runId: string, relPath: string, sha256: string): Promise<boolean>;
  remove(runId: string): Promise<{ freedBytes: number }>;
}

export type MessageRole = "system" | "user" | "assistant";
export interface Message {
  readonly role: MessageRole;
  readonly content: string;
}
export interface ImageRef {
  readonly mime: string;
  readonly bytes: Uint8Array;
  readonly label: string;
}

/**
 * A file staged into the backend's working directory for it to read.
 *
 * This is how an agent CLI does vision. It has no way to accept image bytes on
 * stdin, but it reads files, and a measured session handles dozens of frames
 * at a fraction of the per-call cost of sending them one batch at a time.
 */
export interface FileRef {
  /** Name inside the backend's sandbox. Never a path the caller controls. */
  readonly name: string;
  readonly path: string;
}

/**
 * One inference call.
 *
 * `messages` rather than `system` + `prompt` because the repair turn is a real
 * conversation: the first (invalid) answer goes back as an assistant message
 * and the validation errors follow as a user message.
 */
export interface CompletionRequest {
  readonly messages: readonly Message[];
  readonly schema?: Readonly<Record<string, unknown>>;
  readonly images?: readonly ImageRef[];
  /** Only backends whose `images` capability is "files" can use these. */
  readonly files?: readonly FileRef[];
  readonly maxTokens?: number;
  readonly temperature?: number;
  /** Mandatory: every call must be cancellable from a stop button or Ctrl-C. */
  readonly signal: AbortSignalLike;
}

export interface CompletionResult {
  readonly text: string;
  readonly json?: unknown;
  readonly model: string;
  readonly backendVersion: string;
  readonly elapsedMs: number;
  /**
   * A truncated answer often arrives wearing a success status. Detecting it and
   * refusing to treat it as an extraction is the difference between a loud
   * failure and silently persisting half a result.
   */
  readonly truncated: boolean;
  readonly usage?: { readonly inputTokens?: number; readonly outputTokens?: number };
}

export interface BackendCapabilities {
  /** Constrains output to a JSON Schema without a repair round-trip. */
  readonly nativeJsonSchema: boolean;
  /**
   * How this backend takes images.
   *
   * "inline" — bytes in the request, one call per batch.
   * "files"  — staged on disk and read by the agent inside one session, which
   *            amortises the session's fixed cost across every frame in it.
   * "none"   — cannot see images at all.
   */
  readonly images: "inline" | "files" | "none";
  /** Per-call process spawn. True means "cheap for 2 calls, ruinous for 70". */
  readonly spawnsProcessPerCall: boolean;
}

export interface InferenceBackend {
  readonly id: string;
  readonly capabilities: BackendCapabilities;
  /** Probed, never hardcoded: external CLI flags change between releases. */
  detect(): Promise<{ available: boolean; version: string | null; reason?: string }>;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export interface TranscriptWord {
  readonly w: string;
  readonly tStart: number;
  readonly tEnd: number;
}
export interface TranscriptSegment {
  readonly id: string;
  readonly speaker: string | null;
  readonly tStart: number;
  readonly tEnd: number;
  readonly text: string;
  readonly words: readonly TranscriptWord[];
}
export interface Transcript {
  readonly engine: string;
  readonly model: string | null;
  readonly language: string | null;
  readonly durationS: number;
  readonly text: string;
  readonly segments: readonly TranscriptSegment[];
}

export interface AsrRequest {
  readonly runId: string;
  readonly sourceKind: "url" | "file";
  readonly sourceUri: string;
  readonly audioPath: string;
  readonly language?: string;
  readonly signal: AbortSignalLike;
}

/**
 * A chain of responsibility, not one provider.
 *
 * Native subtitles first: on a captioned talk the transcript is free and
 * instant. Local whisper second. A paid API only if the user opts in.
 */
export interface AsrStrategy {
  readonly name: string;
  isAvailable(req: AsrRequest): Promise<boolean>;
  transcribe(req: AsrRequest): Promise<Transcript>;
}

export interface FrameAnalysis {
  readonly frameIdx: number;
  readonly tMs: number;
  readonly sceneType: string;
  readonly describes: string;
  readonly ocrText: string | null;
  readonly salientObjects: readonly string[];
}

export interface EvidenceDraft {
  readonly modality: Modality;
  readonly sourceRef: string;
  readonly tStart: number;
  readonly tEnd: number;
  readonly quote: string | null;
  readonly nodeKey: string | null;
}
