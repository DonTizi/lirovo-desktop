import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, app, dialog, ipcMain, shell, utilityProcess, type UtilityProcess } from "electron";
import {
  CHANNELS,
  defaultBackendSchema,
  extractRequestSchema,
  inspectRequestSchema,
  runIdSchema,
  saveSchemaRequestSchema,
  schemaIdSchema,
} from "./ipc.js";

import { installMediaProtocol, registerMediaScheme } from "./media-protocol.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// Before `whenReady`, which is the only moment a privileged scheme may be
// declared. Everything else about the protocol is set up after.
registerMediaScheme();
const DEV_URL = process.env["VITE_DEV_SERVER_URL"];

let window: BrowserWindow | null = null;
let engine: UtilityProcess | null = null;
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

/**
 * Start, and keep, the engine process.
 *
 * A crash out there must not look like a hang in here: every request still
 * waiting is failed immediately, because a promise that never settles is a
 * spinner that never stops and a user who has no idea anything went wrong.
 */
const startEngine = (): UtilityProcess => {
  const child = utilityProcess.fork(path.join(here, "engine-host.js"), [], { stdio: "inherit" });

  child.on("message", (message: unknown) => {
    const msg = message as
      | { kind: "event"; event: unknown }
      | { kind: "result"; id: string; value: unknown }
      | { kind: "error"; id: string; error: { code: string; message: string } };

    if (msg.kind === "event") {
      window?.webContents.send(CHANNELS.engineEvent, msg.event);
      return;
    }
    const waiting = pending.get(msg.id);
    if (waiting === undefined) return;
    pending.delete(msg.id);
    if (msg.kind === "result") waiting.resolve(msg.value);
    else waiting.reject(Object.assign(new Error(msg.error.message), { code: msg.error.code }));
  });

  child.on("exit", () => {
    for (const [, waiting] of pending) {
      waiting.reject(new Error("the engine process stopped"));
    }
    pending.clear();
    engine = null;
  });

  return child;
};

const ask = <T>(message: Record<string, unknown>): Promise<T> => {
  engine ??= startEngine();
  const id = randomUUID();
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    engine?.postMessage({ id, ...message });
  });
};

/** Nothing throws across the bridge; every call answers with a discriminated result. */
const result = async <T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: { code: string; message: string } }> => {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    const code = (error as { code?: string }).code ?? "INTERNAL";
    return { ok: false, error: { code, message: error instanceof Error ? error.message : String(error) } };
  }
};

const createWindow = (): void => {
  window = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#101012",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(here, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // A link in the renderer opens in the user's browser, never as a second
  // Electron window with the same privileges as this one.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event) => event.preventDefault());

  if (DEV_URL !== undefined) void window.loadURL(DEV_URL);
  else void window.loadFile(path.join(here, "../../dist/index.html"));

  window.on("closed", () => {
    window = null;
  });
};

/**
 * Reject a call that did not come from the app's own top-level page.
 *
 * The renderer executes subprocesses through these channels. An iframe or a
 * devtools context reaching them would be reaching ffmpeg.
 */
const fromMainFrame = (event: Electron.IpcMainInvokeEvent): boolean =>
  event.senderFrame !== null && event.senderFrame.parent === null;

const guard =
  <T>(handler: (payload: unknown) => Promise<T>) =>
  async (event: Electron.IpcMainInvokeEvent, payload: unknown) => {
    if (!fromMainFrame(event)) return { ok: false, error: { code: "FORBIDDEN", message: "not the main frame" } };
    return result(() => handler(payload));
  };

app.whenReady().then(() => {
  installMediaProtocol();
  ipcMain.handle(CHANNELS.doctor, guard(() => ask({ type: "doctor" })));
  ipcMain.handle(CHANNELS.listRuns, guard(() => ask({ type: "listRuns" })));

  ipcMain.handle(
    CHANNELS.runDetail,
    guard((payload) => ask({ type: "runDetail", runId: runIdSchema.parse(payload).runId })),
  );

  ipcMain.handle(
    CHANNELS.extract,
    guard((payload) => ask({ type: "extract", request: extractRequestSchema.parse(payload) })),
  );

  ipcMain.handle(
    CHANNELS.inspect,
    guard((payload) => ask({ type: "inspect", source: inspectRequestSchema.parse(payload).source })),
  );

  ipcMain.handle(CHANNELS.listSchemas, guard(() => ask({ type: "listSchemas" })));
  ipcMain.handle(
    CHANNELS.saveSchema,
    guard((payload) => ask({ type: "saveSchema", input: saveSchemaRequestSchema.parse(payload) })),
  );
  ipcMain.handle(
    CHANNELS.schemaRevisions,
    guard((payload) => ask({ type: "schemaRevisions", schemaId: schemaIdSchema.parse(payload).schemaId })),
  );
  ipcMain.handle(
    CHANNELS.archiveSchema,
    guard((payload) => ask({ type: "archiveSchema", schemaId: schemaIdSchema.parse(payload).schemaId })),
  );

  ipcMain.handle(
    CHANNELS.runArtifacts,
    guard((payload) => ask({ type: "runArtifacts", runId: runIdSchema.parse(payload).runId })),
  );
  ipcMain.handle(CHANNELS.preferences, guard(() => ask({ type: "preferences" })));
  ipcMain.handle(
    CHANNELS.setDefaultBackend,
    guard((payload) => ask({ type: "setDefaultBackend", backendId: defaultBackendSchema.parse(payload).backendId })),
  );

  ipcMain.handle(CHANNELS.cancel, guard(() => ask({ type: "cancel" })));

  ipcMain.handle(
    CHANNELS.pickFile,
    guard(async () => {
      const picked = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "Video or audio", extensions: ["mp4", "mov", "mkv", "webm", "m4a", "mp3", "wav", "flac"] }],
      });
      return picked.canceled ? null : (picked.filePaths[0] ?? null);
    }),
  );

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  engine?.kill();
  if (process.platform !== "darwin") app.quit();
});
