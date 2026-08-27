import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { LirovoPaths, SourceManifest } from "@lirovo/core";
import { openMemoryDatabase, type Db } from "./store/db.js";
import { createRunStore } from "./store/runs.js";
import { createSchemaStore } from "./store/schemas.js";
import { createSettingsStore } from "./store/settings.js";
import { directorySize, purgeEverything, purgeRuns, storageReport, withinDataDir } from "./library.js";

let paths: LirovoPaths;
let db: Db;

const manifest = (hash: string): SourceManifest => ({
  source_type: "file",
  duration_s: 10,
  codec: "h264",
  has_audio: true,
  has_video: true,
  ext: "mp4",
  title: "talk",
  source_path: "/tmp/talk.mp4",
  content_sha256: hash,
});

beforeEach(async () => {
  const data = await mkdtemp(path.join(tmpdir(), "lirovo-library-"));
  paths = {
    data,
    runs: path.join(data, "runs"),
    models: path.join(data, "models"),
    bundledBin: null,
    dbFile: path.join(data, "lirovo.db"),
  };
  db = openMemoryDatabase();
});

const seed = async (runs: number): Promise<void> => {
  const store = createRunStore(db);
  for (let i = 0; i < runs; i++) {
    const source = store.upsertSource(manifest(`hash-${i}`), `/tmp/${i}.mp4`);
    store.createRun(`run_${i}`, source, null, "host:1");
    const dir = path.join(paths.runs, `run_${i}`, "frames");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "000000.jpg"), "x".repeat(1000));
  }
};

describe("directorySize", () => {
  it("is zero for a directory that does not exist", async () => {
    // Every one of them is missing on a first launch. A settings page that
    // throws because `models/` has not been created yet is worse than one
    // that says nothing is stored.
    expect(await directorySize(path.join(paths.data, "nope"))).toBe(0);
  });

  it("counts nested files", async () => {
    await mkdir(path.join(paths.data, "a", "b"), { recursive: true });
    await writeFile(path.join(paths.data, "a", "b", "f"), "12345");
    expect(await directorySize(paths.data)).toBe(5);
  });
});

describe("storageReport", () => {
  it("reports zeros and no runs on an untouched machine", async () => {
    const report = await storageReport(paths, db);
    expect(report).toMatchObject({ runCount: 0, runsBytes: 0, modelsBytes: 0, binBytes: 0, dbBytes: 0 });
  });

  it("separates the things a person decides between", async () => {
    await seed(2);
    await mkdir(paths.models, { recursive: true });
    await writeFile(path.join(paths.models, "ggml.bin"), "m".repeat(500));
    await mkdir(path.join(paths.data, "bin"), { recursive: true });
    await writeFile(path.join(paths.data, "bin", "yt-dlp"), "b".repeat(50));

    const report = await storageReport(paths, db);
    expect(report.runCount).toBe(2);
    expect(report.runsBytes).toBe(2000);
    expect(report.modelsBytes).toBe(500);
    expect(report.binBytes).toBe(50);
  });
});

describe("purgeRuns", () => {
  it("removes the artifacts and the rows together", async () => {
    await seed(3);
    const { freedBytes } = await purgeRuns(paths, db);
    expect(freedBytes).toBe(3000);
    expect(await readdir(paths.runs)).toEqual([]);
    // A run row whose artifacts are gone opens onto a broken page.
    expect((await storageReport(paths, db)).runCount).toBe(0);
  });

  it("leaves the runs directory in place, ready to be written to again", async () => {
    await seed(1);
    await purgeRuns(paths, db);
    await expect(readdir(paths.runs)).resolves.toEqual([]);
  });

  it("keeps schemas, settings and the speech model", async () => {
    await seed(1);
    const schemas = createSchemaStore(db);
    schemas.save({ name: "Talks", fields: [{ name: "title", kind: "text" }] });
    createSettingsStore(db).set("default_backend", "claude");
    await mkdir(paths.models, { recursive: true });
    await writeFile(path.join(paths.models, "ggml.bin"), "model");

    await purgeRuns(paths, db);

    expect(schemas.list()).toHaveLength(1);
    expect(createSettingsStore(db).get("default_backend")).toBe("claude");
    expect(await directorySize(paths.models)).toBe(5);
  });

  it("is safe to run twice, and on a machine with nothing", async () => {
    await expect(purgeRuns(paths, db)).resolves.toEqual({ freedBytes: 0 });
    await expect(purgeRuns(paths, db)).resolves.toEqual({ freedBytes: 0 });
  });
});

describe("purgeEverything", () => {
  it("empties everything it owns and leaves the trees in place", async () => {
    await seed(2);
    await mkdir(paths.models, { recursive: true });
    await writeFile(path.join(paths.models, "ggml.bin"), "m".repeat(100));

    const { freedBytes } = await purgeEverything(paths);
    expect(freedBytes).toBe(2100);
    // Empty, not missing: the next write needs somewhere to go, and a missing
    // parent fails in a way that reads as a bug rather than as a clean slate.
    await expect(readdir(paths.runs)).resolves.toEqual([]);
    await expect(readdir(paths.models)).resolves.toEqual([]);
  });

  it("is safe on a machine that has nothing", async () => {
    await expect(purgeEverything(paths)).resolves.toEqual({ freedBytes: 0 });
  });

  it("removes only what this app created, never a stranger's file in the same folder", async () => {
    // `LIROVO_DATA_DIR` is an env var. A recursive delete of whatever it points
    // at turns `LIROVO_DATA_DIR=$HOME` plus one confirmation into an erased
    // home directory, so the delete names its children instead.
    await mkdir(path.join(paths.data, "Documents"), { recursive: true });
    await writeFile(path.join(paths.data, "Documents", "thesis.pdf"), "years of work");
    await writeFile(path.join(paths.data, ".zshrc"), "not ours");
    await mkdir(paths.runs, { recursive: true });
    await writeFile(path.join(paths.runs, "run_1"), "ours");

    await purgeEverything(paths);

    await expect(readFile(path.join(paths.data, "Documents", "thesis.pdf"), "utf8")).resolves.toBe("years of work");
    await expect(readFile(path.join(paths.data, ".zshrc"), "utf8")).resolves.toBe("not ours");
    expect(await readdir(paths.runs)).toEqual([]);
  });
});

describe("withinDataDir", () => {
  it("accepts the directory itself and anything under it", () => {
    expect(withinDataDir("/Users/x/Lirovo", "/Users/x/Lirovo")).toBe(true);
    expect(withinDataDir("/Users/x/Lirovo/runs/run_1/frames/0.jpg", "/Users/x/Lirovo")).toBe(true);
  });

  it("refuses anything outside, including the traversal that looks inside", () => {
    expect(withinDataDir("/etc/passwd", "/Users/x/Lirovo")).toBe(false);
    expect(withinDataDir("/Users/x/Lirovo/../.ssh/id_rsa", "/Users/x/Lirovo")).toBe(false);
    expect(withinDataDir("/Users/x/Lirovo-other/secret", "/Users/x/Lirovo")).toBe(false);
  });

  it("refuses a sibling whose name merely starts the same way", () => {
    // The prefix check has to include the separator or `Lirovo-backup` passes.
    expect(withinDataDir("/Users/x/Lirovoo/f", "/Users/x/Lirovo")).toBe(false);
  });
});
