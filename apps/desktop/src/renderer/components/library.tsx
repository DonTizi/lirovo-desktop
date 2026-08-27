import { motion } from "framer-motion";
import { AlertTriangle, FileVideo, Link2 } from "lucide-react";
import type { RunSummary } from "../../bridge/contract.js";
import { Hero } from "./hero";
import { ColumnPicker, StationTable, useColumns } from "./station-table";
import type { TableColumn } from "./station-table";
import { cn } from "../lib/cn";

const clock = (s: number | null): string => {
  if (s === null) return "–";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const ago = (epochS: number): string => {
  const seconds = Math.max(0, Date.now() / 1000 - epochS);
  if (seconds < 90) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
};

const STATUS_TINT: Record<string, string> = {
  succeeded: "bg-success-tint text-success-text",
  failed: "bg-danger-tint text-danger-text",
  stopped: "bg-warning-tint text-warning-text",
  running: "bg-info-tint text-info-text",
};

/** Short code for a source kind, the way a data product wears one. */
function KindBadge({ kind }: { kind: string | null }): JSX.Element {
  const label = kind === "file" ? "FILE" : (kind ?? "url").slice(0, 3).toUpperCase();
  return (
    <span title={kind ?? "url"} className="bg-fill-hover text-ink-label rounded px-1.5 py-0.5 text-[10px] font-semibold">
      {label}
    </span>
  );
}

const COLUMNS: readonly TableColumn<RunSummary>[] = [
  { key: "kind", label: "Kind", cell: (r) => <KindBadge kind={r.sourceType} /> },
  {
    key: "source",
    label: "Source",
    locked: true,
    cellClass: "max-w-[280px]",
    cell: (r) => (
      <div className="flex items-center gap-2.5">
        {r.sourceType === "file" ? (
          <FileVideo className="text-ink-placeholder size-4 shrink-0" />
        ) : (
          <Link2 className="text-ink-placeholder size-4 shrink-0" />
        )}
        <p className="truncate text-[13px] font-medium">{r.title ?? r.runId}</p>
      </div>
    ),
  },
  {
    key: "schema",
    label: "Schema",
    cellClass: "text-[13px] text-ink-label max-w-[180px] truncate",
    cell: (r) => r.schemaName ?? "ad hoc",
  },
  {
    key: "status",
    label: "Status",
    cell: (r) => (
      <span
        className={cn(
          "whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium",
          STATUS_TINT[r.status] ?? "bg-fill text-ink-label",
        )}
      >
        {r.status}
      </span>
    ),
  },
  {
    key: "duration",
    label: "Length",
    cellClass: "text-xs text-ink-label tabular-nums whitespace-nowrap",
    cell: (r) => clock(r.durationS),
  },
  {
    key: "frames",
    label: "Frames",
    cellClass: "text-xs text-ink-label tabular-nums",
    cell: (r) => r.frameCount ?? "–",
  },
  {
    key: "when",
    label: "Last run",
    cellClass: "text-xs text-ink-label tabular-nums whitespace-nowrap",
    cell: (r) => ago(r.createdAt),
  },
  {
    // One cell, one fact: the bar carries the proportion, the fraction the
    // exact numbers. A separate percent column says the same thing twice.
    key: "grounded",
    label: "Grounded",
    cellClass: "text-[13px] tabular-nums whitespace-nowrap",
    cell: (r) =>
      r.valueCount === 0 ? (
        <span className="text-ink-placeholder">–</span>
      ) : (
        <div className="flex items-center gap-2">
          <div className="bg-fill h-1.5 w-14 overflow-hidden rounded-full">
            <div
              className="bg-brand h-full rounded-full"
              style={{ width: `${(r.groundedCount / r.valueCount) * 100}%` }}
            />
          </div>
          <span>
            <span className="text-ink-strong font-medium">{r.groundedCount}</span>
            <span className="text-ink-subtle">/{r.valueCount}</span>
          </span>
        </div>
      ),
  },
];

/**
 * Runs that are not moving: blocked, not waiting.
 *
 * They leave the table and the count. A run that failed at scene-detect and a
 * run that finished are not two rows of one list — mixing them makes the count
 * above the table a number nobody can act on.
 */
function StalledBanner({
  runs,
  onOpen,
  className,
}: {
  runs: readonly RunSummary[];
  onOpen: (runId: string) => void;
  className?: string;
}): JSX.Element | null {
  if (runs.length === 0) return null;
  return (
    <section className={cn("border-danger-text/20 bg-danger-tint/40 rounded-xl border px-5 py-4", className)}>
      <p className="text-danger-text flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="size-4" strokeWidth={1.75} />
        {runs.length === 1 ? "1 run needs attention" : `${runs.length} runs need attention`}
      </p>
      <ul className="mt-2 space-y-1">
        {runs.map((run) => (
          <li key={run.runId} className="flex items-center gap-3 text-[13px]">
            <span className="truncate font-medium">{run.title ?? run.runId}</span>
            <span className="text-ink-subtle whitespace-nowrap">
              {run.status} {ago(run.createdAt)}
            </span>
            <button
              onClick={() => onOpen(run.runId)}
              className="border-hairline bg-base text-ink-label hover:bg-fill-hover ml-auto whitespace-nowrap rounded-md border px-2.5 py-1 text-xs transition-colors"
            >
              Open
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Library({
  runs,
  loading,
  error,
  onOpen,
}: {
  runs: readonly RunSummary[];
  loading: boolean;
  /** Set when the list could not be read at all — never the same as empty. */
  error?: string | null;
  onOpen: (runId: string) => void;
}): JSX.Element {
  const { columns, hidden, onToggle, onShowAll } = useColumns(COLUMNS);

  const stalled = runs.filter((r) => r.status === "failed" || r.status === "stopped");
  const listed = runs.filter((r) => r.status !== "failed" && r.status !== "stopped");

  return (
    <div className="pb-16">
      <Hero title="Library" sub="Newest first. Every value keeps the moment that proves it." />

      <StalledBanner runs={stalled} onOpen={onOpen} className="mt-10" />

      <section className="border-hairline bg-base mt-10 overflow-hidden rounded-xl border">
        <div className="border-hairline flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Extractions</h2>
            <span className="bg-fill-hover text-ink-label rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
              {listed.length}
            </span>
          </div>
          <ColumnPicker columns={COLUMNS} hidden={hidden} onToggle={onToggle} onShowAll={onShowAll} />
        </div>

        <StationTable
          columns={columns}
          rows={listed}
          rowKey={(run) => run.runId}
          onRowClick={(run) => onOpen(run.runId)}
          {...(loading ? { loading } : {})}
          {...(error !== null && error !== undefined ? { error } : {})}
          empty={stalled.length > 0 ? "Nothing finished yet." : "Nothing extracted yet."}
          actions={(run) => (
            <button
              onClick={() => onOpen(run.runId)}
              className="liq-solid liq-solid-brand rounded-md px-2.5 py-1 text-xs font-medium"
            >
              Review
            </button>
          )}
        />
      </section>
    </div>
  );
}
