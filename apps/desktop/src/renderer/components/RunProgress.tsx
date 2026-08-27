import { CircleCheck, CircleDashed, CircleSlash, CircleX, Loader2, TriangleAlert } from "lucide-react";
import { STAGES, type Stage } from "@lirovo/contracts";
import type { StageAttempt } from "../../main/ipc.js";
import { Card, CardHeader } from "./primitives";
import { cn } from "../lib/cn";

/** What the live event stream currently believes about one stage. */
export interface LiveStage {
  readonly state: "waiting" | "active" | "done" | "failed" | "skipped";
  readonly meta: string;
}

type Kind = LiveStage["state"] | "stopped";

const ICON = {
  done: CircleCheck,
  failed: CircleX,
  skipped: CircleSlash,
  active: Loader2,
  stopped: TriangleAlert,
  waiting: CircleDashed,
} as const;

const TINT: Record<Kind, string> = {
  done: "text-success",
  failed: "text-danger",
  skipped: "text-ink-subtle",
  active: "text-brand animate-spin",
  stopped: "text-warning",
  waiting: "text-ink-subtle",
};

const seconds = (n: number): string => (n < 60 ? `${n.toFixed(0)}s` : `${Math.floor(n / 60)}m ${n % 60}s`);

/**
 * The live stream wins where it exists; the database answers everywhere else.
 *
 * Events only exist for a run this window watched happen. Reopening the app, or
 * opening a run somebody else's process executed, leaves the recorded attempts
 * as the only account — and that account is the one that survives, so it is
 * what a failed run is read from days later.
 */
const merge = (
  stage: Stage,
  live: LiveStage | undefined,
  attempts: readonly StageAttempt[],
  runStopped: boolean,
): { kind: Kind; meta: string } => {
  if (live !== undefined) {
    const stalled = live.state === "active" && runStopped;
    return { kind: stalled ? "stopped" : live.state, meta: stalled ? "stopped here" : live.meta };
  }

  const mine = attempts.filter((a) => a.stage === stage);
  const last = mine[mine.length - 1];
  if (last === undefined) return { kind: "waiting", meta: "" };

  const tries = mine.length > 1 ? ` · ${mine.length} attempts` : "";
  if (last.status === "done") {
    const took = last.finishedAt === null ? "" : seconds(last.finishedAt - last.startedAt);
    return { kind: "done", meta: `${took}${tries}` };
  }
  if (last.status === "failed") {
    return { kind: "failed", meta: `${last.errorCode ?? "failed"}${tries}` };
  }
  if (last.status === "degraded") {
    return { kind: "skipped", meta: last.errorMessage ?? "degraded" };
  }
  // Written 'running' and never closed: the process that owned it is gone.
  return runStopped ? { kind: "stopped", meta: "stopped here" } : { kind: "active", meta: `${tries}`.trim() };
};

function StageRow({ stage, kind, meta }: { stage: Stage; kind: Kind; meta: string }): JSX.Element {
  const Icon = ICON[kind];
  return (
    <div
      className={cn(
        "border-hairline flex items-center gap-2.5 border-b px-4 py-2 text-sm last:border-b-0",
        (kind === "waiting" || kind === "skipped") && "opacity-55",
      )}
    >
      <Icon size={15} className={TINT[kind]} />
      <span className={cn("flex-1", kind === "active" ? "text-ink-strong font-medium" : "text-ink-label")}>{stage}</span>
      <span className="text-ink-subtle tabular-nums text-xs">{meta}</span>
    </div>
  );
}

/**
 * What happened, and where it stopped happening.
 *
 * Shown for every run, not only the one in flight: the recorded attempts are
 * the troubleshooting record, and a failed run whose only account is a red
 * badge in a list gives nobody anything to act on.
 */
export function RunProgress({
  status,
  live,
  attempts,
  errorCode,
  errorMessage,
}: {
  status: string;
  live: ReadonlyMap<Stage, LiveStage>;
  attempts: readonly StageAttempt[];
  errorCode?: string | null;
  errorMessage?: string | null;
}): JSX.Element {
  const stopped = status === "stopped";

  const headline =
    status === "running"
      ? "running"
      : stopped
        ? "stopped"
        : status === "failed"
          ? (errorCode ?? "failed")
          : status;

  return (
    <Card>
      <CardHeader
        title="Progress"
        action={<span className={cn(stopped && "text-warning-text", status === "failed" && "text-danger-text")}>{headline}</span>}
      />

      {stopped && (
        // Named plainly, because the row said RUNNING for an hour and the only
        // honest reading of that is that nothing is working on it.
        <p className="border-hairline text-warning-text border-b px-4 py-2 text-xs">
          Nothing is working on this run. The process that owned it exited — the app was quit, the
          machine slept, or it crashed. Everything finished above is on disk and will be reused.
        </p>
      )}

      <div>
        {STAGES.map((stage) => {
          const merged = merge(stage, live.get(stage), attempts, stopped);
          return <StageRow key={stage} stage={stage} kind={merged.kind} meta={merged.meta} />;
        })}
      </div>

      {errorMessage !== null && errorMessage !== undefined && errorMessage !== "" && (
        <p className="border-hairline text-danger-text border-t px-4 py-2 font-mono text-xs">
          {errorCode === null || errorCode === undefined ? errorMessage : `${errorCode}: ${errorMessage}`}
        </p>
      )}
    </Card>
  );
}
