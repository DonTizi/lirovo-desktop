import { describe, expect, it } from "vitest";
import { runFix } from "./run-fix.js";

describe("runFix", () => {
  it("reports success and the output of a command that works", async () => {
    const r = await runFix("echo hello");
    expect(r.ok).toBe(true);
    expect(r.code).toBe(0);
    expect(r.output).toBe("hello");
  });

  it("reports failure with the exit code and what was printed", async () => {
    // The whole point of running it: when it fails, somebody needs the reason.
    const r = await runFix("echo 'no such package' >&2; exit 3");
    expect(r.ok).toBe(false);
    expect(r.code).toBe(3);
    expect(r.output).toContain("no such package");
  });

  it("runs through a login shell, so the user's own PATH exists", async () => {
    // The reason the whole thing works. An app launched from the Finder gets
    // `/usr/bin:/bin:/usr/sbin:/sbin` from launchd, and `npm i -g` means
    // nothing without the profile. Measured rather than asserted: a plain
    // `sh -c` on this machine yields
    //   /usr/gnu/bin:/usr/local/bin:/bin:/usr/bin:.
    // while `sh -lc` yields the user's real PATH, ~/.local/bin first.
    const withLogin = await runFix("echo $PATH");
    expect(withLogin.ok).toBe(true);
    expect(withLogin.output.split(":").length).toBeGreaterThan(5);
  });

  it("keeps only the tail, because that is where the error is", async () => {
    const r = await runFix("for i in $(seq 1 200); do echo line$i; done");
    const lines = r.output.split("\n");
    expect(lines.length).toBeLessThanOrEqual(40);
    expect(lines.at(-1)).toBe("line200");
  });

  it("does not hang on a command that would read stdin", async () => {
    // stdin is ignored, so `read` sees EOF rather than waiting on a terminal
    // that does not exist.
    const r = await runFix("read x; echo done");
    expect(r.output).toContain("done");
  }, 10_000);

  it("can be cancelled", async () => {
    const c = new AbortController();
    const p = runFix("sleep 30", { signal: c.signal });
    setTimeout(() => c.abort(), 100);
    const r = await p;
    expect(r.ok).toBe(false);
  }, 10_000);

  it("reports a shell that does not exist rather than throwing", async () => {
    const r = await runFix("echo hi", { shell: "/nope/nothing" });
    expect(r.ok).toBe(false);
    expect(r.output).not.toBe("");
  });
});
