import { contextBridge, ipcRenderer, webUtils } from "electron";
import { CHANNELS } from "../main/channels.js";
import type { InstallOutcome, Preferences, RunArtifacts, RunDetail, RunSummary, SourceInspection, UpdateState } from "../bridge/contract.js";
import type { ExtractRequest, FixResult, StorageReport } from "../bridge/contract.js";
import type { FieldSpec } from "@lirovo/core";
import type { SchemaRevision, SchemaSummary } from "@lirovo/node-runtime";

/**
 * Nothing throws across the bridge.
 *
 * Every call answers with a discriminated result, so a caller in the renderer
 * handles the failure where it happens instead of relying on a try/catch
 * someone remembered to write.
 */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

const api = {
  backupLibrary: ():Promise<Result<{cancelled:boolean;transfer?:import("../bridge/contract.js").LibraryTransferResult}>>=>ipcRenderer.invoke(CHANNELS.backupLibrary),
  restoreLibrary: ():Promise<Result<{cancelled:boolean;transfer?:import("../bridge/contract.js").LibraryTransferResult}>>=>ipcRenderer.invoke(CHANNELS.restoreLibrary),
  archiveRun: (runId:string,archived:boolean):Promise<Result<{saved:boolean}>>=>ipcRenderer.invoke(CHANNELS.archiveRun,{runId,archived}),
  archivedRuns: ():Promise<Result<import("../bridge/contract.js").ArchivedRun[]>>=>ipcRenderer.invoke(CHANNELS.archivedRuns),
  askKnowledge: (input:import("../bridge/contract.js").AskKnowledgeRequest):Promise<Result<import("../bridge/contract.js").KnowledgeAnswer>>=>ipcRenderer.invoke(CHANNELS.askKnowledge,input),
  cancelKnowledge: (input:{requestId:string}):Promise<Result<{cancelled:boolean}>>=>ipcRenderer.invoke(CHANNELS.cancelKnowledge,input),
  exportRun: (runId:string,options:import("../bridge/contract.js").ExportOptions):Promise<Result<import("../bridge/contract.js").ExportOutcome>>=>ipcRenderer.invoke(CHANNELS.exportRun,{runId,options}),
  searchKnowledge: (input: import("../bridge/contract.js").KnowledgeQuery): Promise<Result<import("../bridge/contract.js").KnowledgeResult>> => ipcRenderer.invoke(CHANNELS.searchKnowledge, input),
  compareKnowledge: (runIds: string[], approvedOnly = false): Promise<Result<import("../bridge/contract.js").KnowledgeComparison>> => ipcRenderer.invoke(CHANNELS.compareKnowledge, {runIds, approvedOnly}),
  listQueue: (): Promise<Result<import("../bridge/contract.js").QueueItem[]>> => ipcRenderer.invoke(CHANNELS.listQueue),
  resumeRun: (runId: string): Promise<Result<{runId: string}>> => ipcRenderer.invoke(CHANNELS.resumeRun, {runId}),
  cancelQueuedRun: (runId: string): Promise<Result<{cancelled: boolean}>> => ipcRenderer.invoke(CHANNELS.cancelQueuedRun, {runId}),
  reviewValue: (input: import("../bridge/contract.js").ReviewMutation): Promise<Result<import("../bridge/contract.js").ReviewSnapshot>> => ipcRenderer.invoke(CHANNELS.reviewValue, input),
  reviewHistory: (runId: string, observationId: string): Promise<Result<import("../bridge/contract.js").ReviewHistoryEntry[]>> => ipcRenderer.invoke(CHANNELS.reviewHistory, {runId, observationId}),
  doctor: (): Promise<Result<unknown>> => ipcRenderer.invoke(CHANNELS.doctor),
  listRuns: (): Promise<Result<RunSummary[]>> => ipcRenderer.invoke(CHANNELS.listRuns),
  runDetail: (runId: string): Promise<Result<RunDetail | null>> => ipcRenderer.invoke(CHANNELS.runDetail, { runId }),
  runArtifacts: (runId: string): Promise<Result<RunArtifacts>> =>
    ipcRenderer.invoke(CHANNELS.runArtifacts, { runId }),
  extract: (request: ExtractRequest): Promise<Result<unknown>> => ipcRenderer.invoke(CHANNELS.extract, request),
  cancel: (): Promise<Result<unknown>> => ipcRenderer.invoke(CHANNELS.cancel),
  inspect: (source: string): Promise<Result<SourceInspection>> => ipcRenderer.invoke(CHANNELS.inspect, { source }),

  listSchemas: (): Promise<Result<SchemaSummary[]>> => ipcRenderer.invoke(CHANNELS.listSchemas),
  saveSchema: (input: {
    schemaId?: string;
    name: string;
    description?: string;
    fields: readonly FieldSpec[];
  }): Promise<Result<SchemaRevision>> => ipcRenderer.invoke(CHANNELS.saveSchema, input),
  schemaRevisions: (schemaId: string): Promise<Result<SchemaRevision[]>> =>
    ipcRenderer.invoke(CHANNELS.schemaRevisions, { schemaId }),
  archiveSchema: (schemaId: string): Promise<Result<unknown>> =>
    ipcRenderer.invoke(CHANNELS.archiveSchema, { schemaId }),
  pickFile: (): Promise<Result<string | null>> => ipcRenderer.invoke(CHANNELS.pickFile),

  /** Fetch a dependency this app can install itself. Verified before it lands. */
  install: (what: "whisper-model" | "yt-dlp", model?: string): Promise<Result<InstallOutcome>> =>
    ipcRenderer.invoke(CHANNELS.install, { what, ...(model === undefined ? {} : { model }) }),

  /** Bytes as they arrive, so a 60MB model is not a frozen button. */
  onInstallProgress: (callback: (p: { what: string; received: number; total: number | null }) => void): (() => void) => {
    const listener = (_e: unknown, payload: unknown): void =>
      callback(payload as { what: string; received: number; total: number | null });
    ipcRenderer.on(CHANNELS.installProgress, listener);
    return () => {
      ipcRenderer.removeListener(CHANNELS.installProgress, listener);
    };
  },

  storage: (): Promise<Result<StorageReport>> => ipcRenderer.invoke(CHANNELS.storage),
  /** Answers `cancelled` when the user declined the system's confirmation. */
  purge: (what: "runs" | "everything"): Promise<Result<{ cancelled: boolean; freedBytes: number }>> =>
    ipcRenderer.invoke(CHANNELS.purge, { what }),
  reveal: (path: string): Promise<Result<{ revealed: boolean }>> => ipcRenderer.invoke(CHANNELS.reveal, { path }),

  updateState: (): Promise<Result<UpdateState>> => ipcRenderer.invoke(CHANNELS.updateState),
  updateCheck: (): Promise<Result<unknown>> => ipcRenderer.invoke(CHANNELS.updateCheck),
  updateDownload: (): Promise<Result<unknown>> => ipcRenderer.invoke(CHANNELS.updateDownload),
  /** Answers `installed: false` with a reason when a run is in flight. */
  updateInstall: (): Promise<Result<{ installed: boolean; why: string | null }>> =>
    ipcRenderer.invoke(CHANNELS.updateInstall),
  updateChannel: (channel: "latest" | "beta"): Promise<Result<UpdateState>> =>
    ipcRenderer.invoke(CHANNELS.updateChannel, { channel }),

  /** Whether a run is in flight, so the main process can refuse to restart. */
  busy: (busy: boolean): Promise<Result<{ busy: boolean }>> => ipcRenderer.invoke(CHANNELS.busy, { busy }),

  onUpdateEvent: (callback: (event: unknown) => void): (() => void) => {
    const listener = (_e: unknown, payload: unknown): void => callback(payload);
    ipcRenderer.on(CHANNELS.updateEvent, listener);
    return () => {
      ipcRenderer.removeListener(CHANNELS.updateEvent, listener);
    };
  },

  preferences: (): Promise<Result<Preferences>> => ipcRenderer.invoke(CHANNELS.preferences),
  markOnboarded: (): Promise<Result<Preferences>> => ipcRenderer.invoke(CHANNELS.markOnboarded),
  /** By id. The command lives in the main process and never crosses this bridge. */
  runFix: (fixId: string): Promise<Result<FixResult>> => ipcRenderer.invoke(CHANNELS.runFix, { fixId }),
  setTheme: (theme: "system" | "light" | "dark"): Promise<Result<Preferences>> =>
    ipcRenderer.invoke(CHANNELS.setTheme, { theme }),
  setDefaultBackend: (backendId: string | null): Promise<Result<Preferences>> =>
    ipcRenderer.invoke(CHANNELS.setDefaultBackend, { backendId }),

  /**
   * A dropped file gives the renderer a File object with no path. This is the
   * only place the real one is knowable, and it is the difference between
   * ffmpeg reading the video and ffmpeg reading nothing.
   */
  pathForFile: (file: File): string => webUtils.getPathForFile(file),

  /**
   * Returns its own unsubscribe rather than exposing removeListener, so one
   * component cannot detach another's handler.
   */
  onEngineEvent: (callback: (event: unknown) => void): (() => void) => {
    const listener = (_e: unknown, payload: unknown): void => callback(payload);
    ipcRenderer.on(CHANNELS.engineEvent, listener);
    return () => {
      ipcRenderer.removeListener(CHANNELS.engineEvent, listener);
    };
  },
};

export type LirovoApi = typeof api;

contextBridge.exposeInMainWorld("lirovo", api);
