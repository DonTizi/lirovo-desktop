import { describe, expect, it } from "vitest";
import { canExtract, modelStep, onboardingSteps, recommendBackend, speechStep, toolsStep } from "./onboarding.js";
import type { AsrProbe, BackendStatus } from "./doctor.js";
import type { BinaryStatus } from "./dependencies.js";

const dep = (over: Partial<BinaryStatus> & { id: string }): BinaryStatus => ({
  found: true, path: "/x", origin: "bundled", version: "1", required: true,
  why: "why", stale: null, fix: null, ...over,
}) as BinaryStatus;

const backend = (over: Partial<BackendStatus> & { id: string }): BackendStatus => ({
  available: true, version: "1", reason: null, fix: null,
  nativeJsonSchema: true, images: "inline", spawnsProcessPerCall: false, ...over,
}) as BackendStatus;

const asr = (over: Partial<AsrProbe> & { name: string }): AsrProbe => ({
  forUrl: false, forFile: false, hint: null, ...over,
});

describe("toolsStep", () => {
  it("is done and says so when everything came with the app", () => {
    const step = toolsStep([dep({ id: "ffmpeg" }), dep({ id: "ffprobe" })]);
    expect(step.state).toBe("done");
    expect(step.headline).toBe("all bundled with the app");
  });

  it("blocks on a missing required tool, because nothing can run without it", () => {
    const step = toolsStep([dep({ id: "ffmpeg", found: false }), dep({ id: "ffprobe" })]);
    expect(step.state).toBe("blocked");
    expect(step.headline).toMatch(/nothing can be extracted/);
  });

  it("does not block on a missing optional tool", () => {
    // yt-dlp only matters for links. Turning the whole first screen red over it
    // would tell someone extracting local files that they cannot proceed.
    const step = toolsStep([dep({ id: "ffmpeg" }), dep({ id: "ffprobe" }), dep({ id: "yt-dlp", required: false, found: false })]);
    expect(step.state).toBe("attention");
    expect(step.headline).toMatch(/local files still work/);
  });
});

describe("speechStep", () => {
  it("is done when both link and file transcription are covered", () => {
    expect(speechStep([asr({ name: "captions", forUrl: true }), asr({ name: "whisper-cpp", forUrl: true, forFile: true })]).state).toBe("done");
  });

  it("names the missing half rather than just saying partial", () => {
    const step = speechStep([asr({ name: "captions", forUrl: true })]);
    expect(step.state).toBe("attention");
    expect(step.headline).toMatch(/speech model/);
  });

  it("blocks when nothing can transcribe at all", () => {
    expect(speechStep([asr({ name: "captions" })]).state).toBe("blocked");
  });
});

describe("recommendBackend", () => {
  it("honours a stored choice that is actually running", () => {
    const pick = recommendBackend([backend({ id: "ollama" }), backend({ id: "codex" })], "codex");
    expect(pick.id).toBe("codex");
    expect(pick.why).toMatch(/your choice/);
  });

  it("does not present a stored choice that has quit as being in force", () => {
    // The whole point: naming the backend that will run, not the one on file.
    const pick = recommendBackend([backend({ id: "ollama" }), backend({ id: "codex", available: false })], "codex");
    expect(pick.id).toBe("ollama");
    expect(pick.why).toMatch(/codex is not running/);
  });

  it("prefers a backend that can read frames over one that cannot", () => {
    // The pipeline hands frames to it. A text-only backend works with the
    // visual half of every video discarded, which is not a tie.
    const pick = recommendBackend([backend({ id: "text-only", images: "none" }), backend({ id: "sighted" })], null);
    expect(pick.id).toBe("sighted");
    expect(pick.why).toMatch(/read frames/);
  });

  it("says out loud when the only option is text-only", () => {
    const pick = recommendBackend([backend({ id: "text-only", images: "none" })], null);
    expect(pick.id).toBe("text-only");
    expect(pick.why).toMatch(/frames are skipped/);
  });

  it("warns when the stored choice is running but blind", () => {
    const pick = recommendBackend([backend({ id: "text-only", images: "none" })], "text-only");
    expect(pick.why).toMatch(/frames are skipped/);
  });

  it("has nothing to recommend when nothing runs", () => {
    const pick = recommendBackend([backend({ id: "ollama", available: false })], null);
    expect(pick.id).toBeNull();
    expect(pick.why).toMatch(/cannot start/);
  });
});

describe("naming", () => {
  it("hands the backend id back rather than composing a display name", () => {
    // The card shows "Ollama" in the row beneath. A headline that said
    // "local — your choice" would be two names for one thing, in one card.
    const step = modelStep([backend({ id: "local" })], "local");
    expect(step.subject).toBe("local");
    expect(step.headline).not.toContain("local");
  });

  it("has no subject when there is nothing to name", () => {
    expect(toolsStep([dep({ id: "ffmpeg" }), dep({ id: "ffprobe" })]).subject).toBeNull();
    expect(speechStep([]).subject).toBeNull();
  });
});

describe("the three steps together", () => {
  const green = {
    dependencies: [dep({ id: "ffmpeg" }), dep({ id: "ffprobe" })],
    asr: [asr({ name: "whisper-cpp", forUrl: true, forFile: true })],
    backends: [backend({ id: "ollama" })],
    defaultBackendId: null,
  };

  it("is three steps, in the order a first launch meets them", () => {
    expect(onboardingSteps(green).map((s) => s.id)).toEqual(["tools", "speech", "model"]);
  });

  it("lets a fully green machine extract", () => {
    expect(canExtract(onboardingSteps(green))).toBe(true);
  });

  it("does not let a machine with no model extract", () => {
    const steps = onboardingSteps({ ...green, backends: [backend({ id: "ollama", available: false })] });
    expect(canExtract(steps)).toBe(false);
    expect(modelStep([backend({ id: "ollama", available: false })], null).state).toBe("blocked");
  });

  it("still lets a machine with only an optional gap extract", () => {
    // attention is not blocked, and conflating them is how a screen goes red
    // over something that changes nothing.
    const steps = onboardingSteps({ ...green, asr: [asr({ name: "captions", forUrl: true })] });
    expect(steps[1]?.state).toBe("attention");
    expect(canExtract(steps)).toBe(true);
  });
});
