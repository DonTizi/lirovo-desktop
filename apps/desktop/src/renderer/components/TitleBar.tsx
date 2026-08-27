import { RefreshCw, Search, X } from "lucide-react";
import { Ring } from "./Ring";

const drag = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

/**
 * The window's own bar: wordmark, search, a completeness dial, and the one
 * primary action.
 *
 * `pl-traffic` reserves the macOS close/minimise/zoom buttons. Any surface
 * drawn at the window's top-left must carry it, or the traffic lights land on
 * top of the content.
 */
export function TitleBar({
  query,
  onQuery,
  grounded,
  total,
  running,
  canStart,
  onStart,
  onCancel,
  onRefresh,
}: {
  query: string;
  onQuery: (v: string) => void;
  grounded: number;
  total: number;
  running: boolean;
  canStart: boolean;
  onStart: () => void;
  onCancel: () => void;
  onRefresh: () => void;
}): JSX.Element {
  const pct = total > 0 ? grounded / total : 0;

  return (
    <header
      className="border-hairline bg-base pl-traffic flex h-[52px] shrink-0 items-center gap-3 border-b pr-4"
      style={drag}
    >
      <span className="text-ink text-[15px] font-semibold tracking-tight">Lirovo</span>

      <div className="relative ml-2 w-80" style={noDrag}>
        <Search size={15} className="text-ink-tertiary pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          className="border-line bg-surface-subtle text-ink placeholder:text-ink-tertiary focus:border-brand focus:bg-surface focus:ring-brand/20 h-9 w-full rounded-lg border pl-8 pr-8 text-sm outline-none transition-colors focus:ring-2"
          placeholder="Search values and evidence"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        {query !== "" && (
          <button
            className="text-ink-tertiary hover:text-ink absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => onQuery("")}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2.5" style={noDrag}>
        <div
            className="bg-surface-subtle flex items-center gap-2 rounded-full px-2.5 py-1"
            title={`${grounded} of ${total} values carry evidence`}
          >
            <Ring value={pct} size={18} stroke={3} tone={pct >= 1 ? "governed" : "brand"} />
            <span className="text-ink-secondary text-xs font-medium">{Math.round(pct * 100)}% grounded</span>
        </div>
        <button
          className="text-ink-tertiary hover:bg-surface-subtle hover:text-ink-secondary rounded-md p-2 transition-colors"
          onClick={onRefresh}
          title="Reload runs"
        >
          <RefreshCw size={15} className={running ? "animate-spin" : ""} />
        </button>
        {running ? (
          <button
            className="text-ink-secondary hover:bg-surface-subtle rounded-md px-2.5 py-1.5 text-sm"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
        <button
          className="liq-solid liq-solid-brand h-9 min-w-[116px] rounded-lg px-4 text-sm font-medium"
          onClick={onStart}
          disabled={!canStart || running}
        >
          {running ? "Extracting…" : "Extract"}
        </button>
      </div>
    </header>
  );
}
