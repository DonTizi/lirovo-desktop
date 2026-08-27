import { useState } from "react";
import { ChevronDown, Columns3, FileVideo, Link2 } from "lucide-react";
import type { RunSummary } from "../../main/ipc.js";
import { Badge, Card, CardHeader, Skeleton, StateLabel } from "./primitives";
import { cn } from "../lib/cn";

type ColumnKey = "schema" | "status" | "duration" | "frames" | "values" | "grounded" | "when";

interface Column {
  readonly key: ColumnKey;
  readonly label: string;
  readonly align?: "right";
}

/**
 * Every column but the source, which is the row's identity and never hides.
 *
 * Hiding columns is not decoration: eight columns is the right density at a
 * full window and three is the right density beside a narrow one, and the only
 * person who knows which they are looking at is the reader.
 */
const COLUMNS: readonly Column[] = [
  { key: "schema", label: "Schema" },
  { key: "status", label: "Status" },
  { key: "duration", label: "Duration", align: "right" },
  { key: "frames", label: "Frames", align: "right" },
  { key: "values", label: "Values", align: "right" },
  { key: "grounded", label: "Grounded" },
  { key: "when", label: "Last run", align: "right" },
];

const clock = (s: number | null): string => {
  if (s === null) return "—";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const ago = (epochS: number): string => {
  const days = Math.floor((Date.now() / 1000 - epochS) / 86_400);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor((Date.now() / 1000 - epochS) / 3600);
  if (hours > 0) return `${hours}h ago`;
  return "just now";
};

function StatusCell({ status }: { status: string }): JSX.Element {
  if (status === "succeeded") return <Badge tone="success">succeeded</Badge>;
  if (status === "failed") return <Badge tone="danger">failed</Badge>;
  if (status === "stopped") return <Badge tone="warning">stopped</Badge>;
  if (status === "running") return <Badge tone="info">running</Badge>;
  return <StateLabel>{status}</StateLabel>;
}

/**
 * How much of the answer is backed by a moment in the video.
 *
 * A bar and a fraction rather than a percentage: the denominator is small
 * enough to matter — four of four is a different fact from four hundred of
 * four hundred, and 100% hides which one you are looking at.
 */
function GroundedCell({ run }: { run: RunSummary }): JSX.Element {
  if (run.valueCount === 0) return <span className="text-ink-placeholder text-xs">—</span>;
  const ratio = run.groundedCount / run.valueCount;
  return (
    <span className="flex items-center gap-2">
      <span className="bg-fill h-1 w-16 overflow-hidden rounded-full">
        <span
          className={cn("block h-full rounded-full", ratio === 1 ? "bg-success" : "bg-warning")}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
      <span className="text-ink-label text-xs tabular-nums">
        {run.groundedCount}/{run.valueCount}
      </span>
    </span>
  );
}

export function Library({
  runs,
  loading,
  onOpen,
}: {
  runs: readonly RunSummary[];
  loading: boolean;
  onOpen: (runId: string) => void;
}): JSX.Element {
  const [hidden, setHidden] = useState<ReadonlySet<ColumnKey>>(new Set());
  const [picking, setPicking] = useState(false);
  const shown = COLUMNS.filter((c) => !hidden.has(c.key));

  const cell = (run: RunSummary, key: ColumnKey): React.ReactNode => {
    switch (key) {
      case "schema":
        return run.schemaName ?? <span className="text-ink-placeholder">ad hoc</span>;
      case "status":
        return <StatusCell status={run.status} />;
      case "duration":
        return <span className="tabular-nums">{clock(run.durationS)}</span>;
      case "frames":
        return <span className="tabular-nums">{run.frameCount || "—"}</span>;
      case "values":
        return <span className="tabular-nums">{run.valueCount}</span>;
      case "grounded":
        return <GroundedCell run={run} />;
      case "when":
        return <span className="text-ink-subtle">{ago(run.createdAt)}</span>;
    }
  };

  return (
    <Card className="overflow-visible">
      <CardHeader
        title="Runs"
        action={
          <div className="relative">
            <button
              onClick={() => setPicking((v) => !v)}
              className="border-line hover:bg-elevated flex h-7 items-center gap-1.5 rounded border px-2 transition-colors"
            >
              <Columns3 className="size-3.5" />
              Columns {shown.length}/{COLUMNS.length}
              <ChevronDown className={cn("size-3 transition-transform", picking && "rotate-180")} />
            </button>
            {picking && (
              <div className="bg-base shadow-popover absolute right-0 z-20 mt-1 w-44 rounded-lg py-1">
                {COLUMNS.map((column) => (
                  <label
                    key={column.key}
                    className="hover:bg-elevated flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={!hidden.has(column.key)}
                      onChange={() =>
                        setHidden((current) => {
                          const next = new Set(current);
                          if (next.has(column.key)) next.delete(column.key);
                          else next.add(column.key);
                          return next;
                        })
                      }
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        }
      />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-hairline border-b">
            <th className="text-ink-label px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Source</th>
            {shown.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "text-ink-label px-4 py-2 text-xs font-medium uppercase tracking-wide",
                  column.align === "right" ? "text-right" : "text-left",
                )}
              >
                {column.label}
              </th>
            ))}
            <th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {loading &&
            [0, 1, 2, 3].map((i) => (
              <tr key={i} className="border-hairline border-b last:border-b-0">
                <td className="px-4 py-2.5">
                  <Skeleton className="h-4 w-48" />
                </td>
                {shown.map((column) => (
                  <td key={column.key} className="px-4 py-2.5">
                    <Skeleton className="h-4 w-16" />
                  </td>
                ))}
                <td />
              </tr>
            ))}

          {!loading && runs.length === 0 && (
            <tr>
              <td colSpan={shown.length + 2} className="text-ink-subtle px-4 py-10 text-center">
                Nothing extracted yet.
              </td>
            </tr>
          )}

          {!loading &&
            runs.map((run) => (
              <tr
                key={run.runId}
                onClick={() => onOpen(run.runId)}
                className="border-hairline hover:bg-elevated group cursor-pointer border-b last:border-b-0"
              >
                <td className="text-ink-strong px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    {run.sourceType === "file" ? (
                      <FileVideo className="text-ink-subtle size-3.5 shrink-0" />
                    ) : (
                      <Link2 className="text-ink-subtle size-3.5 shrink-0" />
                    )}
                    <span className="truncate">{run.title ?? run.runId}</span>
                  </span>
                </td>
                {shown.map((column) => (
                  <td
                    key={column.key}
                    className={cn("text-ink-label px-4 py-2.5", column.align === "right" && "text-right")}
                  >
                    {cell(run, column.key)}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right">
                  {/* Appears on hover, the way a row action should: a column of
                      buttons down a long table is louder than the data. */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(run.runId);
                    }}
                    className="liq-solid liq-solid-brand h-7 rounded px-3 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </Card>
  );
}
