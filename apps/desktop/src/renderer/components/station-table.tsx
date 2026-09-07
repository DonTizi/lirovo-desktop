import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Columns3 } from "lucide-react";
import { Skeleton } from "./primitives";
import { cn } from "../lib/cn";

/** One column of a station table. */
export interface TableColumn<T> {
  readonly key: string;
  readonly label: string;
  /** The identity column: never hidden, because a row without it is anonymous. */
  readonly locked?: boolean;
  readonly cellClass?: string;
  readonly cell: (row: T) => React.ReactNode;
}

/**
 * The one table.
 *
 * The library and the extracted values are the same object at two scales — a
 * list of rows with a hidden column set and an action that appears on hover —
 * and two hand-written tables for that are two tables that drift: one grows a
 * column picker and the other quietly does not.
 */
export function StationTable<T>({
  columns,
  rows,
  rowKey,
  actions,
  onRowClick,
  loading,
  error,
  empty,
}: {
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** Rendered in the hover overlay; omit for a table without actions. */
  actions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  error?: string | null;
  empty: string;
}): JSX.Element {
  if (loading === true) {
    return (
      <div className="grid gap-3 px-5 py-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }
  if (error !== null && error !== undefined) {
    return <p className="text-danger-text px-5 py-10 text-center font-mono text-xs">{error}</p>;
  }
  if (rows.length === 0) {
    return <p className="text-ink-subtle px-5 py-10 text-center text-sm">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      {/* border-separate: collapsed borders do not paint under a sticky cell,
          so the separators live on the cells instead. */}
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
            {actions !== undefined && <th className="border-hairline sticky right-0 w-0 border-b p-0" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick === undefined ? undefined : () => onRowClick(row)}
              className={cn("group hover:bg-elevated", onRowClick !== undefined && "cursor-pointer")}
            >
              {columns.map((column, i) => (
                <td
                  key={column.key}
                  className={cn("border-hairline border-b py-3 align-top", i === 0 ? "px-5" : "px-3", column.cellClass)}
                >
                  {column.cell(row)}
                </td>
              ))}
              {actions !== undefined && (
                /* Zero-width: the overlay hangs off this cell, so a row nobody
                   is pointing at keeps no empty space for a button. */
                <td className="border-hairline sticky right-0 z-20 w-0 border-b p-0">
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="bg-base group-hover:bg-elevated absolute inset-y-0 right-0 flex items-center gap-1.5 pl-10 pr-5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100"
                  >
                    {actions(row)}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Columns" button and its menu — picks which columns show. */
export function ColumnPicker<T>({
  columns,
  hidden,
  onToggle,
  onShowAll,
}: {
  columns: readonly TableColumn<T>[];
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const shown = columns.length - hidden.size;

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
          {shown}/{columns.length}
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
              {columns.map((column) => {
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
                          // `text-base`, not `text-white`. The tick sits on
                          // `ink-strong`, which is near-black in light and
                          // near-white in dark — white on it would have been
                          // invisible in one theme and fine in the other,
                          // which is exactly what a hardcoded colour buys.
                          on ? "bg-ink-strong border-ink-strong text-base" : "border-line text-transparent",
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

/** The hidden-column set, and the handlers a picker needs. */
export const useColumns = <T,>(
  all: readonly TableColumn<T>[],
): {
  columns: readonly TableColumn<T>[];
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
} => {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  return {
    columns: all.filter((c) => !hidden.has(c.key)),
    hidden,
    onToggle: (key) =>
      setHidden((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
    onShowAll: () => setHidden(new Set()),
  };
};
