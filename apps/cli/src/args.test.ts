import { describe, expect, it } from "vitest";
import { boolFlag, parseArgs } from "./args.js";

describe("parseArgs", () => {
  it("splits a command from its flags", () => {
    const a = parseArgs(["doctor", "--json"]);
    expect(a.command).toBe("doctor");
    expect(boolFlag(a, "json")).toBe(true);
  });

  it("takes a value after a flag", () => {
    expect(parseArgs(["extract", "x.mp4", "--harness", "codex"]).flags["harness"]).toBe("codex");
  });

  it("takes a value from --flag=value", () => {
    expect(parseArgs(["extract", "--harness=codex"]).flags["harness"]).toBe("codex");
  });

  it("does not swallow the next flag as a value", () => {
    const a = parseArgs(["doctor", "--json", "--verbose"]);
    expect(a.flags["json"]).toBe(true);
    expect(a.flags["verbose"]).toBe(true);
  });

  it("keeps positionals in order", () => {
    expect(parseArgs(["export", "42", "out.md"]).positionals).toEqual(["42", "out.md"]);
  });
});
