import type { PipelineEvent } from "@lirovo/contracts";
import type { ExtractRequest } from "./ipc.js";
import type { z } from "zod";
import type { saveSchemaRequestSchema } from "./ipc.js";

/**
 * What crosses the wire between the main process and the engine process.
 *
 * One declaration, imported by both ends. It lived twice before — once as
 * `Outbound` in the engine and once as an inline cast in the supervisor — and
 * a third copy, a zod schema in `ipc.ts`, described a wire format
 * (`event | done | failed`) that neither end had spoken for a long time.
 * Nothing imported it, so nothing ever noticed. A protocol written down three
 * times is a protocol that drifts twice.
 *
 * These are types, not schemas. The engine is this app's own child process
 * launched from its own bundle, so its messages are not untrusted input, and
 * paying zod on every download-progress tick would buy nothing. What was
 * actually needed was for both ends to be unable to disagree.
 */

type SaveSchemaRequest = z.infer<typeof saveSchemaRequestSchema>;

/** A request from the main process. `id` is what the answer is matched on. */
export type EngineRequest =
  | { id: string; type: "extract"; request: ExtractRequest }
  | { id: string; type: "cancel" }
  | { id: string; type: "doctor" }
  | { id: string; type: "listRuns" }
  | { id: string; type: "runDetail"; runId: string }
  | { id: string; type: "inspect"; source: string }
  | { id: string; type: "listSchemas" }
  | { id: string; type: "saveSchema"; input: SaveSchemaRequest }
  | { id: string; type: "schemaRevisions"; schemaId: string }
  | { id: string; type: "archiveSchema"; schemaId: string }
  | { id: string; type: "runArtifacts"; runId: string }
  | { id: string; type: "install"; what: "whisper-model" | "yt-dlp"; model?: string }
  | { id: string; type: "storage" }
  | { id: string; type: "purge"; what: "runs" | "everything" }
  | { id: string; type: "preferences" }
  | { id: string; type: "setUpdateChannel"; channel: "latest" | "beta" }
  | { id: string; type: "setDefaultBackend"; backendId: string | null }
  | { id: string; type: "markOnboarded" };

/**
 * A message from the engine.
 *
 * `event` and `install-progress` are pushes and carry no `id`: nothing is
 * waiting on them, and the supervisor forwards them straight to the window.
 * `result` and `error` answer one request each.
 */
export type EngineMessage =
  | { kind: "event"; event: PipelineEvent }
  | { kind: "install-progress"; progress: { what: string; received: number; total: number | null } }
  | { kind: "result"; id: string; value: unknown }
  | { kind: "error"; id: string; error: { code: string; message: string } };
