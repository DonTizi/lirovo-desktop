import { ChevronDown, ChevronUp, Settings, X } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * A breadcrumb row over a row of underlined tabs, full width, no sidebar.
 *
 * A run opens as a PEER of Overview and Library rather than inside a nested
 * pane: one entity on screen, facets switched with tabs. That is the whole
 * reason there is no left rail.
 */
export type TabId = string;

export interface NavTab {
  id: TabId;
  label: string;
  count?: number;
  /** Run tabs carry a title and can be closed individually. */
  closable?: boolean;
}

function Stepper(): JSX.Element {
  return (
    <span className="text-ink-subtle -space-y-1 rounded px-1 py-1">
      <ChevronUp className="block size-3 stroke-[3]" />
      <ChevronDown className="block size-3 stroke-[3]" />
    </span>
  );
}

export function NavBar({
  sections,
  runs,
  active,
  onSelect,
  onCloseRun,
  onOpenSettings,
  dataDir,
}: {
  sections: NavTab[];
  runs: NavTab[];
  active: TabId;
  onSelect: (id: TabId) => void;
  onCloseRun: (id: TabId) => void;
  onOpenSettings: () => void;
  dataDir: string | null;
}): JSX.Element {
  const tabs = [...sections, ...runs];

  return (
    <>
      <header className="border-hairline bg-base flex items-center gap-2 border-b px-4 py-2 text-sm">
        <span className="text-ink-strong font-medium">Lirovo</span>
        <span className="text-ink-subtle">/</span>
        <span className="text-ink-label">Local</span>
        <span className="bg-tint text-ink-label rounded px-1.5 py-0.5 text-xs font-medium">DEV</span>
        <span className="text-ink-subtle">/</span>
        <button
          className="hover:bg-elevated text-ink-label hover:text-ink-strong max-w-[420px] truncate rounded px-1.5 py-0.5 transition-colors"
          title={dataDir ?? ""}
        >
          {dataDir === null ? "…" : dataDir.replace(/^.*\/([^/]+\/[^/]+)$/, "$1")}
        </button>
        <Stepper />
        <div className="ml-auto flex items-center gap-1">
          <button
            className="hover:bg-elevated text-ink-subtle hover:text-ink rounded p-1.5 transition-colors"
            onClick={onOpenSettings}
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </header>

      {/* The active tab carries a 2px underline flush with the row's bottom
          hairline, which is what makes the two rows read as one strip. */}
      <nav className="border-hairline bg-base flex border-b px-4">
        <div className="scrollbar-hide relative flex gap-1 overflow-x-auto whitespace-nowrap">
          {tabs.map((t) => {
            const isActive = active === t.id;
            return (
              <div key={t.id} className="group/tab relative flex items-center">
                <button
                  onClick={() => onSelect(t.id)}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-t px-3 py-2.5 transition-colors",
                    t.closable === true && "pr-7",
                    isActive ? "text-ink-strong font-medium" : "text-ink-label hover:text-ink-strong",
                  )}
                >
                  <span className="max-w-[220px] truncate">{t.label}</span>
                  {typeof t.count === "number" && (
                    <span className="bg-tint text-ink-label rounded-full px-1.5 text-xs">{t.count}</span>
                  )}
                  {isActive && <span className="bg-ink-strong absolute inset-x-2 -bottom-px h-0.5 rounded-full" />}
                </button>
                {t.closable === true && (
                  <button
                    className="hover:bg-fill text-ink-subtle hover:text-ink absolute right-1.5 rounded p-0.5 opacity-0 transition-opacity group-hover/tab:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseRun(t.id);
                    }}
                    title="Close this run"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </>
  );
}
