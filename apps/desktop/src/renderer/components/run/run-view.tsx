import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Stage } from "@lirovo/contracts";
import type { RunArtifacts, RunDetail, ValueRow } from "../../../main/ipc.js";
import { RunProgress, type LiveStage } from "../RunProgress";
import { cn } from "../../lib/cn";
import { useLens } from "./lens";
import { Player } from "./player";
import { FramesTab, GraphTab, TranscriptTab, ValuesTab } from "./tabs";

type Pane = "extracted" | "transcript" | "frames" | "graph";

const EMPTY: RunArtifacts = {
  videoUrl: null,
  durationS: null,
  transcript: null,
  frames: [],
  analyses: [],
  graph: null,
};

/**
 * A finished run, seen four ways.
 *
 * Values, transcript, frames and graph are projections of one recording, so
 * they share one player and one clock: a timecode clicked in any of them moves
 * the same video, and every other view follows. That is the product's actual
 * claim — a value you can watch being said — and it only reads as true if the
 * evidence is one click from the number.
 *
 * Panes that have no content are not rendered. A tab that opens onto "nothing
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
    let live = true;
    void window.lirovo.runArtifacts(detail.runId).then((answer) => {
      if (live && answer.ok) setArtifacts(answer.value);
    });
    return () => {
      live = false;
    };
  }, [detail.runId]);

  const shown = artifacts ?? EMPTY;

  // One mark per evidence span, so the timeline shows where the answers came
  // from rather than merely how long the video is.
  const marks = useMemo(
    () => values.flatMap((v) => v.evidence.map((e) => ({ t: e.tStart, label: v.fieldPath }))),
    [values],
  );

  const panes: { key: Pane; label: string; count: number | null }[] = [
    { key: "extracted", label: "Extracted", count: values.length },
    { key: "transcript", label: "Transcript", count: shown.transcript?.segments.length ?? 0 },
    { key: "frames", label: "Frames", count: shown.frames.filter((f) => f.kept).length },
    { key: "graph", label: "Graph", count: shown.graph?.nodes.length ?? 0 },
  ];
  const available = panes.filter((p) => p.key === "extracted" || (p.count ?? 0) > 0);
  const active = available.some((p) => p.key === pane) ? pane : "extracted";

  return (
    <div className="grid gap-4">
      <RunProgress
        status={detail.status}
        live={live}
        attempts={detail.stages}
        errorCode={detail.errorCode}
        errorMessage={detail.errorMessage}
      />

      <Player artifacts={shown} lens={lens} marks={marks} />

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
            {p.count !== null && <span className="text-ink-subtle ml-1.5 text-xs tabular-nums">{p.count}</span>}
            {active === p.key && (
              <motion.span layoutId="run-pane" className="bg-ink-strong absolute inset-x-2 -bottom-px h-0.5" />
            )}
          </button>
        ))}
      </div>

      {active === "extracted" && <ValuesTab detail={detail} values={values} lens={lens} />}
      {active === "transcript" && <TranscriptTab artifacts={shown} lens={lens} />}
      {active === "frames" && <FramesTab artifacts={shown} lens={lens} />}
      {active === "graph" && <GraphTab artifacts={shown} lens={lens} />}
    </div>
  );
}
