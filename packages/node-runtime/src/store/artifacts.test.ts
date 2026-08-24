import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFsArtifactStore } from "./artifacts.js";

describe("createFsArtifactStore", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "lirovo-store-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("round-trips text and reports its digest", async () => {
    const store = createFsArtifactStore(root);
    const { sha256, bytes } = await store.put("run_a", "a/b.json", '{"x":1}');
    expect(bytes).toBe(7);
    expect(await store.getText("run_a", "a/b.json")).toBe('{"x":1}');
    expect(await store.verify("run_a", "a/b.json", sha256)).toBe(true);
  });

  it("leaves no temp file behind after a write", async () => {
    const store = createFsArtifactStore(root);
    await store.put("run_a", "x.json", "{}");
    const files = await readdir(path.join(root, "run_a"));
    expect(files.filter((f) => f.includes(".tmp"))).toEqual([]);
  });

  it("detects a corrupted artifact", async () => {
    const store = createFsArtifactStore(root);
    const { sha256 } = await store.put("run_a", "x.json", "original");
    await writeFile(path.join(root, "run_a", "x.json"), "tampered");
    expect(await store.verify("run_a", "x.json", sha256)).toBe(false);
  });

  it("returns null rather than throwing for a missing artifact", async () => {
    const store = createFsArtifactStore(root);
    expect(await store.get("run_a", "nope.json")).toBeNull();
    expect(await store.exists("run_a", "nope.json")).toBe(false);
  });

  it("reports the bytes it frees when a run is removed", async () => {
    const store = createFsArtifactStore(root);
    await store.put("run_a", "one.bin", "0123456789");
    await store.put("run_a", "deep/two.bin", "0123456789");
    const { freedBytes } = await store.remove("run_a");
    expect(freedBytes).toBe(20);
    expect(await store.exists("run_a", "one.bin")).toBe(false);
  });
});
