import { describe, expect, it } from "vitest";
import {
  eventStage,
  progressDuration,
  progressSteps,
  progressStory,
  type LiveStage,
} from "./progress-model";
import type { Stage } from "@lirovo/contracts";
import type { StageAttempt } from "../../bridge/contract";

const recorded: StageAttempt[] = [
  ["normalize", 1],
  ["scene-detect", 10],
  ["dedup", 1],
  ["asr", 3],
  ["vision", 347],
  ["graph", 328],
  ["reason", 64],
].map(([stage, duration]) => ({
  stage: String(stage),
  attempt: 1,
  status: "done",
  startedAt: 100,
  finishedAt: 100 + Number(duration),
  errorCode: null,
  errorMessage: null,
}));
describe("observed extraction progress presentation", () => {
  it("uses the recorded terminal result over an old activity event", () => {
    const live = new Map<Stage, LiveStage>([
      ["vision", { state: "active", meta: "old" }],
    ]);
    expect(
      progressSteps("succeeded", live, recorded).find(
        (s) => s.stage === "vision",
      ),
    ).toMatchObject({ kind: "done", meta: "5m 47s" });
  });
  it("does not present the absent ingest record as unfinished on a completed extraction", () => {
    const steps = progressSteps("succeeded", new Map(), recorded);
    expect(steps[0]?.kind).toBe("unrecorded");
    expect(progressStory("succeeded", steps)).toMatchObject({
      recorded: 7,
      working: false,
      title: "Your extraction is ready",
    });
    expect(steps.find((s) => s.stage === "vision")?.meta).toBe("5m 47s");
  });
  it("reports parallel listening and watching without implying a percentage", () => {
    const live = new Map<Stage, LiveStage>([
      ["asr", { state: "active", meta: "" }],
      ["vision", { state: "active", meta: "" }],
    ]);
    expect(
      progressStory("running", progressSteps("running", live, [])),
    ).toMatchObject({
      title: "Listening. Watching. Making sense.",
      working: true,
    });
    for (const status of ["failed", "cancelled", "stopped", "succeeded"])
      expect(
        progressSteps(status, live, []).some((s) => s.kind === "active"),
      ).toBe(false);
  });
  it("keeps exact progress counts and full producer notes", () => {
    const note = "Reading selected frames with complete diagnostic context";
    const event = eventStage({
      type: "stage:progress",
      runId: "test",
      stage: "vision",
      done: 3,
      total: 31,
      note,
    })!;
    const live = new Map([[event.stage, event.value]]);
    expect(event.value).toEqual({
      state: "active",
      done: 3,
      total: 31,
      meta: note,
    });
    expect(
      progressSteps("running", live, []).find((s) => s.stage === "vision")
        ?.meta,
    ).toBe(`3 / 31 · ${note}`);
  });
  it("keeps degradation distinct from failure and retains the complete error", () => {
    const event = eventStage({
      type: "stage:degraded",
      stage: "vision",
      runId: "test",
      code: "NO_VISION",
      message: "Provider unavailable; continuing with audio.",
    })!;
    expect(event.value.state).toBe("degraded");
    const steps = progressSteps(
      "succeeded",
      new Map([[event.stage, event.value]]),
      recorded,
    );
    expect(progressStory("succeeded", steps).title).toBe(
      "Ready, with a few limitations",
    );
    expect(steps.find((s) => s.stage === "vision")?.meta).toBe(
      "NO_VISION: Provider unavailable; continuing with audio.",
    );
  });
  it("chooses the latest attempt by attempt number, without changing the record order", () => {
    const attempts = [
      { ...recorded[0]!, attempt: 2 },
      { ...recorded[0]!, attempt: 1, status: "failed", errorCode: "RETRY" },
    ];
    const original = JSON.stringify(attempts);
    expect(
      progressSteps("succeeded", new Map(), attempts).find(
        (s) => s.stage === "normalize",
      ),
    ).toMatchObject({ kind: "done", meta: "1s · 2 attempts" });
    expect(JSON.stringify(attempts)).toBe(original);
  });
  it("does not call a cancelled run a success or leave an activity running", () => {
    const live = new Map<Stage, LiveStage>([
      ["reason", { state: "active", meta: "" }],
    ]);
    expect(
      progressStory("cancelled", progressSteps("cancelled", live, [])),
    ).toMatchObject({
      title: "Extraction cancelled",
      working: false,
      successful: false,
    });
    expect(
      eventStage({ type: "run:cancelled", runId: "test", stage: "reason" }),
    ).toBe(null);
  });
  it("distinguishes skipped from unknown and normalizes durations", () => {
    const event = eventStage({
      type: "stage:skipped",
      runId: "test",
      stage: "vision",
      why: "No visual backend",
    })!;
    expect(
      progressSteps("running", new Map([[event.stage, event.value]]), []).find(
        (s) => s.stage === "vision",
      ),
    ).toMatchObject({ kind: "skipped", meta: "No visual backend" });
    expect(progressDuration(59.9)).toBe("1m 0s");
    expect(progressDuration(0)).toBe("0s");
  });
});
