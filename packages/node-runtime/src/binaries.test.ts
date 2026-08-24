import { describe, expect, it } from "vitest";
import { parseVersion } from "./binaries.js";

describe("parseVersion", () => {
  it("pulls the number out of an ffmpeg banner", () => {
    expect(parseVersion("ffmpeg version 8.1.1 Copyright (c) 2000-2026")).toBe("8.1.1");
  });

  it("handles a bare version line", () => {
    expect(parseVersion("2026.03.17\n")).toBe("2026.03.17");
  });

  it("skips leading blank lines", () => {
    expect(parseVersion("\n\n  codex-cli 0.147.0")).toBe("0.147.0");
  });

  it("falls back to the first line when there is no number", () => {
    expect(parseVersion("unknown build")).toBe("unknown build");
  });

  it("returns null for empty output", () => {
    expect(parseVersion("   \n  ")).toBeNull();
  });
});
