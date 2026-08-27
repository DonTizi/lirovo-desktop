import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ListMusic } from "lucide-react";
import { cueAt, toParagraphs } from "@lirovo/core";
import type { RunArtifacts, RunDetail, ValueRow } from "../../../main/ipc.js";
import { Card, CardHeader, Mono, StateLabel } from "../primitives";
import { ColumnPicker, StationTable, useColumns, type TableColumn } from "../station-table";
import { useScrollMask } from "../../lib/useScrollMask";
import { formatTime, type Lens } from "./lens";
import { cn } from "../../lib/cn";

/** A timecode that seeks. The product's whole promise is that this works. */
export function Cue({ t, lens, tone }: { t: number; lens: Lens; tone?: "quiet" }): JSX.Element {
  const active = lens.t >= t && lens.t < t + 6;
  return (
    <button
      onClick={() => lens.seek(t)}
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 font-mono text-xs tabular-nums transition-colors",
        tone === "quiet"
          ? "text-ink-subtle hover:bg-tint hover:text-ink"
          : active
            ? "bg-ink-strong text-ink-inverse"
            : "bg-tint text-ink-label hover:bg-ink-strong hover:text-ink-inverse",
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

/** Letters and digits only, so punctuation and case cannot make two strings differ. */
const bare = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Does this quote say anything the value did not?
 *
 * Pass B routinely writes a value that IS its evidence sentence, so printing
 * both puts the same words on screen twice — thirty-eight times down a page.
 * The quote earns its cell only when it carries something the value does not
 * already contain.
 */
const addsSomething = (quote: string | null, value: string): boolean => {
  if (quote === null || quote.trim() === "") return false;
  const q = bare(quote);
  const v = bare(value);
  return !(q.includes(v) || v.includes(q));
};

const valueColumns = (lens: Lens): readonly TableColumn<ValueRow>[] => [
  {
    key: "field",
    label: "Field",
    locked: true,
    cellClass: "whitespace-nowrap",
    cell: (row) => <Mono className="text-[11px]">{row.fieldPath}</Mono>,
  },
  {
    key: "value",
    label: "Value",
    cellClass: "min-w-[220px]",
    cell: (row) => (
      <span className="text-ink-strong text-[13px] leading-relaxed">{row.value.replace(/^"|"$/g, "")}</span>
    ),
  },
  {
    key: "modality",
    label: "Where",
    cellClass: "whitespace-nowrap",
    cell: (row) => {
      const modalities = [...new Set(row.evidence.map((e) => e.modality))];
      if (modalities.length === 0) return <StateLabel>unbacked</StateLabel>;
      return (
        <span className="flex flex-wrap gap-1">
          {modalities.map((m) => (
            <span key={m} className="bg-tint text-ink-label rounded px-1.5 py-0.5 text-[10px] uppercase">
              {m}
            </span>
          ))}
        </span>
      );
    },
  },
  {
    key: "at",
    label: "Proven at",
    cellClass: "whitespace-nowrap",
    cell: (row) => (
      <span className="flex flex-wrap gap-1">
        {row.evidence.map((e, i) => (
          <Cue key={`${e.sourceRef}-${i}`} t={e.tStart} lens={lens} />
        ))}
      </span>
    ),
  },
  {
    key: "quote",
    label: "Quoted",
    cellClass: "min-w-[200px] max-w-[320px]",
    cell: (row) => {
      const extra = row.evidence.filter((e) => addsSomething(e.quote, row.value));
      if (extra.length === 0) return <span className="text-ink-placeholder text-xs">–</span>;
      return (
        <span className="text-ink-subtle text-xs italic leading-relaxed">
          {extra.map((e, i) => (
            <span key={i} className="block">
              “{e.quote}”
            </span>
          ))}
        </span>
      );
    },
  },
];

export function ValuesTab({
  detail,
  values,
  lens,
}: {
  detail: RunDetail;
  values: readonly ValueRow[];
  lens: Lens;
}): JSX.Element {
  const all = valueColumns(lens);
  const { columns, hidden, onToggle, onShowAll } = useColumns(all);
  const grounded = values.filter((v) => v.evidence.length > 0).length;

  return (
    <section className="border-hairline bg-base overflow-hidden rounded-xl border">
      <div className="border-hairline flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Extracted</h2>
          <span className="bg-fill-hover text-ink-label rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
            {values.length}
          </span>
          <span className="text-ink-subtle text-xs">
            {grounded} grounded{detail.transcriptEngine !== null ? ` · ${detail.transcriptEngine}` : ""}
          </span>
        </div>
        <ColumnPicker columns={all} hidden={hidden} onToggle={onToggle} onShowAll={onShowAll} />
      </div>

      <StationTable
        columns={columns}
        rows={values}
        rowKey={(row) => row.observationId}
        onRowClick={(row) => {
          const first = row.evidence[0];
          if (first !== undefined) lens.seek(first.tStart);
        }}
        empty="Nothing was extracted. The run record says where it stopped."
      />
    </section>
  );
}

/* -------------------------------------------------------------- transcript */

/**
 * The transcript as prose, with the spoken line lit up inside it.
 *
 * Auto-captions arrive as two-second fragments cut to fit a subtitle bar, so
 * one row per cue turns twenty minutes into 554 half-sentences: every word is
 * present and none of it is readable. They are gathered into paragraphs here —
 * nothing is dropped, and each cue keeps its own timing, which is what lets the
 * line currently being spoken be highlighted inside the paragraph and a click
 * still land on the second it started.
 */
export function TranscriptTab({ artifacts, lens }: { artifacts: RunArtifacts; lens: Lens }): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const segments = artifacts.transcript?.segments ?? [];
  const paragraphs = useMemo(() => toParagraphs(segments), [segments]);
  const { maskImage, onScroll } = useScrollMask(box, [paragraphs.length]);

  const activeIndex = paragraphs.findIndex((p) => lens.t >= p.tStart && lens.t < p.tEnd);

  // Follow the playhead, and stop the moment the reader takes over. A pane
  // that keeps yanking itself back is a pane you cannot read ahead in.
  useEffect(() => {
    if (!follow || activeIndex < 0) return;
    box.current?.querySelector(`[data-para="${activeIndex}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [follow, activeIndex]);

  return (
    <section className="border-hairline bg-base overflow-hidden rounded-xl border">
      <div className="border-hairline flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Transcript</h2>
          <span className="bg-fill-hover text-ink-label rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
            {paragraphs.length}
          </span>
          <span className="text-ink-subtle text-xs">
            {segments.length} cue{segments.length === 1 ? "" : "s"}
            {artifacts.transcript?.engine === null || artifacts.transcript?.engine === undefined
              ? ""
              : ` · ${artifacts.transcript.engine}`}
          </span>
        </div>
        <button
          onClick={() => setFollow((v) => !v)}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
            follow ? "border-line bg-fill-hover text-ink-strong" : "border-hairline text-ink-label hover:bg-fill-hover",
          )}
        >
          {follow ? <Check className="size-3.5" strokeWidth={2.5} /> : <ListMusic className="size-3.5" />}
          Follow
        </button>
      </div>

      {paragraphs.length === 0 ? (
        <Empty>No transcript was produced for this run.</Empty>
      ) : (
        <div
          ref={box}
          onScroll={onScroll}
          onWheel={() => setFollow(false)}
          style={maskImage === undefined ? undefined : { WebkitMaskImage: maskImage, maskImage }}
          className="scrollbar-hide max-h-[62vh] overflow-y-auto"
        >
          {paragraphs.map((paragraph, i) => {
            const active = i === activeIndex;
            const spoken = active ? cueAt(paragraph, lens.t) : null;
            return (
              <div
                key={paragraph.tStart}
                data-para={i}
                className={cn(
                  "border-hairline flex items-start gap-4 border-b px-5 py-3 last:border-b-0",
                  active && "bg-elevated",
                )}
              >
                <button
                  onClick={() => lens.seek(paragraph.tStart)}
                  className="text-ink-subtle hover:text-ink shrink-0 pt-0.5 font-mono text-xs tabular-nums transition-colors"
                >
                  {formatTime(paragraph.tStart)}
                </button>
                <p className="text-ink-label min-w-0 flex-1 text-[13px] leading-relaxed">
                  {paragraph.speaker !== null && (
                    <span className="text-ink-subtle mr-2 text-xs">{paragraph.speaker}</span>
                  )}
                  {paragraph.cues.map((cue, j) => (
                    <span
                      key={j}
                      onClick={() => lens.seek(cue.tStart)}
                      className={cn(
                        "cursor-pointer",
                        spoken === cue ? "text-ink-strong bg-brand-soft rounded px-0.5 font-medium" : "",
                      )}
                    >
                      {cue.text.trim()}{" "}
                    </span>
                  ))}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
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
        <div className="scrollbar-hide max-h-[70vh] overflow-y-auto">
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
                  {/* Lazy, because a talk yields hundreds of frames and
                      decoding them all at once stalls the window for seconds
                      to paint the two the reader can see. */}
                  <img src={frame.url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
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

/**
 * The same nodes as a list, under the drawing.
 *
 * The graph answers "what is connected to what"; the list answers "what is
 * in here", which is a different question and the one that is easier to
 * scan when there are sixty nodes. Neither replaces the other.
 */
export function GraphNodes({ artifacts, lens }: { artifacts: RunArtifacts; lens: Lens }): JSX.Element {
  const nodes = artifacts.graph?.nodes ?? [];
  const byType = new Map<string, Record<string, unknown>[]>();
  for (const node of nodes) {
    const type = typeof node["type"] === "string" ? node["type"] : "node";
    byType.set(type, [...(byType.get(type) ?? []), node]);
  }

  return (
    <>
      {[...byType.entries()]
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
        ))}
    </>
  );
}
