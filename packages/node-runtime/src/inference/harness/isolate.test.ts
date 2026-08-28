import { describe, expect, it } from "vitest";
import { minimalEnv, renderConversation } from "./isolate.js";

describe("minimalEnv", () => {
  it("drops credentials that have nothing to do with the harness", () => {
    const env = minimalEnv({
      PATH: "/usr/bin",
      HOME: "/Users/x",
      AWS_SECRET_ACCESS_KEY: "leak-me",
      GITHUB_TOKEN: "leak-me",
      OPENAI_API_KEY: "leak-me",
      STRIPE_SECRET_KEY: "leak-me",
    });
    expect(Object.values(env)).not.toContain("leak-me");
  });

  it("gives a PATH that can start an interpreted CLI", () => {
    // This assertion used to read `expect(env["PATH"]).toBe("/usr/bin")`, which
    // pinned the exact behaviour that made Codex undetectable.
    //
    // `codex` is a `#!/usr/bin/env node` script, so running it — even by
    // absolute path — asks the kernel to resolve `node` through PATH. On the
    // PATH launchd gives a Finder-launched app that fails with
    //     env: node: No such file or directory
    // and the probe reported it as codex not being installed. Claude Code hid
    // the bug by being a native Mach-O binary needing no interpreter, so the
    // two behaved differently for a reason about neither of them.
    const env = minimalEnv({ PATH: "/usr/bin:/bin:/usr/sbin:/sbin", HOME: "/Users/x" });
    expect(env["PATH"]).toContain("/Users/x/.local/bin");
    expect(env["PATH"]).toContain("/opt/homebrew/bin");
  });

  it("still lets the inherited PATH decide first", () => {
    // The extra directories are a floor, not an override: a real PATH from a
    // terminal or a dev run keeps winning.
    const env = minimalEnv({ PATH: "/my/own/bin:/usr/bin", HOME: "/Users/x" });
    expect(env["PATH"]?.startsWith("/my/own/bin:/usr/bin")).toBe(true);
  });

  it("lists no directory twice", () => {
    const dirs = (minimalEnv({ PATH: "/opt/homebrew/bin:/usr/bin", HOME: "/Users/x" })["PATH"] ?? "").split(":");
    expect(new Set(dirs).size).toBe(dirs.length);
  });

  it("keeps HOME, because the CLI reads its own credentials from there", () => {
    // Documented limitation, asserted so nobody "tidies it up" and breaks auth.
    expect(minimalEnv({ HOME: "/Users/x" })["HOME"]).toBe("/Users/x");
  });

  it("marks the session non-interactive", () => {
    const env = minimalEnv({});
    expect(env["CI"]).toBe("1");
    expect(env["NO_COLOR"]).toBe("1");
  });

  it("omits a variable that is absent rather than defining it empty", () => {
    expect("LANG" in minimalEnv({ PATH: "/usr/bin" })).toBe(false);
  });
});

describe("renderConversation", () => {
  it("labels a previous attempt so a repair turn is legible to the model", () => {
    const text = renderConversation([
      { role: "system", content: "be exact" },
      { role: "user", content: "extract" },
      { role: "assistant", content: "{bad" },
      { role: "user", content: "that failed validation" },
    ]);
    expect(text).toContain("<previous_answer>\n{bad\n</previous_answer>");
    expect(text.indexOf("be exact")).toBeLessThan(text.indexOf("extract"));
  });
});
