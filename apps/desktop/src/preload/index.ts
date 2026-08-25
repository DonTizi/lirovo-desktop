import { contextBridge, ipcRenderer, webUtils } from "electron";
import { CHANNELS } from "../main/ipc.js";
import type { ExtractRequest, RunDetail, RunSummary } from "../main/ipc.js";

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
  extract: (request: ExtractRequest): Promise<Result<unknown>> => ipcRenderer.invoke(CHANNELS.extract, request),
  cancel: (): Promise<Result<unknown>> => ipcRenderer.invoke(CHANNELS.cancel),
  pickFile: (): Promise<Result<string | null>> => ipcRenderer.invoke(CHANNELS.pickFile),

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
