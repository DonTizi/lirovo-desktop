import { STAGES, type Stage, type PipelineEvent } from "@lirovo/contracts";
import type { StageAttempt } from "../../bridge/contract.js";

export interface LiveStage {
  readonly state:
    "waiting" | "active" | "done" | "failed" | "skipped" | "degraded";
  readonly meta: string;
  readonly done?: number;
  readonly total?: number;
}
export type ProgressKind = LiveStage["state"] | "stopped" | "unrecorded";
export interface ProgressStep {
  stage: Stage;
  kind: ProgressKind;
  meta: string;
}

export const STAGE_COPY: Record<
  Stage,
  { label: string; active: string; description: string }
> = {
  ingest: {
    label: "Source",
    active: "Bringing your video into focus",
    description: "Opening the recording and preparing it for analysis.",
  },
  normalize: {
    label: "Media preparation",
    active: "Preparing the sound and picture",
    description:
      "Converting the recording into media the extraction engine can read.",
  },
  "scene-detect": {
    label: "Scene detection",
    active: "Finding the moments that matter",
    description: "Locating scene changes across the recording.",
  },
  dedup: {
    label: "Frame selection",
    active: "Giving each scene a clearer view",
    description: "Removing repeated frames before visual analysis.",
  },
  asr: {
    label: "Transcription",
    active: "Listening to your recording",
    description: "Turning speech into a timestamped transcript.",
  },
  vision: {
    label: "Visual analysis",
    active: "Reading between the frames",
    description: "Examining the selected frames for visual context.",
  },
  graph: {
    label: "Connections",
    active: "Connecting the ideas",
    description:
      "Organizing the source material into entities and relationships.",
  },
  reason: {
    label: "Extraction",
    active: "Shaping the final answers",
    description:
      "Reasoning over the source material to fill your selected fields.",
  },
};
export const CHAPTERS: { label: string; stages: readonly Stage[] }[] = [
  {
    label: "Prepare",
    stages: ["ingest", "normalize", "scene-detect", "dedup"],
  },
  { label: "Understand", stages: ["asr", "vision"] },
  { label: "Connect", stages: ["graph"] },
  { label: "Extract", stages: ["reason"] },
];
export const isWorking = (status: string): boolean =>
  ["running", "claimed", "queued", "pending"].includes(status);
export const isSuccessful = (status: string): boolean =>
  ["succeeded", "finished"].includes(status);
export function progressDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  return rounded < 60
    ? `${rounded}s`
    : `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}

/** Preserve producer facts; optional degradation is not a failed extraction. */
export function eventStage(
  event: PipelineEvent,
): { stage: Stage; value: LiveStage } | null {
  switch (event.type) {
    case "stage:start":
      return {
        stage: event.stage,
        value: {
          state: "active",
          meta: event.attempt > 1 ? `Attempt ${event.attempt}` : "",
        },
      };
    case "stage:progress":
      return {
        stage: event.stage,
        value: {
          state: "active",
          done: event.done,
          total: event.total,
          meta: event.note ?? "",
        },
      };
    case "stage:resumed":
      return {
        stage: event.stage,
        value: { state: "done", meta: "Reused from an earlier run" },
      };
    case "stage:done":
      return {
        stage: event.stage,
        value: { state: "done", meta: progressDuration(event.ms / 1000) },
      };
    case "stage:skipped":
      return {
        stage: event.stage,
        value: { state: "skipped", meta: event.why },
      };
    case "stage:degraded":
      return {
        stage: event.stage,
        value: { state: "degraded", meta: `${event.code}: ${event.message}` },
      };
    case "run:failed":
      return event.stage === null
        ? null
        : {
            stage: event.stage,
            value: { state: "failed", meta: `${event.code}: ${event.message}` },
          };
    default:
      return null;
  }
}

export function progressSteps(
  status: string,
  live: ReadonlyMap<Stage, LiveStage>,
  attempts: readonly StageAttempt[],
): ProgressStep[] {
  const working = isWorking(status);
  return STAGES.map((stage) => {
    const current = live.get(stage);
    const mine = attempts
      .filter((attempt) => attempt.stage === stage)
      .sort((a, b) => a.attempt - b.attempt);
    const last = mine[mine.length - 1];
    let kind: ProgressKind = working ? "waiting" : "unrecorded";
    let meta = "";
    const recordedTerminal =
      last && ["done", "failed", "degraded"].includes(last.status);
    const staleActivity =
      !working &&
      recordedTerminal &&
      (current?.state === "active" || current?.state === "waiting");
    if (current && !staleActivity) {
      kind = current.state;
      meta =
        current.done !== undefined && current.total !== undefined
          ? `${current.done} / ${current.total}${current.meta ? ` · ${current.meta}` : ""}`
          : current.meta;
    } else if (last) {
      kind =
        last.status === "done"
          ? "done"
          : last.status === "failed"
            ? "failed"
            : last.status === "degraded"
              ? "degraded"
              : "active";
      meta =
        last.status === "done" && last.finishedAt !== null
          ? progressDuration(last.finishedAt - last.startedAt)
          : [last.errorCode, last.errorMessage].filter(Boolean).join(": ");
      if (mine.length > 1)
        meta += `${meta ? " · " : ""}${mine.length} attempts`;
    }
    if (!working && kind === "active")
      kind = isSuccessful(status) ? "unrecorded" : "stopped";
    if (!working && kind === "waiting") kind = "unrecorded";
    return { stage, kind, meta };
  });
}

export function progressStory(status: string, steps: readonly ProgressStep[]) {
  const active = steps.filter((step) => step.kind === "active");
  const current = active[active.length - 1];
  const successful = isSuccessful(status);
  const working = isWorking(status);
  const partial = steps.some(
    (step) => step.kind === "degraded" || step.kind === "failed",
  );
  const title = working
    ? active.some((step) => step.stage === "asr") &&
      active.some((step) => step.stage === "vision")
      ? "Listening. Watching. Making sense."
      : current
        ? STAGE_COPY[current.stage].active
        : "Getting your extraction ready"
    : successful
      ? partial
        ? "Ready, with a few limitations"
        : "Your extraction is ready"
      : status === "cancelled"
        ? "Extraction cancelled"
        : status === "stopped"
          ? "Extraction paused unexpectedly"
          : "This extraction needs attention";
  const description = working
    ? active.length > 1
      ? active.map((step) => STAGE_COPY[step.stage].description).join(" ")
      : current
        ? STAGE_COPY[current.stage].description
        : "Waiting for the extraction engine to begin."
    : successful
      ? "Explore the results and follow their links back to the source."
      : status === "cancelled"
        ? "The extraction was cancelled. No further processing is running."
        : status === "stopped"
          ? "The process ended before finishing. Completed work remains available on this device."
          : "Review the processing notes below to see what interrupted the run.";
  return {
    title,
    description,
    working,
    successful,
    partial,
    active,
    recorded: steps.filter((step) => step.kind === "done").length,
  };
}
