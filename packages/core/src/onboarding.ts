import type { AsrProbe, BackendStatus } from "./doctor.js";
import type { BinaryStatus } from "./dependencies.js";

/**
 * What a first launch still has to settle, and nothing else.
 *
 * Three steps, because there are three real decisions. Everything else this
 * app needs is bundled and already green, and an assistant that walks someone
 * through screens where nothing can be done teaches them to press Next without
 * reading — including on the screen that mattered.
 *
 * Every state here is derived from the same doctor report the Settings page
 * draws, so a step cannot claim to be finished while the panel behind it says
 * otherwise.
 */

export type StepId = "tools" | "speech" | "model";

/**
 * `blocked` means the app cannot extract until it is dealt with. `attention`
 * means it works but worse — a distinction worth keeping, because collapsing
 * them into one colour is how a screen ends up all red on a machine that is
 * merely missing something optional.
 */
export type StepState = "done" | "attention" | "blocked";

export interface OnboardingStep {
  readonly id: StepId;
  readonly state: StepState;
  /** What is true right now, in one line. */
  readonly headline: string;
  /**
   * The thing the headline is about, by id, when there is one.
   *
   * An id, never a display name: what a backend is CALLED belongs to the one
   * place that names things, and composing "local — your choice" here while
   * the row underneath says "Ollama" is two names for one thing in the same
   * card. The caller labels it.
   */
  readonly subject: string | null;
}

/** ffprobe ships inside ffmpeg; two rows for it would always say the same thing. */
const REQUIRED_TOOLS = ["ffmpeg", "ffprobe"] as const;

export const toolsStep = (deps: readonly BinaryStatus[]): OnboardingStep => {
  const missingRequired = deps.filter((d) => REQUIRED_TOOLS.includes(d.id as never) && !d.found);
  if (missingRequired.length > 0) {
    return {
      id: "tools",
      state: "blocked",
      headline: `${missingRequired.map((d) => d.id).join(" and ")} missing — nothing can be extracted`,
      subject: null,
    };
  }
  const missingOptional = deps.filter((d) => !d.required && !d.found);
  if (missingOptional.length > 0) {
    return {
      id: "tools",
      state: "attention",
      headline: `${missingOptional.map((d) => d.id).join(", ")} missing — local files still work`,
      subject: null,
    };
  }
  const bundled = deps.filter((d) => d.origin === "bundled").length;
  return {
    id: "tools",
    state: "done",
    headline: bundled === deps.length ? "all bundled with the app" : `${deps.length} present`,
    subject: null,
  };
};

/**
 * Can anything be transcribed, and for which kinds of source?
 *
 * Published subtitles cover links only, and cost nothing. Whisper on this Mac
 * covers both but needs a model downloaded first — which is the one genuine
 * download a first launch still has to make.
 */
export const speechStep = (probes: readonly AsrProbe[]): OnboardingStep => {
  const forFile = probes.some((p) => p.forFile);
  const forUrl = probes.some((p) => p.forUrl);
  if (forFile && forUrl) return { id: "speech", state: "done", headline: "links and local files", subject: null };
  if (forUrl) {
    return {
      id: "speech",
      state: "attention",
      headline: "links only — a speech model is what covers files on this Mac",
      subject: null,
    };
  }
  if (forFile) return { id: "speech", state: "attention", headline: "local files only", subject: null };
  return { id: "speech", state: "blocked", headline: "nothing can be transcribed yet", subject: null };
};

export interface Recommendation {
  readonly id: string | null;
  /** Why this one, in the terms that decided it. */
  readonly why: string;
}

/**
 * Which model will actually run the next extraction.
 *
 * Not which one is stored: a preference pointing at something that has since
 * quit should never be presented as being in force. And a backend that cannot
 * read images is ranked below one that can, because the pipeline hands frames
 * to it — a text-only backend works, with the visual half of every video
 * thrown away.
 */
export const recommendBackend = (
  backends: readonly BackendStatus[],
  stored: string | null,
): Recommendation => {
  const live = backends.filter((b) => b.available);
  if (live.length === 0) {
    return { id: null, why: "none of them are running — extraction cannot start without one" };
  }

  const chosen = live.find((b) => b.id === stored);
  if (chosen !== undefined) {
    return chosen.images === "none"
      ? { id: chosen.id, why: "your choice, and it reads text only — frames are skipped" }
      : { id: chosen.id, why: "your choice, and it is running" };
  }

  const sighted = live.find((b) => b.images !== "none");
  if (sighted !== undefined) {
    return stored === null
      ? { id: sighted.id, why: "running, and it can read frames" }
      : { id: sighted.id, why: `${stored} is not running, so this one takes over` };
  }
  return {
    id: live[0]?.id ?? null,
    why: "the only one running, and it reads text only — frames are skipped",
  };
};

export const modelStep = (backends: readonly BackendStatus[], stored: string | null): OnboardingStep => {
  const pick = recommendBackend(backends, stored);
  return pick.id === null
    ? { id: "model", state: "blocked", headline: pick.why, subject: null }
    : { id: "model", state: "done", headline: pick.why, subject: pick.id };
};

/** The three, in the order a first launch meets them. */
export const onboardingSteps = (input: {
  readonly dependencies: readonly BinaryStatus[];
  readonly asr: readonly AsrProbe[];
  readonly backends: readonly BackendStatus[];
  readonly defaultBackendId: string | null;
}): readonly OnboardingStep[] => [
  toolsStep(input.dependencies),
  speechStep(input.asr),
  modelStep(input.backends, input.defaultBackendId),
];

/** Can this machine actually extract? The only question the last screen answers. */
export const canExtract = (steps: readonly OnboardingStep[]): boolean =>
  steps.every((s) => s.state !== "blocked");
