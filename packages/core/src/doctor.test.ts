import { describe, expect, it } from "vitest";
import type { InferenceBackend } from "@lirovo/contracts";
import { runDoctor } from "./doctor.js";
import type { BinaryStatus, DependencySpec } from "./dependencies.js";
import type { LirovoPaths } from "./paths.js";

const paths: LirovoPaths = {
  data: "/tmp/lirovo",
  runs: "/tmp/lirovo/runs",
  models: "/tmp/lirovo/models",
  bundledBin: null,
  dbFile: "/tmp/lirovo/lirovo.db",
};

const spec = (id: DependencySpec["id"], required: boolean): DependencySpec => ({
  id,
  required,
  why: "test",
  versionArgs: ["--version"],
});

const found = (spec: DependencySpec): BinaryStatus => ({
  id: spec.id,
  found: true,
  path: `/usr/bin/${spec.id}`,
  origin: "path",
  version: "1.0",
  required: spec.required,
  why: spec.why,
});

const missing = (spec: DependencySpec): BinaryStatus => ({ ...found(spec), found: true, path: null, origin: null, version: null });

const backend = (
  id: string,
  available: boolean,
  caps: Partial<InferenceBackend["capabilities"]> = {},
): InferenceBackend => ({
  id,
  capabilities: { nativeJsonSchema: false, images: true, spawnsProcessPerCall: false, ...caps },
  detect: async () => ({ available, version: available ? "1.0" : null }),
  complete: async () => {
    throw new Error("not used in doctor");
  },
});

const bothKinds = async () => [{ name: "whisper-cpp", forUrl: true, forFile: true, hint: null }];
const noKinds = async () => [
  { name: "captions", forUrl: false, forFile: false, hint: "install yt-dlp" },
  { name: "whisper-cpp", forUrl: false, forFile: false, hint: "no model" },
];
const urlOnly = async () => [{ name: "captions", forUrl: true, forFile: false, hint: "no model" }];

describe("runDoctor", () => {
  it("is ok when a required binary and one backend are present", async () => {
    const specs = [spec("ffmpeg", true)];
    const report = await runDoctor({
      paths,
      dependencies: specs,
      probeBinary: async (s) => found(s),
      backends: [backend("openai-compatible", true)],
      probeAsr: bothKinds,
    });
    expect(report.ok).toBe(true);
    expect(report.problems).toEqual([]);
  });

  it("blocks on a missing required binary but only warns on an optional one", async () => {
    const specs = [spec("ffmpeg", true), spec("yt-dlp", false)];
    const report = await runDoctor({
      paths,
      dependencies: specs,
      probeBinary: async (s) => ({ ...missing(s), found: false }),
      backends: [backend("openai-compatible", true)],
      probeAsr: bothKinds,
    });
    expect(report.ok).toBe(false);
    expect(report.problems.some((p) => p.startsWith("ffmpeg"))).toBe(true);
    expect(report.warnings.some((w) => w.startsWith("yt-dlp"))).toBe(true);
  });

  it("blocks when no backend is available", async () => {
    const report = await runDoctor({
      paths,
      dependencies: [],
      probeBinary: async (s) => found(s),
      backends: [backend("openai-compatible", false)],
      probeAsr: bothKinds,
    });
    expect(report.ok).toBe(false);
    expect(report.problems.join(" ")).toContain("no inference backend");
  });

  it("warns, but does not block, when the only backend cannot do frames", async () => {
    // This is the harness case: text works, vision must not be attempted.
    const report = await runDoctor({
      paths,
      dependencies: [],
      probeBinary: async (s) => found(s),
      backends: [backend("codex", true, { images: false, spawnsProcessPerCall: true })],
      probeAsr: bothKinds,
    });
    expect(report.ok).toBe(true);
    expect(report.warnings.join(" ")).toContain("audio-only");
  });

  it("survives a backend whose detect() throws", async () => {
    const exploding: InferenceBackend = {
      ...backend("broken", false),
      detect: async () => {
        throw new Error("spawn ENOENT");
      },
    };
    const report = await runDoctor({
      paths,
      dependencies: [],
      probeBinary: async (s) => found(s),
      backends: [exploding, backend("openai-compatible", true)],
      probeAsr: bothKinds,
    });
    expect(report.ok).toBe(true);
    expect(report.backends.find((b) => b.id === "broken")?.reason).toContain("ENOENT");
  });
});

describe("transcription readiness", () => {
  it("blocks when nothing can transcribe, and repeats each hint", async () => {
    const report = await runDoctor({
      paths,
      dependencies: [],
      probeBinary: async (s) => found(s),
      backends: [backend("local", true)],
      probeAsr: noKinds,
    });
    expect(report.ok).toBe(false);
    expect(report.problems.join(" ")).toContain("install yt-dlp");
    expect(report.problems.join(" ")).toContain("no model");
  });

  it("warns, not blocks, when only URLs are covered", async () => {
    const report = await runDoctor({
      paths,
      dependencies: [],
      probeBinary: async (s) => found(s),
      backends: [backend("local", true)],
      probeAsr: urlOnly,
    });
    expect(report.ok).toBe(true);
    expect(report.warnings.join(" ")).toContain("local files");
  });
});
