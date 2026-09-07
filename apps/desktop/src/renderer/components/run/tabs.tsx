import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ListMusic } from "lucide-react";
import { cueAt, toParagraphs } from "@lirovo/core";
import type {
  RunArtifacts,
  RunDetail,
  ValueRow,
} from "../../../bridge/contract.js";
import { Card, CardHeader, Mono, StateLabel } from "../primitives";
import {
  ColumnPicker,
  StationTable,
  useColumns,
  type TableColumn,
} from "../station-table";
import { useScrollMask } from "../../lib/useScrollMask";
import { formatTime, type Lens } from "./lens";
import { cn } from "../../lib/cn";
import { ValueReader } from "./value-reader";
import { Cue } from "./cue";
import { displayValue } from "./value-groups";
import { graphLabel, graphTime } from "./graph-model";
import { ValueReview, type OnReviewSaved } from "./value-review";

function Empty({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <p className="text-ink-subtle px-4 py-8 text-center text-sm">{children}</p>
  );
}

/* ------------------------------------------------------------------ values */

/** Letters and digits only, so punctuation and case cannot make two strings differ. */
const bare = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

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
      <span className="text-ink-strong text-[13px] leading-relaxed">
        {displayValue(row.value)}
      </span>
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
            <span
              key={m}
              className="bg-tint text-ink-label rounded px-1.5 py-0.5 text-[10px] uppercase"
            >
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
      const extra = row.evidence.filter((e) =>
        addsSomething(e.quote, row.value),
      );
      if (extra.length === 0)
        return <span className="text-ink-placeholder text-xs">–</span>;
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
  onReviewSaved,
}: {
  detail: RunDetail;
  values: readonly ValueRow[];
  lens: Lens;
  onReviewSaved: OnReviewSaved;
}): JSX.Element {
  const all: readonly TableColumn<ValueRow>[] = [...valueColumns(lens), {
    key: "review", label: "Review", cellClass: "min-w-[260px]",
    cell: (row) => <ValueReview runId={detail.runId} row={row} onSaved={onReviewSaved} />,
  }];
  const { columns, hidden, onToggle, onShowAll } = useColumns(all);
  const [mode, setMode] = useState<"read" | "table">("read");

  return (
    <section className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-subtle">
          {detail.values.filter((row) => row.review?.decision === "approved").length} accepted · {detail.values.filter((row) => row.review?.decision === "rejected").length} rejected · {detail.values.filter((row) => row.review?.decision !== "approved" && row.review?.decision !== "rejected").length} need review
        </p>
        <div className="result-mode" role="group" aria-label="Result display">
          <button
            aria-pressed={mode === "read"}
            onClick={() => setMode("read")}
          >
            Reading
          </button>
          <button
            aria-pressed={mode === "table"}
            onClick={() => setMode("table")}
          >
            Table
          </button>
        </div>
      </div>
      {mode === "read" ? (
        <ValueReader values={values} total={detail.values.length} lens={lens} runId={detail.runId} onReviewSaved={onReviewSaved} />
      ) : (
        <div className="border-hairline bg-base overflow-hidden rounded-xl border">
          <div className="flex justify-end p-3">
            <ColumnPicker
              columns={all}
              hidden={hidden}
              onToggle={onToggle}
              onShowAll={onShowAll}
            />
          </div>
          <StationTable
            columns={columns}
            rows={values}
            rowKey={(row) => row.observationId}
            empty={
              detail.values.length > 0
                ? "No matching results. Clear the search or try another word."
                : "Nothing was extracted. Check the run details."
            }
          />
        </div>
      )}
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
export function TranscriptTab({
  artifacts,
  lens,
}: {
  artifacts: RunArtifacts;
  lens: Lens;
}): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const segments = artifacts.transcript?.segments ?? [];
  const paragraphs = useMemo(() => toParagraphs(segments), [segments]);
  const { maskImage, onScroll } = useScrollMask(box, [paragraphs.length]);

  const activeIndex = paragraphs.findIndex(
    (p) => lens.t >= p.tStart && lens.t < p.tEnd,
  );

  // Follow the playhead, and stop the moment the reader takes over. A pane
  // that keeps yanking itself back is a pane you cannot read ahead in.
  useEffect(() => {
    if (!follow || activeIndex < 0) return;
    box.current
      ?.querySelector(`[data-para="${activeIndex}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
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
            {artifacts.transcript?.engine === null ||
            artifacts.transcript?.engine === undefined
              ? ""
              : ` · ${artifacts.transcript.engine}`}
          </span>
        </div>
        <button
          onClick={() => setFollow((v) => !v)}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
            follow
              ? "border-line bg-fill-hover text-ink-strong"
              : "border-hairline text-ink-label hover:bg-fill-hover",
          )}
        >
          {follow ? (
            <Check className="size-3.5" strokeWidth={2.5} />
          ) : (
            <ListMusic className="size-3.5" />
          )}
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
          style={
            maskImage === undefined
              ? undefined
              : { WebkitMaskImage: maskImage, maskImage }
          }
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
                    <span className="text-ink-subtle mr-2 text-xs">
                      {paragraph.speaker}
                    </span>
                  )}
                  {paragraph.cues.map((cue, j) => (
                    <span
                      key={j}
                      onClick={() => lens.seek(cue.tStart)}
                      className={cn(
                        "cursor-pointer",
                        spoken === cue
                          ? "text-ink-strong bg-brand-soft rounded px-0.5 font-medium"
                          : "",
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

export function FramesTab({
  artifacts,
  lens,
  working = false,
}: {
  artifacts: RunArtifacts;
  lens: Lens;
  working?: boolean;
}): JSX.Element {
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
        <Empty>
          No frames were kept. Either the video never cuts, or scene detection
          did not run.
        </Empty>
      ) : (
        <div className="scrollbar-hide max-h-[70vh] overflow-y-auto">
          <div className="grid gap-px p-px sm:grid-cols-2">
            {kept.map((frame) => {
              const seen = describedBy.get(frame.idx);
              const active = Math.abs(lens.t * 1000 - frame.tMs) < 1500;
              return (
                <div
                  key={frame.idx}
                  className={cn(
                    "bg-base flex gap-3 p-3 transition-colors",
                    active && "bg-elevated",
                  )}
                >
                  <button
                    onClick={() => lens.seek(frame.tMs / 1000)}
                    className="shadow-ring size-24 shrink-0 overflow-hidden rounded"
                    aria-label={`Seek to ${formatTime(frame.tMs / 1000)}`}
                  >
                    {/* Lazy, because a talk yields hundreds of frames and
                      decoding them all at once stalls the window for seconds
                      to paint the two the reader can see. */}
                    <img
                      src={frame.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Cue t={frame.tMs / 1000} lens={lens} tone="quiet" />
                      {seen !== undefined && (
                        <StateLabel>{seen.sceneType}</StateLabel>
                      )}
                    </div>
                    {seen === undefined ? (
                      <p className="text-ink-subtle mt-1 text-xs">
                        {working
                          ? "Visual analysis is still in progress. Descriptions appear when saved."
                          : "No visual description was saved for this frame."}
                      </p>
                    ) : (
                      <>
                        <p className="text-ink-label mt-1 text-xs leading-relaxed">
                          {seen.describes}
                        </p>
                        {seen.ocrText !== null && (
                          <p
                            className="text-ink-subtle mt-1 truncate font-mono text-[11px]"
                            title={seen.ocrText}
                          >
                            {seen.ocrText}
                          </p>
                        )}
                        {seen.salientObjects.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {seen.salientObjects.map((o) => (
                              <span
                                key={o}
                                className="bg-tint text-ink-label rounded-full px-2 py-0.5 text-[11px]"
                              >
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

/**
 * The same nodes as a list, under the drawing.
 *
 * The graph answers "what is connected to what"; the list answers "what is
 * in here", which is a different question and the one that is easier to
 * scan when there are sixty nodes. Neither replaces the other.
 */
export function GraphNodes({
  artifacts,
  lens,
}: {
  artifacts: RunArtifacts;
  lens: Lens;
}): JSX.Element {
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
              const t = graphTime(node);
              const label = graphLabel(node);
              return (
                <div
                  key={`${String(node["id"] ?? i)}`}
                  className="border-hairline hover:bg-elevated flex items-start gap-3 border-b px-4 py-2 last:border-b-0"
                >
                  {t === null ? (
                    <span className="text-ink-placeholder w-12 shrink-0 font-mono text-xs">
                      —
                    </span>
                  ) : (
                    <span className="w-12 shrink-0">
                      <Cue t={t} lens={lens} tone="quiet" />
                    </span>
                  )}
                  <span className="text-ink-label min-w-0 flex-1 text-sm">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
    </>
  );
}
