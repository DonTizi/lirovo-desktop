import { useRef } from "react";
import type { RunArtifacts, RunDetail, ValueRow } from "../../../main/ipc.js";
import { Card, CardHeader, Mono, StateLabel } from "../primitives";
import { useScrollMask } from "../../lib/useScrollMask";
import { formatTime, type Lens } from "./lens";
import { cn } from "../../lib/cn";

/** A timecode that seeks. The product's whole promise is that this works. */
export function Cue({ t, lens, tone }: { t: number; lens: Lens; tone?: "quiet" }): JSX.Element {
  return (
    <button
      onClick={() => lens.seek(t)}
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-xs tabular-nums transition-colors",
        tone === "quiet"
          ? "text-ink-subtle hover:bg-tint hover:text-ink"
          : "bg-brand-soft text-brand hover:bg-brand hover:text-ink-inverse",
      )}
    >
      {formatTime(t)}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="text-ink-subtle px-4 py-8 text-center text-sm">{children}</p>;
}

/* ------------------------------------------------------------------ values */

export function ValuesTab({
  detail,
  values,
  lens,
}: {
  detail: RunDetail;
  values: readonly ValueRow[];
  lens: Lens;
}): JSX.Element {
  const grounded = values.filter((v) => v.evidence.length > 0).length;
  return (
    <Card>
      <CardHeader
        title="Extracted"
        action={
          <span>
            {grounded} of {values.length} grounded
            {detail.transcriptEngine !== null ? ` · ${detail.transcriptEngine}` : ""}
          </span>
        }
      />
      {values.length === 0 ? (
        <Empty>Nothing was extracted. The Progress card above says where it stopped.</Empty>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-hairline border-b">
              <th className="text-ink-label w-[24%] px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                Field
              </th>
              <th className="text-ink-label w-[34%] px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                Value
              </th>
              <th className="text-ink-label px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                Proven at
              </th>
            </tr>
          </thead>
          <tbody>
            {values.map((row) => (
              <tr key={row.observationId} className="border-hairline hover:bg-elevated border-b last:border-b-0">
                <td className="px-4 py-2.5 align-top">
                  <Mono>{row.fieldPath}</Mono>
                </td>
                <td className="text-ink-strong px-4 py-2.5 align-top">{row.value.replace(/^"|"$/g, "")}</td>
                <td className="px-4 py-2.5 align-top">
                  {row.evidence.length === 0 ? (
                    <StateLabel>nothing backs this</StateLabel>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {row.evidence.map((e, i) => (
                        <div key={`${e.sourceRef}-${i}`} className="flex items-start gap-2">
                          <Cue t={e.tStart} lens={lens} />
                          <span className="text-ink-subtle min-w-0 text-xs">
                            <span className="uppercase">{e.modality}</span>
                            {e.quote !== null && e.quote !== "" ? ` · “${e.quote}”` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------- transcript */

export function TranscriptTab({ artifacts, lens }: { artifacts: RunArtifacts; lens: Lens }): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const { maskImage, onScroll } = useScrollMask(box, [artifacts.transcript?.segments.length ?? 0]);
  const segments = artifacts.transcript?.segments ?? [];

  return (
    <Card>
      <CardHeader
        title="Transcript"
        action={
          artifacts.transcript === null
            ? "none"
            : `${segments.length} segment${segments.length === 1 ? "" : "s"}${
                artifacts.transcript.engine === null ? "" : ` · ${artifacts.transcript.engine}`
              }`
        }
      />
      {segments.length === 0 ? (
        <Empty>No transcript was produced for this run.</Empty>
      ) : (
        <div
          ref={box}
          onScroll={onScroll}
          style={maskImage === undefined ? undefined : { WebkitMaskImage: maskImage, maskImage }}
          className="scrollbar-hide max-h-[60vh] overflow-y-auto"
        >
          {segments.map((seg) => {
            const active = lens.t >= seg.tStart && lens.t < seg.tEnd;
            return (
              <button
                key={seg.id}
                onClick={() => lens.seek(seg.tStart)}
                className={cn(
                  "border-hairline hover:bg-elevated flex w-full items-start gap-3 border-b px-4 py-2.5 text-left transition-colors last:border-b-0",
                  active && "bg-elevated",
                )}
              >
                <span className="text-ink-subtle w-12 shrink-0 pt-0.5 font-mono text-xs tabular-nums">
                  {formatTime(seg.tStart)}
                </span>
                <span className={cn("min-w-0 flex-1 text-sm", active ? "text-ink-strong" : "text-ink-label")}>
                  {seg.speaker !== null && <span className="text-ink-subtle mr-2 text-xs">{seg.speaker}</span>}
                  {seg.text}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ frames */

export function FramesTab({ artifacts, lens }: { artifacts: RunArtifacts; lens: Lens }): JSX.Element {
  const kept = artifacts.frames.filter((f) => f.kept);
  const dropped = artifacts.frames.length - kept.length;
  const describedBy = new Map(artifacts.analyses.map((a) => [a.frameIdx, a]));

  return (
    <Card>
      <CardHeader
        title="Frames"
        action={`${kept.length} kept${dropped > 0 ? ` · ${dropped} near-duplicate${dropped === 1 ? "" : "s"} dropped` : ""}`}
      />
      {kept.length === 0 ? (
        <Empty>No frames were kept. Either the video never cuts, or scene detection did not run.</Empty>
      ) : (
        <div className="grid gap-px p-px sm:grid-cols-2">
          {kept.map((frame) => {
            const seen = describedBy.get(frame.idx);
            const active = Math.abs(lens.t * 1000 - frame.tMs) < 1500;
            return (
              <div
                key={frame.idx}
                className={cn("bg-base flex gap-3 p-3 transition-colors", active && "bg-elevated")}
              >
                <button
                  onClick={() => lens.seek(frame.tMs / 1000)}
                  className="shadow-ring size-24 shrink-0 overflow-hidden rounded"
                  aria-label={`Seek to ${formatTime(frame.tMs / 1000)}`}
                >
                  <img src={frame.url} alt="" className="size-full object-cover" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Cue t={frame.tMs / 1000} lens={lens} tone="quiet" />
                    {seen !== undefined && <StateLabel>{seen.sceneType}</StateLabel>}
                  </div>
                  {seen === undefined ? (
                    <p className="text-ink-subtle mt-1 text-xs">
                      Not described — no model saw this frame.
                    </p>
                  ) : (
                    <>
                      <p className="text-ink-label mt-1 text-xs leading-relaxed">{seen.describes}</p>
                      {seen.ocrText !== null && (
                        <p className="text-ink-subtle mt-1 truncate font-mono text-[11px]" title={seen.ocrText}>
                          {seen.ocrText}
                        </p>
                      )}
                      {seen.salientObjects.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {seen.salientObjects.map((o) => (
                            <span key={o} className="bg-tint text-ink-label rounded-full px-2 py-0.5 text-[11px]">
                              {o}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------- graph */

const NODE_TIME = (node: Record<string, unknown>): number | null => {
  for (const key of ["t_start", "t"] as const) {
    const value = node[key];
    if (typeof value === "number") return value;
  }
  return null;
};

export function GraphTab({ artifacts, lens }: { artifacts: RunArtifacts; lens: Lens }): JSX.Element {
  const nodes = artifacts.graph?.nodes ?? [];
  const byType = new Map<string, Record<string, unknown>[]>();
  for (const node of nodes) {
    const type = typeof node["type"] === "string" ? node["type"] : "node";
    byType.set(type, [...(byType.get(type) ?? []), node]);
  }

  return (
    <Card>
      <CardHeader
        title="Knowledge graph"
        action={
          artifacts.graph === null
            ? "none"
            : `${nodes.length} nodes · ${artifacts.graph.edges.length} edges`
        }
      />
      {nodes.length === 0 ? (
        <Empty>No graph was written for this run.</Empty>
      ) : (
        [...byType.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .map(([type, group]) => (
            <div key={type}>
              <p className="text-ink-subtle bg-recessed border-hairline border-y px-4 py-1 text-[11px] uppercase tracking-wide">
                {type} · {group.length}
              </p>
              {group.map((node, i) => {
                const t = NODE_TIME(node);
                const label =
                  (typeof node["label"] === "string" && node["label"]) ||
                  (typeof node["text"] === "string" && node["text"]) ||
                  String(node["id"] ?? "");
                return (
                  <div
                    key={`${String(node["id"] ?? i)}`}
                    className="border-hairline hover:bg-elevated flex items-start gap-3 border-b px-4 py-2 last:border-b-0"
                  >
                    {t === null ? (
                      <span className="text-ink-placeholder w-12 shrink-0 font-mono text-xs">—</span>
                    ) : (
                      <span className="w-12 shrink-0">
                        <Cue t={t} lens={lens} tone="quiet" />
                      </span>
                    )}
                    <span className="text-ink-label min-w-0 flex-1 text-sm">{label}</span>
                  </div>
                );
              })}
            </div>
          ))
      )}
    </Card>
  );
}
