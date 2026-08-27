import { app } from "electron";
import electronUpdater from "electron-updater";

/**
 * Moving an installed copy forward, without ever taking work away.
 *
 * Two rules shape everything here:
 *
 *   Nothing installs itself. `autoDownload` and `autoInstallOnAppQuit` are both
 *   off, so an update happens because someone asked for it. This app runs
 *   twenty-minute extractions; an update that discards one is worse than an
 *   update that waits a day.
 *
 *   Silence when there is nothing. A check that finds no update says nothing at
 *   all — a toast that appears to report "you are up to date" is a toast people
 *   learn to dismiss without reading, including on the day it says something
 *   else.
 */

const { autoUpdater } = electronUpdater;

export type UpdateChannel = "latest" | "beta";

export type UpdateEvent =
  | { readonly kind: "checking" }
  | { readonly kind: "none"; readonly version: string }
  | { readonly kind: "available"; readonly version: string; readonly notes: string | null }
  | { readonly kind: "progress"; readonly percent: number; readonly bytesPerSecond: number }
  | { readonly kind: "ready"; readonly version: string }
  | { readonly kind: "error"; readonly message: string };

export interface UpdaterDeps {
  readonly send: (event: UpdateEvent) => void;
  /** Asked before installing. False means a run is in flight. */
  readonly canRestart: () => boolean;
  readonly channel: () => UpdateChannel;
}

/**
 * Six hours, and once at start after a grace period.
 *
 * Hourly is a request every hour for something that changes weekly. The grace
 * period keeps the check off the launch path, where it would compete with the
 * doctor probes and the first render for a machine that is already busy.
 */
const EVERY = 6 * 60 * 60 * 1000;
const GRACE = 30 * 1000;

let started = false;
let timer: NodeJS.Timeout | null = null;

export const startUpdater = (deps: UpdaterDeps): (() => void) => {
  if (started) return () => undefined;
  started = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.channel = deps.channel();
  // `beta` should also see a newer stable. Without this a beta user sits on an
  // old prerelease while everyone else has moved on.
  autoUpdater.allowPrerelease = deps.channel() === "beta";
  autoUpdater.logger = null;

  autoUpdater.on("checking-for-update", () => deps.send({ kind: "checking" }));
  autoUpdater.on("update-not-available", () => deps.send({ kind: "none", version: app.getVersion() }));
  autoUpdater.on("update-available", (info) =>
    deps.send({
      kind: "available",
      version: info.version,
      notes: typeof info.releaseNotes === "string" ? info.releaseNotes : null,
    }),
  );
  autoUpdater.on("download-progress", (p) =>
    deps.send({ kind: "progress", percent: Math.round(p.percent), bytesPerSecond: Math.round(p.bytesPerSecond) }),
  );
  autoUpdater.on("update-downloaded", (info) => deps.send({ kind: "ready", version: info.version }));
  autoUpdater.on("error", (error) => deps.send({ kind: "error", message: error.message }));

  const check = (): void => {
    // A packaged app only. In development there is no feed to ask and
    // electron-updater throws rather than shrugging.
    if (!app.isPackaged) return;
    void autoUpdater.checkForUpdates().catch(() => undefined);
  };

  const first = setTimeout(check, GRACE);
  timer = setInterval(check, EVERY);

  return () => {
    clearTimeout(first);
    if (timer !== null) clearInterval(timer);
    timer = null;
    started = false;
  };
};

export const checkNow = async (): Promise<void> => {
  if (!app.isPackaged) throw new Error("updates only exist for an installed copy");
  await autoUpdater.checkForUpdates();
};

export const downloadUpdate = async (): Promise<void> => {
  await autoUpdater.downloadUpdate();
};

/**
 * Quit and install, unless that would throw away a run.
 *
 * The refusal is the point. Everything else about an update can wait; an
 * extraction that has been transcribing for eighteen minutes cannot be
 * restarted for free.
 */
export const installUpdate = (canRestart: () => boolean): { installed: boolean; why: string | null } => {
  if (!canRestart()) {
    return { installed: false, why: "an extraction is running — it will finish, then this can restart" };
  }
  // `isSilent` false so the installer is visible; `isForceRunAfter` true so the
  // app the user was using comes back rather than leaving them at the desktop.
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return { installed: true, why: null };
};

export const setChannel = (channel: UpdateChannel): void => {
  autoUpdater.channel = channel;
  autoUpdater.allowPrerelease = channel === "beta";
};

export const currentVersion = (): string => app.getVersion();
