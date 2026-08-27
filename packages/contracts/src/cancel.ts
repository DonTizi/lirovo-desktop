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

/**
 * A signal that fires when its parent does, or when someone calls `abort`.
 *
 * Written out rather than reaching for `AbortSignal.any`: this layer has no
 * DOM lib and must not acquire one, and the whole shape is eight lines.
 *
 * It exists so a caller running two things at once can stop the loser of a
 * race. Waiting for a sibling to settle is what keeps a stage from writing to
 * a closed database — but waiting is not the same as waiting forever, and a
 * branch with a forty-five-minute timeout should not outlive the failure that
 * made its result useless.
 */
export const linkedSignal = (
  parent: AbortSignalLike,
): { readonly signal: AbortSignalLike; abort: () => void; dispose: () => void } => {
  const listeners = new Set<() => void>();
  let aborted = parent.aborted;

  const fire = (): void => {
    if (aborted) return;
    aborted = true;
    for (const listener of listeners) listener();
  };

  const onParent = (): void => fire();
  parent.addEventListener("abort", onParent);

  return {
    signal: {
      get aborted() {
        return aborted;
      },
      addEventListener: (_type, listener) => {
        if (aborted) listener();
        else listeners.add(listener);
      },
      removeEventListener: (_type, listener) => {
        listeners.delete(listener);
      },
    },
    abort: fire,
    // Always call this: a listener left on the parent keeps the child, its
    // closure, and everything they reference alive for the parent's lifetime.
    dispose: () => {
      parent.removeEventListener("abort", onParent);
      listeners.clear();
    },
  };
};
