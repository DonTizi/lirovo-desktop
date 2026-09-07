import { spawn } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTrackedExec } from "./exec.js";

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const exists = (file: string) => stat(file).then(() => true, () => false);
const groupAlive = (pid: number): boolean => {
  try { process.kill(-pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
};
const waitFor = async (predicate: () => Promise<boolean> | boolean, timeout = 4000): Promise<void> => {
  const until = Date.now() + timeout;
  while (!(await predicate())) {
    if (Date.now() >= until) throw new Error("Timed out waiting for the real subprocess.");
    await pause(10);
  }
};

describe.skipIf(process.platform === "win32")("journaled subprocess startup", () => {
  it("commits the journal before execution and preserves full stdin, literal argv and scoped environment", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lirovo-exec-journal-"));
    const journal = path.join(root, "journal");
    const { writeFileSync } = await import("node:fs");
    const payload = "Complete source context — é\n".repeat(50_000);
    const exec = createTrackedExec({ onSpawn(pid) { writeFileSync(journal, String(pid)); } });
    const result = await exec(process.execPath, ["-e", `
      const fs = require('node:fs');
      let content = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', part => content += part);
      process.stdin.on('end', () => process.stdout.write(JSON.stringify({
        content, argument: process.argv[1], journal: fs.readFileSync(process.argv[2], 'utf8'),
        env: process.env.LIROVO_EXEC_PROBE, home: process.env.HOME ?? null
      })));
    `, "$(not-a-command); literal spaces", journal], { stdin: payload, env: { LIROVO_EXEC_PROBE: "scoped" } });
    const output = JSON.parse(result.stdout);
    expect(output).toEqual({ content: payload, argument: "$(not-a-command); literal spaces",
      journal: await readFile(journal, "utf8"), env: "scoped", home: null });
    expect(Number(output.journal)).toBeGreaterThan(0);
  });

  it("never executes when the journal write fails or when already cancelled", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lirovo-exec-denied-"));
    const marker = path.join(root, "unsafe");
    const command = ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'unsafe')`];
    await expect(createTrackedExec({ onSpawn() { throw new Error("journal unavailable"); } })(process.execPath, command))
      .rejects.toThrow("journal unavailable");
    const controller = new AbortController(); controller.abort();
    let spawned = false;
    await expect(createTrackedExec({ onSpawn() { spawned = true; } })(process.execPath, command, { signal: controller.signal }))
      .rejects.toMatchObject({ code: "CANCELLED" });
    expect(spawned).toBe(false);
    expect(await exists(marker)).toBe(false);
  });

  it("preserves UTF-8 characters split across stdout and stderr chunks", async () => {
    const result = await createTrackedExec({ onSpawn() {} })(process.execPath, ["-e", `
      for (const stream of [process.stdout, process.stderr]) stream.write(Buffer.from([0xc3]));
      setTimeout(() => { for (const stream of [process.stdout, process.stderr]) stream.write(Buffer.from([0xa9])); }, 50);
    `]);
    expect(result).toEqual({ stdout: "é", stderr: "é" });
  });

  it("refuses an async journal callback instead of granting execution too early", async () => {
    await expect(createTrackedExec({ onSpawn: async () => {} })(process.execPath, ["-e", "console.log('unsafe')"]))
      .rejects.toThrow("must commit synchronously");
  });

  it("a parent killed inside the journal callback leaves EOF, not permission to execute", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lirovo-exec-crash-"));
    const marker = path.join(root, "unsafe");
    const moduleUrl = new URL("./exec.ts", import.meta.url).href;
    const source = `import { createTrackedExec } from ${JSON.stringify(moduleUrl)};
      await createTrackedExec({onSpawn(pid) {
        process.stdout.write(String(pid)); process.kill(process.pid, 'SIGKILL');
      }})(process.execPath, ['-e', ${JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'unsafe')`)}]);`;
    const parent = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", source], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    parent.stdout.on("data", (part) => { stdout += String(part); });
    parent.stderr.on("data", (part) => { stderr += String(part); });
    const signal = await new Promise<NodeJS.Signals | null>((resolve, reject) => {
      parent.once("error", reject); parent.once("close", (_code, killed) => resolve(killed));
    });
    expect(signal, stderr).toBe("SIGKILL");
    const pid = Number(stdout);
    expect(pid).toBeGreaterThan(0);
    await waitFor(() => !groupAlive(pid));
    expect(await exists(marker)).toBe(false);
  });

  it("keeps missing-command and timeout failures actionable", async () => {
    const exec = createTrackedExec({ onSpawn() {} });
    await expect(exec("/nonexistent-lirovo-test-binary", [])).rejects.toMatchObject({ code: "DEPENDENCY_MISSING" });
    await expect(exec(process.execPath, ["-e", "setInterval(() => {}, 100)"], { timeoutMs: 50 }))
      .rejects.toMatchObject({ code: "TIMED_OUT" });
  });

  it("cancels a running process group and escalates when the child ignores SIGTERM", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lirovo-exec-cancel-"));
    const ready = path.join(root, "ready");
    const controller = new AbortController(); let pid = 0;
    const promise = createTrackedExec({ onSpawn(group) { pid = group; } })(process.execPath, ["-e", `
      process.on('SIGTERM', () => {});
      require('node:fs').writeFileSync(${JSON.stringify(ready)}, 'ready');
      setInterval(() => {}, 100);
    `], { signal: controller.signal });
    const outcome = promise.catch((error: unknown) => error);
    await waitFor(() => exists(ready));
    controller.abort();
    expect(await outcome).toMatchObject({ code: "CANCELLED" });
    await waitFor(() => !groupAlive(pid));
  });
});
