import { describe, expect, it, vi } from "vitest";
import { linkedSignal, type AbortSignalLike } from "./cancel.js";

/** A parent that behaves like the real thing, without needing lib.dom. */
const parent = (): AbortSignalLike & { abort: () => void } => {
  const listeners = new Set<() => void>();
  let aborted = false;
  return {
    get aborted() {
      return aborted;
    },
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
    abort: () => {
      aborted = true;
      for (const l of listeners) l();
    },
  };
};

describe("linkedSignal", () => {
  it("fires when the parent aborts", () => {
    const p = parent();
    const child = linkedSignal(p);
    const heard = vi.fn();
    child.signal.addEventListener("abort", heard);

    p.abort();

    expect(child.signal.aborted).toBe(true);
    expect(heard).toHaveBeenCalledOnce();
  });

  it("fires on its own, without touching the parent", () => {
    const p = parent();
    const child = linkedSignal(p);
    child.abort();

    expect(child.signal.aborted).toBe(true);
    // The sibling stops; the caller's own cancellation is untouched.
    expect(p.aborted).toBe(false);
  });

  it("is already aborted when the parent was", () => {
    const p = parent();
    p.abort();
    expect(linkedSignal(p).signal.aborted).toBe(true);
  });

  it("calls a listener added after the fact, rather than losing it", () => {
    const p = parent();
    const child = linkedSignal(p);
    child.abort();
    const late = vi.fn();
    child.signal.addEventListener("abort", late);
    expect(late).toHaveBeenCalledOnce();
  });

  it("fires once, however many times abort is called", () => {
    const child = linkedSignal(parent());
    const heard = vi.fn();
    child.signal.addEventListener("abort", heard);
    child.abort();
    child.abort();
    expect(heard).toHaveBeenCalledOnce();
  });

  it("lets go of the parent when disposed", () => {
    // A listener left on a long-lived parent keeps the child and everything it
    // closes over alive for the parent's whole lifetime.
    const p = parent();
    const child = linkedSignal(p);
    child.dispose();
    p.abort();
    expect(child.signal.aborted).toBe(false);
  });
});
