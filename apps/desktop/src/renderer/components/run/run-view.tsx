import { useEffect, useId, useMemo, useState } from "react";
import { Film } from "lucide-react";
import type { Stage } from "@lirovo/contracts";
import type { ReviewSnapshot } from "@lirovo/node-runtime";
import type {
  RunArtifacts,
  RunDetail,
  ValueRow,
} from "../../../bridge/contract.js";
import { RunProgress, type LiveStage } from "../RunProgress";
import { isWorking, progressSteps } from "../progress-model";
import { pollSerial } from "../../lib/poll";
import { Skeleton } from "../primitives";
import { cn } from "../../lib/cn";
import { formatTime, useLens } from "./lens";
import { Player } from "./player";
import { ExportResults } from "./ExportResults";
import { GraphView } from "./graph-view";
import { FramesTab, GraphNodes, TranscriptTab, ValuesTab } from "./tabs";

type Pane = "extracted" | "transcript" | "frames" | "graph";

const EMPTY: RunArtifacts = {
  videoUrl: null,
  audioUrl: null,
  durationS: null,
  transcript: null,
  frames: [],
  analyses: [],
  graph: null,
};

/**
 * A live or finished run, seen four ways, with the recording beside them.
 *
 * Side by side rather than stacked: the whole point is to check a value
 * against the moment that proves it, and a layout that puts the video above
 * the evidence makes that a scroll each way. The player stays put while the
 * results change, which is what makes clicking through twenty timecodes
 * bearable.
 *
 * Panes with nothing in them are not rendered. A tab that opens onto "nothing
 * here" costs a click to learn what its absence could have said for free.
 */
export function RunView({
  detail,
  values,
  live,
  initialTime = 0,
  onReviewSaved,
}: {
  detail: RunDetail;
  values: readonly ValueRow[];
  live: ReadonlyMap<Stage, LiveStage>;
  initialTime?: number;
  onReviewSaved?: () => void;
}): JSX.Element {
  const [reviews, setReviews] = useState<ReadonlyMap<string, ReviewSnapshot>>(new Map());
  useEffect(() => { setReviews(new Map()); }, [detail.runId]);
  const reviewedRow = (row: ValueRow): ValueRow => {
    const local = reviews.get(row.observationId);
    if (!local || local.revision <= (row.review?.revision ?? 0)) return row;
    return { ...row, value: JSON.stringify(local.value), originalValue: local.originalValue, review: local };
  };
  const reviewedDetail = { ...detail, values: detail.values.map(reviewedRow) };
  const saveReview = (id: string, review: ReviewSnapshot) => {
    setReviews((current) => new Map(current).set(id, review));
    onReviewSaved?.();
  };
  const [artifacts, setArtifacts] = useState<RunArtifacts | null>(null);
  const [pane, setPane] = useState<Pane>("extracted");
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const tabId = useId();
  const lens = useLens(initialTime);
  const working = isWorking(detail.status);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      await window.lirovo
        .runArtifacts(detail.runId)
        .then((answer) => {
          if (!alive) return;
          if (answer.ok) {
            setArtifacts(answer.value);
            setArtifactError(null);
          } else
            setArtifactError(
              "The recording and supporting files could not be loaded. Your extracted results are still available.",
            );
        })
        .catch(() => {
          if (alive)
            setArtifactError(
              "The recording and supporting files could not be loaded. Your extracted results are still available.",
            );
        });
    };
    // Keep the last good artifacts/player mounted while new files arrive.
    const stop = working ? pollSerial(refresh) : (void refresh(), () => {});
    return () => {
      alive = false;
      stop();
    };
  }, [detail.runId, detail.status, working, reload]);

  const loading = artifacts === null && artifactError === null;
  const shown = artifacts ?? EMPTY;
  // ffmpeg creates the MP4 before it has finalized its playable headers.
  const mediaReady =
    detail.status === "succeeded" ||
    progressSteps(detail.status, live, detail.stages).some(
      (s) => s.stage === "normalize" && s.kind === "done",
    );
  const playable = mediaReady
    ? shown
    : { ...shown, videoUrl: null, audioUrl: null };

  // One mark per evidence span, so the timeline shows where the answers came
  // from rather than merely how long the video is.
  const marks = useMemo(
    () =>
      detail.values.flatMap((v) =>
        v.evidence.map((e) => ({ t: e.tStart, label: v.fieldPath })),
      ),
    [detail.values],
  );

  const panes: { key: Pane; label: string; count: number }[] = [
    { key: "extracted", label: "Results", count: values.length },
    {
      key: "transcript",
      label: "Transcript",
      count: shown.transcript?.segments.length ?? 0,
    },
    {
      key: "frames",
      label: "Frames",
      count: shown.frames.filter((f) => f.kept).length,
    },
    { key: "graph", label: "Graph", count: shown.graph?.nodes.length ?? 0 },
  ];
  const available = panes.filter((p) => p.key === "extracted" || p.count > 0);
  const active = available.some((p) => p.key === pane) ? pane : "extracted";

  const finished = detail.status === "succeeded";
  const currentQualityFailure = ["failed", "stopped"].includes(detail.status) && (detail.errorMessage?.includes("asr-quality-") ?? false);

  return (
    <div
      className={cn(
        "result-workspace",
        active === "graph" && "result-workspace-graph",
      )}
    >
      <div className="result-page-heading">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs text-ink-subtle">
            <Film className="size-3.5" aria-hidden="true" />{" "}
            {working ? "Live extraction" : "Extraction results"}{" "}
            {detail.durationS !== null && (
              <span>· {formatTime(detail.durationS)}</span>
            )}
          </p>
          <h1>{detail.title ?? "Untitled extraction"}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {finished && <ExportResults key={detail.runId} runId={detail.runId} />}
          <span className="result-status">
            {finished ? "Completed" : detail.status}
          </span>
        </div>
      </div>
      {artifactError !== null && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-warning/20 bg-warning/5 p-3 text-sm"
        >
          <p>{artifactError}</p>
          <button
            className="mt-2 underline"
            onClick={() => setReload((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {(shown.qualityReports?.length ?? 0) > 0 && <section className="mb-6 rounded-xl border border-warning/30 bg-warning/5 p-5" aria-label="Transcription quality review">
        <h2 className="text-sm font-medium">{currentQualityFailure ? "The transcript needs a closer look" : "Preserved transcription quality history"}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{currentQualityFailure ? "Processing stopped because the transcript may be unreliable. Try a better speech model or check the audio before resuming. " : "An earlier attempt produced a transcript that did not pass the quality checks. "}These candidates are preserved for inspection and were not used as evidence.</p>
        {shown.qualityReports?.map((report,index)=><details key={`${report.createdAt}-${index}`} className="mt-4 border-t border-hairline pt-3">
          <summary className="cursor-pointer text-sm text-ink-secondary">Inspect preserved transcript · {new Date(report.createdAt).toLocaleString()}</summary>
          <ul className="my-3 list-inside list-disc text-xs text-warning-text">{report.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>
          <p className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-base/40 p-4 text-sm leading-relaxed text-ink-secondary">{report.text}</p>
        </details>)}
      </section>}
      <div
        className={cn(
          "result-layout",
          active === "graph" && "result-layout-graph",
        )}
      >
        <div className="result-content">
          {working && (
            <div className="mb-8 border-b border-hairline pb-6">
              <RunProgress
                status={detail.status}
                live={live}
                attempts={detail.stages}
              />
              <p className="mt-4 text-xs text-ink-subtle">
                You can leave this page. Processing continues, and this review
                stays up to date.
              </p>
            </div>
          )}
          <div
            className="result-tabs"
            role="tablist"
            aria-label="Extraction views"
          >
            {available.map((p, index) => (
              <button
                key={p.key}
                role="tab"
                id={`${tabId}-${p.key}`}
                aria-selected={active === p.key}
                aria-controls={`${tabId}-panel-${p.key}`}
                tabIndex={active === p.key ? 0 : -1}
                onClick={() => setPane(p.key)}
                onKeyDown={(event) => {
                  const nextIndex =
                    event.key === "ArrowRight"
                      ? (index + 1) % available.length
                      : event.key === "ArrowLeft"
                        ? (index - 1 + available.length) % available.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? available.length - 1
                            : null;
                  if (nextIndex === null) return;
                  event.preventDefault();
                  const next = available[nextIndex];
                  if (next === undefined) return;
                  setPane(next.key);
                  document.getElementById(`${tabId}-${next.key}`)?.focus();
                }}
                className={cn("result-tab", active === p.key && "is-selected")}
              >
                {p.label}
                <span className="text-ink-subtle ml-1.5 text-xs tabular-nums">
                  {p.count}
                </span>
              </button>
            ))}
          </div>

          {available.map((p) => (
            <div
              key={p.key}
              id={`${tabId}-panel-${p.key}`}
              role="tabpanel"
              aria-labelledby={`${tabId}-${p.key}`}
              tabIndex={0}
              hidden={active !== p.key}
            >
              {active === p.key && (
                <>
                  {active === "extracted" &&
                    (working && detail.values.length === 0 ? (
                      <p className="py-6 text-sm leading-relaxed text-ink-secondary">
                        Results will appear here when they are saved. You can
                        already explore any available transcript and frames.
                      </p>
                    ) : (
                      <ValuesTab detail={reviewedDetail} values={values.map(reviewedRow)} lens={lens} onReviewSaved={saveReview} />
                    ))}
                  {!loading && active === "transcript" && (
                    <TranscriptTab artifacts={shown} lens={lens} />
                  )}
                  {!loading && active === "frames" && (
                    <FramesTab
                      artifacts={shown}
                      lens={lens}
                      working={working}
                    />
                  )}
                  {!loading && active === "graph" && (
                    <div>
                      <GraphView
                        nodes={shown.graph?.nodes ?? []}
                        edges={shown.graph?.edges ?? []}
                        lens={lens}
                      />
                      <details className="border-hairline border-t">
                        <summary className="text-ink-subtle hover:text-ink cursor-pointer list-none px-4 py-2 text-xs transition-colors">
                          List every node
                        </summary>
                        <GraphNodes artifacts={shown} lens={lens} />
                      </details>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Graph exploration gets the full width; its source remains available below. */}
        <aside className="result-recording" aria-label="Source recording">
          <div className="flex items-center justify-between text-xs text-ink-subtle">
            <h2 className="font-medium text-ink-secondary">Source recording</h2>
            <span className="font-mono">
              {formatTime(lens.t)}
              {shown.durationS !== null && ` / ${formatTime(shown.durationS)}`}
            </span>
          </div>
          {loading ? (
            <Skeleton className="h-56 w-full rounded-lg" />
          ) : (
            <Player
              artifacts={playable}
              lens={lens}
              marks={marks}
              working={working}
            />
          )}
          <p className="text-xs leading-relaxed text-ink-subtle">
            Click a timestamp to play the source. Linked evidence shows where a
            result came from, not whether it is factually correct.
          </p>

          {!working && (
            <RunProgress
              compact
              status={detail.status}
              live={live}
              attempts={detail.stages}
              errorCode={detail.errorCode}
              errorMessage={detail.errorMessage}
              resultCount={detail.values.length}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
