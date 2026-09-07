import { useMemo, useState } from "react";
import { ChevronRight, Headphones, ScanEye, Search } from "lucide-react";
import type { ValueRow } from "../../../bridge/contract.js";
import { cn } from "../../lib/cn";
import { Cue } from "./cue";
import { formatTime, type Lens } from "./lens";
import { displayValue, groupValues } from "./value-groups";

function SourceList({ row, lens }: { row: ValueRow; lens: Lens }): JSX.Element {
  return (
    <details className="result-sources group/sources">
      <summary className="result-source-toggle">
        <ChevronRight
          aria-hidden="true"
          className="size-3.5 transition-transform group-open/sources:rotate-90"
        />
        {row.evidence.length} {row.evidence.length === 1 ? "source" : "sources"}
      </summary>
      <div className="result-source-list">
        {row.evidence.map((e, i) => (
          <div key={`${e.sourceRef}-${i}`} className="result-source">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
              {e.modality.toLowerCase() === "visual" ? (
                <ScanEye aria-hidden="true" className="size-3.5" />
              ) : (
                <Headphones aria-hidden="true" className="size-3.5" />
              )}
              <span className="capitalize">{e.modality.toLowerCase()}</span>
              <Cue t={e.tStart} lens={lens} />
              <span>– {formatTime(e.tEnd)}</span>
            </div>
            {e.quote ? (
              <blockquote className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-secondary">
                {e.quote}
              </blockquote>
            ) : (
              <p className="mt-2 text-xs text-ink-tertiary">
                Timestamped source; no quote recorded.
              </p>
            )}
          </div>
        ))}
        <p className="break-all text-xs text-ink-tertiary">
          Field: <code>{row.fieldPath}</code>
        </p>
      </div>
    </details>
  );
}

export function ValueReader({
  values,
  total,
  lens,
}: {
  values: readonly ValueRow[];
  total: number;
  lens: Lens;
}): JSX.Element {
  const [category, setCategory] = useState<string | null>(null);
  const groups = useMemo(() => groupValues(values), [values]);
  const selected = groups.some((g) => g.key === category) ? category : null;
  const shown =
    selected === null ? groups : groups.filter((g) => g.key === selected);

  if (values.length === 0)
    return (
      <div className="result-empty" role="status">
        <Search aria-hidden="true" className="size-6 text-ink-tertiary" />
        <h2>{total > 0 ? "No matching results" : "No results yet"}</h2>
        <p>
          {total > 0
            ? "Try another word or clear the search above."
            : "Check the run details to see whether the extraction finished."}
        </p>
      </div>
    );

  return (
    <div className="result-reader">
      {groups.length > 1 && (
        <div
          className="result-filters"
          role="group"
          aria-label="Filter results by field"
        >
          <button
            aria-pressed={selected === null}
            className={cn("result-filter", selected === null && "is-selected")}
            onClick={() => setCategory(null)}
          >
            All fields <span>{values.length}</span>
          </button>
          {groups.map((group) => (
            <button
              key={group.key}
              aria-pressed={selected === group.key}
              className={cn(
                "result-filter",
                selected === group.key && "is-selected",
              )}
              onClick={() => setCategory(group.key)}
            >
              {group.label} <span>{group.rows.length}</span>
            </button>
          ))}
        </div>
      )}
      {shown.map((group) => (
        <section
          key={group.key}
          className="result-group"
          aria-label={group.label}
        >
          <div className="result-group-heading">
            <h2>{group.label}</h2>
            <span>{group.rows.length}</span>
          </div>
          <div className="result-group-body">
            {group.rows.map((row) => (
              <article key={row.observationId} className="result-item">
                <p
                  className={cn(
                    "result-value",
                    group.key === "title" && "result-title-value",
                  )}
                >
                  {displayValue(row.value)}
                </p>
                <div className="result-item-footer">
                  {row.evidence[0] !== undefined && (
                    <Cue t={row.evidence[0].tStart} lens={lens} tone="quiet" />
                  )}
                  {row.evidence.length > 0 ? (
                    <SourceList row={row} lens={lens} />
                  ) : (
                    <span className="text-xs text-warning-text">
                      No source linked
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
