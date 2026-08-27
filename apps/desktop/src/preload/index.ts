import { contextBridge, ipcRenderer, webUtils } from "electron";
import { CHANNELS } from "../main/ipc.js";
import type {
  ExtractRequest,
  Preferences,
  RunArtifacts,
  RunDetail,
  RunSummary,
  SourceInspection,
} from "../main/ipc.js";
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

  preferences: (): Promise<Result<Preferences>> => ipcRenderer.invoke(CHANNELS.preferences),
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
