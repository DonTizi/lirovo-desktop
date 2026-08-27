import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { Stage } from "@lirovo/contracts";
import type { RunArtifacts, RunDetail, ValueRow } from "../../../bridge/contract.js";
import { RunProgress, type LiveStage } from "../RunProgress";
import { Card, CardHeader, Skeleton } from "../primitives";
import { cn } from "../../lib/cn";
import { useLens } from "./lens";
import { Player } from "./player";
import { GraphView } from "./graph-view";
import { FramesTab, GraphNodes, TranscriptTab, ValuesTab } from "./tabs";

type Pane = "extracted" | "transcript" | "frames" | "graph";

const EMPTY: RunArtifacts = {
  videoUrl: null,
  durationS: null,
  transcript: null,
  frames: [],
  analyses: [],
  graph: null,
};

function LoadingPanes(): JSX.Element {
  return (
    <Card className="p-4">
      <div className="grid gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * A finished run, seen four ways, with the recording beside them.
 *
 * Side by side rather than stacked: the whole point is to check a value
 * against the moment that proves it, and a layout that puts the video above
 * the evidence makes that a scroll each way. The player stays put while the
 * right column changes, which is what makes clicking through twenty timecodes
 * bearable.
 *
 * Panes with nothing in them are not rendered. A tab that opens onto "nothing
 * here" costs a click to learn what its absence could have said for free.
 */
export function RunView({
  detail,
  values,
  live,
}: {
  detail: RunDetail;
  values: readonly ValueRow[];
  live: ReadonlyMap<Stage, LiveStage>;
}): JSX.Element {
  const [artifacts, setArtifacts] = useState<RunArtifacts | null>(null);
  const [pane, setPane] = useState<Pane>("extracted");
  const lens = useLens();

  useEffect(() => {
    setArtifacts(null);
    let alive = true;
    void window.lirovo.runArtifacts(detail.runId).then((answer) => {
      if (alive && answer.ok) setArtifacts(answer.value);
    });
    return () => {
      alive = false;
    };
  }, [detail.runId]);

  const loading = artifacts === null;
  const shown = artifacts ?? EMPTY;

  // One mark per evidence span, so the timeline shows where the answers came
  // from rather than merely how long the video is.
  const marks = useMemo(
    () => values.flatMap((v) => v.evidence.map((e) => ({ t: e.tStart, label: v.fieldPath }))),
    [values],
  );

  const panes: { key: Pane; label: string; count: number }[] = [
    { key: "extracted", label: "Extracted", count: values.length },
    { key: "transcript", label: "Transcript", count: shown.transcript?.segments.length ?? 0 },
    { key: "frames", label: "Frames", count: shown.frames.filter((f) => f.kept).length },
    { key: "graph", label: "Graph", count: shown.graph?.nodes.length ?? 0 },
  ];
  const available = panes.filter((p) => p.key === "extracted" || p.count > 0);
  const active = available.some((p) => p.key === pane) ? pane : "extracted";

  // The record of how the run went is a troubleshooting artifact, not part of
  // reviewing the result. It belongs in front of somebody only while something
  // went wrong; on a run that worked it is eight green rows between the reader
  // and the answer.
  const finished = detail.status === "succeeded";

  // `lg`, not `xl`: the window opens at 1180px and its minimum is 900, so a
  // 1280px breakpoint meant the split never applied and the video stacked under
  // the data at the only size the app is actually used at.
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,40%)] lg:items-start">
      <div className="grid min-w-0 gap-3">
        <div className="border-hairline flex items-center gap-1 border-b">
          {available.map((p) => (
            <button
              key={p.key}
              onClick={() => setPane(p.key)}
              className={cn(
                "relative px-3 py-2 text-sm transition-colors",
                active === p.key ? "text-ink-strong font-medium" : "text-ink-subtle hover:text-ink",
              )}
            >
              {p.label}
              <span className="text-ink-subtle ml-1.5 text-xs tabular-nums">{p.count}</span>
              {active === p.key && (
                <motion.span layoutId="run-pane" className="bg-ink-strong absolute inset-x-2 -bottom-px h-0.5" />
              )}
            </button>
          ))}
        </div>

        {loading && <LoadingPanes />}
        {!loading && active === "extracted" && <ValuesTab detail={detail} values={values} lens={lens} />}
        {!loading && active === "transcript" && <TranscriptTab artifacts={shown} lens={lens} />}
        {!loading && active === "frames" && <FramesTab artifacts={shown} lens={lens} />}
        {!loading && active === "graph" && (
          <Card className="overflow-hidden">
            <CardHeader
              title="Knowledge graph"
              action={`${shown.graph?.nodes.length ?? 0} nodes · ${shown.graph?.edges.length ?? 0} edges`}
            />
            <GraphView nodes={shown.graph?.nodes ?? []} edges={shown.graph?.edges ?? []} lens={lens} />
            <details className="border-hairline border-t">
              <summary className="text-ink-subtle hover:text-ink cursor-pointer list-none px-4 py-2 text-xs transition-colors">
                List every node
              </summary>
              <GraphNodes artifacts={shown} lens={lens} />
            </details>
          </Card>
        )}
      </div>

      {/* The video stays put while the left column changes. It is the thing
          every pane points at, so it is the thing that must not move. */}
      <div className="grid gap-3 lg:sticky lg:top-4">
        {loading ? (
          <Skeleton className="h-56 w-full rounded-lg" />
        ) : (
          <Player artifacts={shown} lens={lens} marks={marks} />
        )}

        {finished ? (
          <details className="bg-base shadow-ring group/record rounded-lg">
            <summary className="text-ink-subtle hover:text-ink flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-xs transition-colors">
              <ChevronRight className="size-3.5 transition-transform group-open/record:rotate-90" />
              How this run went
              <span className="text-ink-placeholder ml-auto tabular-nums">
                {detail.stages.filter((a) => a.status === "done").length} stages
              </span>
            </summary>
            <RunProgress
              status={detail.status}
              live={live}
              attempts={detail.stages}
              errorCode={detail.errorCode}
              errorMessage={detail.errorMessage}
              bare
            />
          </details>
        ) : (
          <RunProgress
            status={detail.status}
            live={live}
            attempts={detail.stages}
            errorCode={detail.errorCode}
            errorMessage={detail.errorMessage}
          />
        )}
      </div>
    </div>
  );
}
