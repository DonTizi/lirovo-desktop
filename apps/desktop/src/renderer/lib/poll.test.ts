import { afterEach, describe, expect, it, vi } from "vitest";
import { pollSerial } from "./poll";
import { pendingRun } from "./run-session";

afterEach(() => vi.useRealTimers());
describe("live review lifecycle primitives", () => {
  it("opens a truthful session before ingest has created a database row", () => {
    expect(pendingRun("run-live", "video.mp4")).toMatchObject({
      runId: "run-live",
      status: "running",
      title: "video.mp4",
      values: [],
      stages: [],
      durationS: null,
    });
  });
  it("does not overlap reads slower than the poll interval", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const read = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const stop = pollSerial(read, 10);
    await vi.advanceTimersByTimeAsync(100);
    expect(read).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(10);
    expect(read).toHaveBeenCalledTimes(2);
    stop();
    release();
    await vi.advanceTimersByTimeAsync(100);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("cleanup cancels a scheduled next read", async () => {
    vi.useFakeTimers();
    const read = vi.fn(async () => {});
    const stop = pollSerial(read, 10);
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(100);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
