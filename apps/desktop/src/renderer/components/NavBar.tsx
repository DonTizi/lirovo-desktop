import {
  FileVideo,
  Library,
  ListFilter,
  Loader2,
  PanelLeftClose,
  Plus,
  Settings,
  X,
  CircleAlert,
  HardDrive,
  Folder,
  FolderOpen,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { RunSummary } from "../../bridge/contract.js";
import { groupRuns, runGroupKey } from "../lib/run-groups";

const COLLAPSED_KEY = "lirovo:collapsed-schema-folders";
function readCollapsed(): Set<string> {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(COLLAPSED_KEY) ?? "[]",
    );
    return new Set(
      Array.isArray(value)
        ? value.filter((key): key is string => typeof key === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export type TabId = string;

export function NavBar({
  runs,
  openRunIds,
  active,
  onSelect,
  onOpenRun,
  onCloseRun,
  onCollapse,
  toggleRef,
  attention,
  ready,
  dataDir,
  error,
}: {
  runs: RunSummary[];
  openRunIds: ReadonlySet<string>;
  active: TabId;
  onSelect: (id: TabId) => void;
  onOpenRun: (id: string) => void;
  onCloseRun: (id: string) => void;
  onCollapse: () => void;
  toggleRef: React.RefObject<HTMLButtonElement>;
  attention: number;
  ready: boolean;
  dataDir: string | null;
  error: string | null;
}): JSX.Element {
  const groups = groupRuns(runs);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const groupId = useId();
  const selectedRun = runs.find((run) => run.runId === active);
  const selectedGroup = selectedRun ? runGroupKey(selectedRun) : null;
  const previousSelection = useRef({ active, selectedGroup });
  useEffect(() => {
    if (
      previousSelection.current.active !== active ||
      previousSelection.current.selectedGroup !== selectedGroup
    ) {
      if (selectedGroup)
        setCollapsed((current) => {
          if (!current.has(selectedGroup)) return current;
          const next = new Set(current);
          next.delete(selectedGroup);
          return next;
        });
    }
    previousSelection.current = { active, selectedGroup };
  }, [active, selectedGroup]);
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    } catch {
      /* Optional display preference; navigation still works. */
    }
  }, [collapsed]);
  const sections = [
    { id: "overview", label: "New extraction", icon: Plus },
    { id: "library", label: "Library", icon: Library },
    { id: "knowledge", label: "Knowledge", icon: BookOpen },
    { id: "schemas", label: "Schemas", icon: ListFilter },
  ];
  return (
    <aside
      id="workspace-sidebar"
      className="workspace-sidebar flex h-full shrink-0 flex-col"
    >
      <div className="workspace-toolbar flex h-8 shrink-0 items-center justify-end pr-3">
        <button
          className="text-ink-tertiary hover:text-ink rounded-lg p-2"
          onClick={onCollapse}
          ref={toggleRef}
          aria-label="Hide sidebar"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>
      <div className="px-3 pb-4 pt-2">
        <span className="text-[17px] font-semibold tracking-tight">Lirovo</span>
      </div>
      <nav aria-label="Main navigation" className="px-1.5">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className="workspace-nav-item"
            aria-current={active === id ? "page" : undefined}
            onClick={() => onSelect(id)}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.5} />
            <span>{label}</span>
            {id === "library" && (
              <span className="text-ink-tertiary ml-auto text-xs tabular-nums">
                {runs.length}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="mt-7 flex min-h-0 flex-1 flex-col">
        <p className="text-ink-tertiary px-3 pb-2 text-sm">
          Extractions by schema
        </p>
        <div className="min-h-0 overflow-y-auto px-1.5 pb-4">
          {error !== null && (
            <p role="alert" className="text-danger-text px-3 py-2 text-xs">
              {error}
            </p>
          )}
          {runs.length === 0 && error === null && (
            <p className="text-ink-tertiary px-3 py-2 text-xs">
              Your extractions will appear here.
            </p>
          )}
          {groups.map((schemaGroup) => {
            const expanded = !collapsed.has(schemaGroup.key);
            const FolderIcon = expanded ? FolderOpen : Folder;
            const panelId = `${groupId}-${encodeURIComponent(schemaGroup.key)}`;
            const working = schemaGroup.runs.filter(
              (run) => run.status === "running" || run.status === "claimed",
            ).length;
            return (
              <section key={schemaGroup.key} className="workspace-schema-group">
                <button
                  className="workspace-nav-item workspace-schema-toggle"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  title={`${schemaGroup.name} · ${schemaGroup.runs.length} extractions${working ? ` · ${working} running` : ""}`}
                  data-current={selectedGroup === schemaGroup.key}
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(schemaGroup.key))
                        next.delete(schemaGroup.key);
                      else next.add(schemaGroup.key);
                      return next;
                    })
                  }
                >
                  <FolderIcon
                    className="size-4 shrink-0"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {schemaGroup.name}
                  </span>
                  {working > 0 ? (
                    <Loader2
                      className="size-3 shrink-0 animate-spin"
                      aria-label={`${working} running`}
                      role="img"
                    />
                  ) : null}
                  <span className="text-ink-tertiary text-[11px] tabular-nums">
                    {schemaGroup.runs.length}
                  </span>
                  <ChevronRight
                    className="workspace-schema-chevron size-3 shrink-0"
                    aria-hidden="true"
                  />
                </button>
                <div
                  id={panelId}
                  hidden={!expanded}
                  className="workspace-schema-children"
                >
                  {schemaGroup.runs.map((run) => (
                    <div className="group relative" key={run.runId}>
                      <button
                        className="workspace-nav-item pr-8 text-sm"
                        aria-current={active === run.runId ? "page" : undefined}
                        title={`${run.title ?? run.runId} · ${run.status} · ${new Date(run.createdAt * 1000).toLocaleDateString()}`}
                        onClick={() => onOpenRun(run.runId)}
                      >
                        {run.status === "running" ||
                        run.status === "claimed" ? (
                          <Loader2
                            className="size-4 shrink-0 animate-spin"
                            aria-label="Running"
                            role="img"
                          />
                        ) : run.status === "failed" ? (
                          <CircleAlert
                            className="text-danger-text size-4 shrink-0"
                            aria-label="Failed"
                            role="img"
                          />
                        ) : (
                          <FileVideo
                            className="text-ink-tertiary size-4 shrink-0"
                            strokeWidth={1.5}
                          />
                        )}
                        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                          {run.title ?? run.runId}
                        </span>
                      </button>
                      {openRunIds.has(run.runId) && (
                        <button
                          className="text-ink-tertiary hover:bg-fill absolute right-1 top-1 rounded p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                          onClick={(event) => {
                            event.currentTarget.parentElement
                              ?.querySelector("button")
                              ?.focus();
                            onCloseRun(run.runId);
                          }}
                          aria-label={`Close ${run.title ?? "extraction"}`}
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <div className="border-hairline shrink-0 border-t p-1.5">
        <button
          className="workspace-nav-item"
          aria-current={active === "settings" ? "page" : undefined}
          onClick={() => onSelect("settings")}
        >
          <Settings className="size-4" strokeWidth={1.5} />
          Settings
          {attention > 0 && (
            <span className="text-warning-text ml-auto text-xs">
              {attention}
            </span>
          )}
        </button>
        <div
          className="text-ink-tertiary flex items-center gap-2 px-2 pb-1 pt-2 text-xs"
          title={dataDir ?? undefined}
        >
          <HardDrive className="size-3.5" />
          <span>Local workspace</span>
          <span
            className={`ml-auto size-1.5 rounded-full ${ready ? "bg-governed" : "bg-partial"}`}
          />
          <span>{ready ? "Ready" : "Setup"}</span>
        </div>
      </div>
    </aside>
  );
}
