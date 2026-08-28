import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, app, dialog, ipcMain, shell, utilityProcess, type UtilityProcess } from "electron";
import {
  CHANNELS,
  defaultBackendSchema,
  extractRequestSchema,
  busySchema,
  installSchema,
  purgeSchema,
  revealSchema,
  updateChannelSchema,
  inspectRequestSchema,
  runFixSchema,
  runIdSchema,
  saveSchemaRequestSchema,
  schemaIdSchema,
} from "./ipc.js";

import { installMediaProtocol, registerMediaScheme } from "./media-protocol.js";
import { checkNow, currentVersion, downloadUpdate, installUpdate, setChannel, startUpdater, type UpdateChannel } from "./updater.js";
import type { EngineMessage } from "./engine-protocol.js";

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
    const msg = message as EngineMessage;

    // Both are pushes, not answers: neither carries a request id, so neither
    // can be looked up in `pending`.
    if (msg.kind === "event") {
      window?.webContents.send(CHANNELS.engineEvent, msg.event);
      return;
    }
    if (msg.kind === "install-progress") {
      window?.webContents.send(CHANNELS.installProgress, msg.progress);
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
      preload: path.join(here, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // On. The preload only uses contextBridge, ipcRenderer and
      // webUtils.getPathForFile, all of which a sandboxed preload has — so
      // there is nothing to buy by leaving Node reachable from the renderer.
      // This app renders transcripts and OCR text, which is content an
      // attacker can influence; with the sandbox off, a renderer compromise
      // reaches Node directly instead of stopping at the bridge.
      sandbox: true,
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

/**
 * Whether a run is in flight, as last reported by the renderer.
 *
 * The main process cannot see the engine's state, and the one question it
 * needs answering — may I quit and install? — has to be answerable
 * immediately. So the renderer tells it when the answer changes.
 */
let busy = false;

/**
 * The channel this launch started on.
 *
 * Read once from the settings table before the first check, because the
 * updater needs it before the window exists and the engine process is the only
 * thing that can read the database.
 */
let channelAtBoot: UpdateChannel = "latest";

app.whenReady().then(() => {
  installMediaProtocol();

  void ask<{ updateChannel: UpdateChannel }>({ type: "preferences" })
    .then((prefs) => {
      channelAtBoot = prefs.updateChannel;
      setChannel(channelAtBoot);
    })
    .catch(() => undefined);

  startUpdater({
    send: (event) => window?.webContents.send(CHANNELS.updateEvent, event),
    canRestart: () => !busy,
    channel: () => channelAtBoot,
  });
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
  ipcMain.handle(
    CHANNELS.install,
    guard((payload) => {
      const { what, model } = installSchema.parse(payload);
      return ask({ type: "install", what, ...(model === undefined ? {} : { model }) });
    }),
  );
  ipcMain.handle(CHANNELS.storage, guard(() => ask({ type: "storage" })));

  // --- updates -------------------------------------------------------------
  //
  // The channel lives in the same settings table as every other preference, so
  // it survives a restart and the engine process is the one place that reads
  // it. `busy` is what the renderer told us about a run in flight: the main
  // process cannot see the engine's state, and asking across two hops to
  // answer a button press would make the button feel broken.
  ipcMain.handle(
    CHANNELS.updateState,
    guard(async () => {
      const prefs = (await ask({ type: "preferences" })) as { updateChannel: UpdateChannel };
      return { version: currentVersion(), channel: prefs.updateChannel, supported: app.isPackaged };
    }),
  );
  ipcMain.handle(
    CHANNELS.updateCheck,
    guard(async () => {
      // The channel decides the wording of a failure — "no stable release yet"
      // only makes sense to someone on stable — so it is read here rather than
      // guessed inside the updater.
      const prefs = (await ask({ type: "preferences" })) as { updateChannel: UpdateChannel };
      return checkNow(prefs.updateChannel);
    }),
  );
  ipcMain.handle(CHANNELS.updateDownload, guard(() => downloadUpdate()));
  ipcMain.handle(CHANNELS.updateInstall, guard(async () => installUpdate(() => !busy)));
  ipcMain.handle(
    CHANNELS.updateChannel,
    guard(async (payload) => {
      const { channel } = updateChannelSchema.parse(payload);
      setChannel(channel);
      await ask({ type: "setUpdateChannel", channel });
      return { version: currentVersion(), channel, supported: app.isPackaged };
    }),
  );
  ipcMain.handle(
    CHANNELS.busy,
    guard(async (payload) => {
      busy = busySchema.parse(payload).busy;
      return { busy };
    }),
  );

  /**
   * A native confirmation, not a web one.
   *
   * This deletes files. A `confirm()` in the renderer is a dialog the page
   * draws for itself; the one the system draws cannot be styled to look like
   * something harmless, defaults to Cancel, and is the sheet a macOS user
   * already knows how to read.
   */
  ipcMain.handle(
    CHANNELS.purge,
    guard(async (payload) => {
      const { what } = purgeSchema.parse(payload);
      const everything = what === "everything";
      const { response } = await dialog.showMessageBox(window as BrowserWindow, {
        type: "warning",
        buttons: ["Cancel", everything ? "Delete everything" : "Delete extractions"],
        defaultId: 0,
        cancelId: 0,
        message: everything ? "Delete everything Lirovo has stored?" : "Delete every extraction?",
        detail: everything
          ? "The database, every extraction, the downloaded speech model and any binary this app installed. Schemas go too. This cannot be undone."
          : "Every run and its artifacts — frames, transcripts, graphs. Schemas, settings and the downloaded model are kept. This cannot be undone.",
      });
      if (response !== 1) return { cancelled: true, freedBytes: 0 };
      const result = (await ask({ type: "purge", what })) as { freedBytes: number };
      return { cancelled: false, ...result };
    }),
  );

  ipcMain.handle(
    CHANNELS.reveal,
    guard(async (payload) => {
      const { path: target } = revealSchema.parse(payload);
      // Only inside the data directory: the renderer does not get to name an
      // arbitrary path for the system to open.
      const { resolvePaths } = await import("@lirovo/node-runtime");
      const root = resolvePaths().data;
      const resolved = path.resolve(target);
      if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return { revealed: false };
      shell.showItemInFolder(resolved);
      return { revealed: true };
    }),
  );

  ipcMain.handle(CHANNELS.preferences, guard(() => ask({ type: "preferences" })));
  ipcMain.handle(CHANNELS.markOnboarded, guard(() => ask({ type: "markOnboarded" })));
  ipcMain.handle(
    CHANNELS.runFix,
    guard((payload) => {
      // Validated against the registry itself, not against a shape. A schema
      // that accepted "any string up to 400 characters" would be a length cap
      // on a shell; `FixId` is the list of things this app ships, and nothing
      // outside it can be named.
      const { fixId } = runFixSchema.parse(payload);
      return ask({ type: "runFix", fixId });
    }),
  );
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
