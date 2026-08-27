import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Columns3, FileVideo, Link2 } from "lucide-react";
import type { RunSummary } from "../../main/ipc.js";
import { PixelField } from "./PixelField";
import { Skeleton } from "./primitives";
import { cn } from "../lib/cn";

interface Column {
  readonly key: string;
  readonly label: string;
  /** The identity column. Never hidden, because a row without it is anonymous. */
  readonly locked?: boolean;
  readonly cellClass?: string;
  readonly cell: (run: RunSummary) => React.ReactNode;
}

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

const COLUMNS: readonly Column[] = [
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

/** The page's own title, flanked by the pixel field. */
function Hero({ title, sub }: { title: string; sub: string }): JSX.Element {
  return (
    <section className="relative pt-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="relative mx-auto mt-2 w-fit"
      >
        <PixelField side="left" />
        <h1 className="text-ink-strong relative z-[1] text-center text-4xl font-semibold tracking-tight">{title}</h1>
        <PixelField side="right" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.12 }}
        className="text-ink-label mt-3 text-center text-sm"
      >
        {sub}
      </motion.p>
    </section>
  );
}

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

function ColumnPicker({
  hidden,
  onToggle,
  onShowAll,
}: {
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const shown = COLUMNS.length - hidden.size;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (wrap.current?.contains(e.target as Node) !== true) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
          open ? "border-line bg-fill-hover text-ink-strong" : "border-hairline text-ink-label hover:bg-fill-hover",
        )}
      >
        <Columns3 className="size-3.5" strokeWidth={1.75} />
        Columns
        <span className="text-ink-subtle tabular-nums">
          {shown}/{COLUMNS.length}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="border-hairline bg-base shadow-popover absolute right-0 top-9 z-30 w-56 origin-top-right rounded-xl border py-1.5"
          >
            <p className="text-ink-subtle px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wide">
              Displayed columns
            </p>
            <ul className="max-h-72 overflow-y-auto">
              {COLUMNS.map((column) => {
                const on = !hidden.has(column.key);
                return (
                  <li key={column.key}>
                    <button
                      onClick={() => onToggle(column.key)}
                      disabled={column.locked === true}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors",
                        column.locked === true ? "text-ink-subtle cursor-default" : "text-ink hover:bg-elevated",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded border transition-colors",
                          on ? "bg-ink-strong border-ink-strong text-white" : "border-line text-transparent",
                        )}
                      >
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      <span className="truncate">{column.label}</span>
                      {column.locked === true && <span className="text-ink-subtle ml-auto text-[10px]">always</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="border-hairline mt-1.5 border-t px-3 pt-1.5">
              <button
                onClick={onShowAll}
                disabled={hidden.size === 0}
                className="text-ink-label hover:text-ink-strong disabled:text-ink-placeholder text-xs transition-colors"
              >
                Show all
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const columns = COLUMNS.filter((c) => !hidden.has(c.key));

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
          <ColumnPicker
            hidden={hidden}
            onToggle={(key) =>
              setHidden((current) => {
                const next = new Set(current);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              })
            }
            onShowAll={() => setHidden(new Set())}
          />
        </div>

        {loading ? (
          <div className="grid gap-3 px-5 py-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : error !== null && error !== undefined ? (
          <p className="text-danger-text px-5 py-10 text-center font-mono text-xs">{error}</p>
        ) : listed.length === 0 ? (
          <p className="text-ink-subtle px-5 py-10 text-center text-sm">
            {stalled.length > 0 ? "Nothing finished yet." : "Nothing extracted yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            {/* border-separate: collapsed borders do not paint under a sticky
                cell, so the separators live on the cells instead. */}
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-ink-subtle text-left text-[11px] uppercase tracking-wide">
                  {columns.map((column, i) => (
                    <th
                      key={column.key}
                      className={cn(
                        "border-hairline whitespace-nowrap border-b py-2 font-medium",
                        i === 0 ? "px-5" : "px-3",
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className="border-hairline sticky right-0 w-0 border-b p-0" />
                </tr>
              </thead>
              <tbody>
                {listed.map((run) => (
                  <tr
                    key={run.runId}
                    onClick={() => onOpen(run.runId)}
                    className="group hover:bg-elevated cursor-pointer"
                  >
                    {columns.map((column, i) => (
                      <td
                        key={column.key}
                        className={cn(
                          "border-hairline border-b py-3",
                          i === 0 ? "px-5" : "px-3",
                          column.cellClass,
                        )}
                      >
                        {column.cell(run)}
                      </td>
                    ))}
                    {/* Zero-width: the overlay hangs off this cell, so a row
                        that is not hovered keeps no empty space for it. */}
                    <td className="border-hairline sticky right-0 z-20 w-0 border-b p-0">
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-base group-hover:bg-elevated absolute inset-y-0 right-0 flex items-center gap-1.5 pl-10 pr-5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100"
                      >
                        <button
                          onClick={() => onOpen(run.runId)}
                          className="liq-solid liq-solid-brand rounded-md px-2.5 py-1 text-xs font-medium"
                        >
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
