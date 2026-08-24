/**
 * A structural stand-in for the WHATWG `AbortSignal`.
 *
 * `AbortSignal` only exists in `lib.dom`, and pulling the whole DOM into the
 * contracts layer would let browser globals leak into a package that must stay
 * platform-free. Node's and the browser's real `AbortSignal` both satisfy this
 * shape structurally, so callers pass the genuine article and nothing wraps.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: "abort", listener: () => void): void;
  removeEventListener(type: "abort", listener: () => void): void;
}

/** Throw the canonical cancellation error if the caller has already given up. */
export const throwIfAborted = (signal: AbortSignalLike | undefined, what: string): void => {
  if (signal?.aborted) throw new Error(`cancelled: ${what}`);
};
