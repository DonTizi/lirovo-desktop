import { describe, expect, it } from "vitest";
import { playbackSource } from "./playback-source";

describe("playbackSource", () => {
  it("does not load absent media and preserves the first resource URL", () => {
    expect(playbackSource(null, 1)).toBeUndefined();
    const source = "lirovo-media://artifact/tmp/a%20b%23.mp4";
    expect(playbackSource(source, 0)).toBe(source);
  });

  it("gives a retry a new cache identity without changing the source path", () => {
    const source = "lirovo-media://artifact/tmp/a%20b%23.mp4?x=1";
    const first = playbackSource(source, 1)!;
    const second = playbackSource(source, 2)!;
    expect(first).not.toBe(second);
    expect(new URL(second).pathname).toBe(new URL(source).pathname);
    expect(new URL(second).searchParams.get("x")).toBe("1");
    expect(new URL(second).searchParams.get("playbackAttempt")).toBe("2");
  });

  it("replaces an existing attempt rather than accumulating query parameters", () => {
    const source = "lirovo-media://artifact/tmp/audio.flac?playbackAttempt=1";
    const url = new URL(playbackSource(source, 2)!);
    expect(url.searchParams.getAll("playbackAttempt")).toEqual(["2"]);
  });
});
