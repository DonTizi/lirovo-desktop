import { describe, expect, it } from "vitest";
import { FIXES, planFor } from "./fixes.js";
import { DEPENDENCIES } from "./dependencies.js";

describe("planFor", () => {
  it("refuses anything that is not a known id", () => {
    // The entire security argument. The window sends an id, and an id that is
    // not in the table resolves to nothing — so a compromised renderer cannot
    // express a command, only name one this app already ships.
    for (const hostile of ["rm -rf ~", "; rm -rf /", "../../etc/passwd", "", "toString", "__proto__", "constructor"]) {
      expect(planFor(hostile)).toBeNull();
    }
  });

  it("resolves every dependency to the command that package already declares", () => {
    // One source, not two. A second copy of `brew install ffmpeg` is a second
    // thing to keep in step with the doctor that prints it.
    for (const dep of DEPENDENCIES) {
      expect(planFor(dep.id)?.command).toBe(dep.install);
    }
  });

  it("resolves the three model backends", () => {
    expect(planFor("codex")?.command).toBe("npm i -g @openai/codex");
    expect(planFor("claude")?.command).toBe("npm i -g @anthropic-ai/claude-code");
    expect(planFor("local")?.command).toBe("brew install ollama");
  });

  it("says outright that installing Ollama does not finish the job", () => {
    // `brew install ollama` puts the binary there and the row stays off: a
    // server still has to start and a model still has to be pulled. Claiming
    // otherwise would put a tick over something that did not work.
    expect(planFor("local")?.selfContained).toBe(false);
    expect(planFor("codex")?.selfContained).toBe(true);
  });

  it("offers somewhere to go when a command is not the whole answer", () => {
    for (const id of ["local", "codex", "claude"] as const) {
      expect(FIXES[id].homepage).toMatch(/^https:\/\//);
    }
  });

  it("never carries a shell metacharacter in a command", () => {
    // These strings reach `sh -lc`. They are constants, but a constant with a
    // `;` in it is one careless edit from being a second command.
    for (const plan of Object.values(FIXES)) {
      expect(plan.command).not.toMatch(/[;&|`$><]/);
    }
  });
});
