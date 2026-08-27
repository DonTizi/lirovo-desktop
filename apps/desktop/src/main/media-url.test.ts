import { describe, expect, it } from "vitest";
import { mediaUrl, pathFromMediaUrl } from "./media-url.js";

describe("media url round trip", () => {
  const cases = [
    "/Users/someone/Library/Application Support/Lirovo/runs/run_abc/normalized/video.mp4",
    "/Users/someone/Library/Application Support/Lirovo/runs/run_abc/frames/dedup/000000.jpg",
    "/Users/José/Films/été 2026.mp4",
    "/tmp/a b c/d#e?f.mp4",
  ];

  for (const file of cases) {
    it(`survives ${file}`, () => {
      expect(pathFromMediaUrl(mediaUrl(file))).toBe(file);
    });
  }

  it("keeps the scheme a URL parser accepts", () => {
    expect(mediaUrl("/x/y.mp4").startsWith("lirovo-media://")).toBe(true);
  });

  it("encodes the characters that would otherwise end the path", () => {
    // `?` and `#` unencoded would cut the path short and 404 a file that is
    // sitting right there — the exact failure a user reads as a broken player.
    expect(mediaUrl("/a/b?c#d.jpg")).not.toContain("?");
    expect(mediaUrl("/a/b?c#d.jpg")).not.toContain("#");
  });
});
