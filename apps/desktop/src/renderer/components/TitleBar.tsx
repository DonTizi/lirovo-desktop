import { PanelLeftOpen, RefreshCw, Search, X } from "lucide-react";
import { cn } from "../lib/cn";

export function TitleBar({
  title,
  query,
  onQuery,
  grounded,
  total,
  showSearch,
  running,
  onCancel,
  onRefresh,
  sidebarCollapsed,
  onShowSidebar,
  toggleRef,
}: {
  title: string;
  query: string;
  onQuery: (value: string) => void;
  grounded: number;
  total: number;
  showSearch: boolean;
  running: boolean;
  onCancel: () => void;
  onRefresh: () => void;
  sidebarCollapsed: boolean;
  onShowSidebar: () => void;
  toggleRef: React.RefObject<HTMLButtonElement>;
}): JSX.Element {
  return (
    <header
      className={cn(
        "workspace-toolbar flex min-h-10 shrink-0 items-center gap-3 px-4",
        sidebarCollapsed && "pl-traffic",
      )}
    >
      {sidebarCollapsed && (
        <button
          onClick={onShowSidebar}
          ref={toggleRef}
          className="text-ink-tertiary hover:text-ink rounded-lg p-2"
          aria-label="Show sidebar"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}
      <span className="text-ink-secondary min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm">
        {title}
      </span>
      {showSearch && (
        <div className="relative w-56 shrink">
          <Search className="text-ink-tertiary pointer-events-none absolute left-2.5 top-2.5 size-3.5" />
          <input
            className="border-line-subtle bg-surface-subtle placeholder:text-ink-tertiary h-9 w-full rounded-lg border pl-8 pr-8 text-sm"
            aria-label="Search values and evidence"
            placeholder="Search values…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
          {query !== "" && (
            <button
              aria-label="Clear search"
              onClick={() => onQuery("")}
              className="text-ink-tertiary absolute right-2 top-2.5"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}
      {showSearch && total > 0 && (
        <span className="text-ink-tertiary whitespace-nowrap text-xs">
          {grounded}/{total} with evidence
        </span>
      )}
      <button
        className="text-ink-tertiary hover:bg-surface-raised hover:text-ink rounded-lg p-2"
        onClick={onRefresh}
        aria-label="Reload runs"
      >
        <RefreshCw className="size-4" />
      </button>
      {running && (
        <button
          className="border-line text-ink-secondary rounded-lg border px-3 py-1.5 text-sm"
          onClick={onCancel}
        >
          Cancel extraction
        </button>
      )}
    </header>
  );
}
