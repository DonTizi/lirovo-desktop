import { useState } from "react";
import { ChevronRight, Pause, Play } from "lucide-react";
import type { Stage } from "@lirovo/contracts";
import type { StageAttempt } from "../../bridge/contract.js";
import {
  CHAPTERS,
  STAGE_COPY,
  progressSteps,
  progressStory,
  type LiveStage,
  type ProgressKind,
} from "./progress-model";
export type { LiveStage } from "./progress-model";

const STATE_LABEL: Record<ProgressKind, string> = {
  done: "Complete",
  active: "In progress",
  waiting: "Up next",
  failed: "Failed",
  skipped: "Not needed",
  degraded: "Limited",
  stopped: "Interrupted",
  unrecorded: "Not recorded",
};

/** A truthful activity story; the complete processing record stays one disclosure away. */
export function RunProgress({
  status,
  live,
  attempts,
  errorCode,
  errorMessage,
  compact = false,
  resultCount,
}: {
  status: string;
  live: ReadonlyMap<Stage, LiveStage>;
  attempts: readonly StageAttempt[];
  errorCode?: string | null;
  errorMessage?: string | null;
  compact?: boolean;
  resultCount?: number;
}): JSX.Element {
  const [motionPaused, setMotionPaused] = useState(false);
  const steps = progressSteps(status, live, attempts);
  const story = progressStory(status, steps);
  const stageKey = story.active.map((step) => step.stage).join("-") || status;
  return (
    <section
      className={`extraction-story${compact ? " extraction-story-compact" : ""}`}
      data-working={story.working}
      data-motion-paused={motionPaused}
      aria-label="Extraction processing"
    >
      <div className="extraction-eyebrow">
        <span>
          {story.working ? "EXTRACTION IN PROGRESS" : "PROCESSING SUMMARY"}
        </span>
        {story.working && (
          <button
            className="extraction-motion-toggle"
            aria-label={
              motionPaused
                ? "Resume progress animation"
                : "Pause progress animation"
            }
            aria-pressed={motionPaused}
            onClick={() => setMotionPaused((value) => !value)}
          >
            {motionPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>
        )}
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="extraction-status"
      >
        <div key={stageKey} className="extraction-copy-enter">
          <h2 className={story.working ? "extraction-shimmer" : ""}>
            {story.title}
          </h2>
          <p>{story.description}</p>
        </div>
      </div>
      {story.working ? (
        <>
          <div className="extraction-live-notes">
            {story.active.map((step) => (
              <p key={step.stage}>
                <span>{STAGE_COPY[step.stage].label}</span>
                {step.meta && (
                  <span className="extraction-live-meta">{step.meta}</span>
                )}
              </p>
            ))}
          </div>
          <ol
            className="extraction-chapters"
            aria-label="Extraction milestones"
          >
            {CHAPTERS.map((chapter, index) => {
              const members = steps.filter((step) =>
                chapter.stages.includes(step.stage),
              );
              const active = members.some((step) => step.kind === "active");
              const completed = members.every(
                (step) =>
                  step.kind === "done" ||
                  step.kind === "skipped" ||
                  step.kind === "degraded",
              );
              return (
                <li
                  key={chapter.label}
                  data-active={active}
                  data-complete={completed}
                  aria-current={active ? "step" : undefined}
                >
                  <span
                    className="extraction-chapter-line"
                    aria-hidden="true"
                  />
                  <span className="extraction-chapter-number">
                    0{index + 1}
                  </span>
                  <span>{chapter.label}</span>
                  <span className="sr-only">
                    :{" "}
                    {active
                      ? "In progress"
                      : completed
                        ? "Complete"
                        : "Pending"}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <div className="extraction-outcome">
          <span
            className="extraction-outcome-dot"
            data-success={story.successful && !story.partial}
            aria-hidden="true"
          />
          {resultCount !== undefined && (
            <span>
              {resultCount} extracted {resultCount === 1 ? "value" : "values"}
            </span>
          )}
          <span>
            {story.recorded} completed {story.recorded === 1 ? "step" : "steps"}
          </span>
        </div>
      )}
      <details
        className="extraction-record"
        key={`${story.working}-${story.successful}`}
        open={!story.working && !story.successful ? true : undefined}
      >
        <summary>
          <ChevronRight size={13} aria-hidden="true" />
          <span>
            {story.working ? "Follow the processing" : "Processing notes"}
          </span>
          <span className="extraction-record-count">{steps.length} steps</span>
        </summary>
        <ol className="extraction-timeline">
          {steps.map((step, index) => (
            <li key={step.stage} data-state={step.kind}>
              <span className="extraction-step-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="extraction-step-title">
                  <span>{STAGE_COPY[step.stage].label}</span>
                  <span className="extraction-step-state">
                    {STATE_LABEL[step.kind]}
                  </span>
                </div>
                {step.meta && <p>{step.meta}</p>}
              </div>
            </li>
          ))}
        </ol>
      </details>
      {errorMessage && (
        <div className="extraction-error" role="alert">
          <p>{errorMessage}</p>
          {errorCode && <code>{errorCode}</code>}
        </div>
      )}
    </section>
  );
}
