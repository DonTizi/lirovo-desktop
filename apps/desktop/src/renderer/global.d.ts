import type { LirovoApi } from "../preload/index.js";

/**
 * The bridge, as the renderer sees it.
 *
 * Typed from the preload's own export, so a channel that changes shape there
 * breaks the compile here rather than at runtime in front of a user.
 */
declare global {
  interface Window {
    readonly lirovo: LirovoApi;
  }
}

export {};
