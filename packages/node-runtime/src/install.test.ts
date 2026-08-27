import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Installable, LirovoPaths } from "@lirovo/core";
import { installArtifact } from "./install.js";

const BODY = "the bytes we asked for";
const GOOD = createHash("sha256").update(BODY).digest("hex");

let paths: LirovoPaths;
beforeEach(async () => {
  const data = await mkdtemp(path.join(tmpdir(), "lirovo-install-"));
  paths = { data, runs: path.join(data, "runs"), models: path.join(data, "models"), bundledBin: null, dbFile: "" };
});

const item = (over: Partial<Installable> = {}): Installable => ({
  id: "whisper-model",
  label: "a thing",
  why: "test",
  url: "https://example.invalid/thing.bin",
  sha256: GOOD,
  bytes: BODY.length,
  relPath: "models/thing.bin",
  executable: false,
  ...over,
});

const serving = (body: string, init: { status?: number; headers?: Record<string, string> } = {}) =>
  (async () =>
    new Response(body, { status: init.status ?? 200, headers: init.headers ?? {} })) as unknown as typeof fetch;

describe("installArtifact", () => {
  it("writes the file when the checksum matches", async () => {
    const result = await installArtifact(item(), paths, { fetch: serving(BODY) });
    expect(result.alreadyPresent).toBe(false);
    expect(await readFile(result.path, "utf8")).toBe(BODY);
  });

  it("refuses a body whose checksum is wrong, and leaves nothing behind", async () => {
    const target = path.join(paths.data, "models/thing.bin");
    await expect(installArtifact(item(), paths, { fetch: serving("something else") })).rejects.toThrow(/checksum/);
    // Both the target AND the partial: a wrong file that stays on disk is a
    // file some later code path finds and uses.
    await expect(stat(target)).rejects.toThrow();
    await expect(stat(`${target}.part`)).rejects.toThrow();
  });

  it("does not download again when the file is already correct", async () => {
    await mkdir(path.join(paths.data, "models"), { recursive: true });
    await writeFile(path.join(paths.data, "models/thing.bin"), BODY);
    let called = 0;
    const counting = (async () => {
      called += 1;
      return new Response(BODY);
    }) as unknown as typeof fetch;
    const result = await installArtifact(item(), paths, { fetch: counting });
    expect(result.alreadyPresent).toBe(true);
    expect(called).toBe(0);
  });

  it("replaces a file that is present but wrong", async () => {
    await mkdir(path.join(paths.data, "models"), { recursive: true });
    await writeFile(path.join(paths.data, "models/thing.bin"), "an old truncated copy");
    const result = await installArtifact(item(), paths, { fetch: serving(BODY) });
    expect(result.alreadyPresent).toBe(false);
    expect(await readFile(result.path, "utf8")).toBe(BODY);
  });

  it("marks a binary executable, and a model not", async () => {
    const bin = await installArtifact(item({ relPath: "bin/thing", executable: true }), paths, {
      fetch: serving(BODY),
    });
    expect((await stat(bin.path)).mode & 0o111).toBeGreaterThan(0);
    const model = await installArtifact(item(), paths, { fetch: serving(BODY) });
    expect((await stat(model.path)).mode & 0o111).toBe(0);
  });

  it("reports progress as the bytes arrive", async () => {
    const seen: number[] = [];
    await installArtifact(item(), paths, {
      fetch: serving(BODY, { headers: { "content-length": String(BODY.length) } }),
      onProgress: (p) => seen.push(p.received),
    });
    expect(seen.at(-1)).toBe(BODY.length);
  });

  it("says which host it could not reach", async () => {
    const failing = (async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    }) as unknown as typeof fetch;
    await expect(installArtifact(item(), paths, { fetch: failing })).rejects.toThrow(/example.invalid/);
  });

  it("treats a 404 as a failure, not as an empty file", async () => {
    await expect(installArtifact(item(), paths, { fetch: serving("", { status: 404 }) })).rejects.toThrow(/404/);
  });

  it("reads the checksum from the publisher's own sums file", async () => {
    const sums = `${GOOD}  thing.bin\ndeadbeef  something-else\n`;
    const fetcher = (async (url: string) =>
      new Response(String(url).endsWith("SUMS") ? sums : BODY)) as unknown as typeof fetch;
    const result = await installArtifact(
      item({ sha256: { fromSumsFile: "https://example.invalid/SHA2-256SUMS", name: "thing.bin" } }),
      paths,
      { fetch: fetcher },
    );
    expect(result.sha256).toBe(GOOD);
  });

  it("refuses to install when the sums file does not list the file", async () => {
    const fetcher = (async (url: string) =>
      new Response(String(url).endsWith("SUMS") ? "deadbeef  other\n" : BODY)) as unknown as typeof fetch;
    await expect(
      installArtifact(
        item({ sha256: { fromSumsFile: "https://example.invalid/SHA2-256SUMS", name: "thing.bin" } }),
        paths,
        { fetch: fetcher },
      ),
    ).rejects.toThrow(/unverified/);
  });
});
