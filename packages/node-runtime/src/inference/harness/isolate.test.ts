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
    expect(env["PATH"]).toBe("/usr/bin");
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
