import { z } from "zod";
import { pipelineEventSchema } from "@lirovo/contracts";
import type { ExtractRequest } from "../bridge/contract.js";

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
  schemaName: z.string().nullable().optional(),
  language: z.string().regex(/^(auto|[a-z]{2,3})$/).optional(),
  allowRemoteAsr: z.boolean().optional(),
});

export const reviewMutationSchema = z.object({
  runId: z.string().min(1),
  observationId: z.string().min(1),
  expectedRevision: z.number().int().nonnegative(),
  action: z.enum(["approve", "reject", "reopen", "correct"]),
  value: z.unknown().optional(),
  note: z.string().optional(),
});
export const reviewHistorySchema = z.object({runId: z.string().min(1), observationId: z.string().min(1)});
export const knowledgeQuerySchema = z.object({query: z.string(), runIds: z.array(z.string().min(1)).optional(), approvedOnly: z.boolean().optional()});
export const knowledgeComparisonSchema = z.object({runIds: z.array(z.string().min(1)).min(2).max(10), approvedOnly: z.boolean().optional()});
export const askKnowledgeSchema = z.object({question:z.string().trim().min(1),query:z.string().optional(),runIds:z.array(z.string().min(1)).optional(),approvedOnly:z.boolean().optional(),backendId:z.string().min(1),consent:z.literal(true),requestId:z.string().uuid()});
export const cancelKnowledgeSchema = z.object({requestId:z.string().uuid()});
export const exportRunSchema = z.object({runId:z.string().min(1),options:z.object({format:z.enum(["json","csv","markdown","folder"]),scope:z.enum(["all","approved"])})})
  .refine(request => request.options.format !== "folder" || request.options.scope === "all", "Complete folder exports include all stored data.");
/**
 * The validator and the contract must describe the same request.
 *
 * `ExtractRequest` is declared in the bridge so the preload can import it
 * without pulling zod in behind it. This assignment is the proof that the
 * schema above still matches it: add a field to one and not the other and
 * this line stops compiling.
 */
const _schemaMatchesContract: ExtractRequest = {} as z.infer<typeof extractRequestSchema>;
void _schemaMatchesContract;

export const runIdSchema = z.object({ runId: z.string().min(1) });
export const archiveRunSchema = z.object({runId:z.string().min(1),archived:z.boolean()});

/** Look at a source without ingesting it, so the field can say what it understood. */
export const inspectRequestSchema = z.object({ source: z.string().min(1) });

export const fieldSpecSchema = z.object({
  name: z.string(),
  kind: z.enum(["text", "list", "number", "date"]),
  description: z.string().optional(),
});

/**
 * Which of the things this app ships to install.
 *
 * An enum, not a string. This channel ends at a shell, and the difference
 * between `z.string().max(400)` and this list is the difference between a
 * length cap on arbitrary input and a closed vocabulary. `FIXES` in core holds
 * the commands; nothing here can name one that is not in it.
 */
export const runFixSchema = z.object({
  fixId: z.enum(["ffmpeg", "ffprobe", "yt-dlp", "whisper-cli", "local", "codex", "claude"]),
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
 * Which palette, or the machine's.
 *
 * An enum, so the value that reaches `nativeTheme.themeSource` is one of three
 * and not whatever the window sent.
 */
export const themeSchema = z.object({ theme: z.enum(["system", "light", "dark"]) });

/**
 * The renderer telling the main process whether a run is in flight.
 *
 * The main process cannot see the engine's state, and the one question it must
 * answer instantly — may I quit and install? — depends on it.
 */
export const busySchema = z.object({ busy: z.boolean() });

/** What a purge is allowed to remove. Named, never a free path. */
export const purgeSchema = z.object({ what: z.enum(["runs", "everything"]) });
export const revealSchema = z.object({ path: z.string().min(1) });



/** Which of the two fetchable dependencies to install. */
export const installSchema = z.object({
  what: z.enum(["whisper-model", "yt-dlp"]),
  /** Which speech model. Ignored for anything else. */
  model: z.string().optional(),
});

export const defaultBackendSchema = z.object({ backendId: z.string().min(1).nullable() });

/** What the engine process sends back. Same union the CLI renders. */
export { CHANNELS } from "./channels.js";

/**
 * Re-exported so main-side code has one import for the whole IPC surface. The
 * shapes themselves live in `../bridge/contract.js`, which the renderer and
 * the preload import directly rather than reaching in here.
 */
export type {
  ExtractRequest,
  InstallOutcome,
  Preferences,
  RunArtifacts,
  RunDetail,
  RunSummary,
  SourceInspection,
  StageAttempt,
  StorageReport,
  UpdateState,
  ValueRow,
} from "../bridge/contract.js";
