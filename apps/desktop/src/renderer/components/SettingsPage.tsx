import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  Download,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { Fix } from "@lirovo/contracts";
import { DEFAULT_WHISPER_MODEL_ID, WHISPER_MODELS } from "@lirovo/core";
import type { Preferences, UpdateState } from "../../bridge/contract.js";
import type { StorageReport } from "../../bridge/contract.js";
import { Hero } from "./hero";
import { Mark } from "./logos";
import { Skeleton } from "./primitives";

import { cn } from "../lib/cn";
import { useCopied } from "../lib/use-copied";
import { InstallButton } from "./system/install-button";
import { DOT, FETCHABLE, RANK, label, roleOf, type Health, type SystemReport } from "../lib/system-vocabulary";

interface Entry {
  readonly id: string;
  readonly group: string;
  readonly name: string;
  readonly role: string;
  readonly detail: string;
  readonly health: Health;
  readonly state: string;
  readonly fix: Fix | null;
  /** Set when this app can fetch and verify it rather than asking for a paste. */
  readonly fetchable: "whisper-model" | "yt-dlp" | null;
  /** Set on a row that is one of several the user picks between. */
  readonly selectable: boolean;
  readonly selected: boolean;
  readonly path: string | null;
}

const bytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1_073_741_824) return `${(n / 1_048_576).toFixed(0)} MB`;
  return `${(n / 1_073_741_824).toFixed(1)} GB`;
};

/** Everything the doctor found, as one flat inventory the table can group. */
const toEntries = (report: SystemReport): Entry[] => {
  const out: Entry[] = [];

  for (const dep of report.dependencies) {
    const base = { id: dep.id, group: "Media", name: label(dep.id), role: roleOf(dep.id, dep.why), path: dep.path };
    if (!dep.found) {
      out.push({
        ...base,
        detail: dep.fix?.command ?? "not found",
        health: dep.required ? "off" : "warn",
        state: dep.required ? "Missing" : "Optional",
        fix: dep.fix,
        fetchable: FETCHABLE[dep.id] ?? null,
        selectable: false,
        selected: false,
      });
      continue;
    }
    out.push({
      ...base,
      detail: `${dep.version ?? "installed"}${dep.origin === null ? "" : ` · ${dep.origin}`}`,
      health: dep.stale === null ? "ok" : "warn",
      state: dep.stale === null ? "Ready" : "Out of date",
      fix: dep.fix,
      fetchable: dep.stale === null ? null : (FETCHABLE[dep.id] ?? null),
      selectable: false,
      selected: false,
    });
  }

  const live = report.backends.filter((b) => b.available).map((b) => b.id);
  const effective = live.find((id) => id === report.defaultBackendId) ?? live[0] ?? null;
  for (const backend of report.backends) {
    out.push({
      id: backend.id,
      group: "Models",
      name: label(backend.id),
      role: roleOf(backend.id, "runs the model"),
      detail: backend.available
        ? `${backend.version ?? "connected"}${backend.images === "none" ? " · text only" : ""}`
        : (backend.fix?.command ?? backend.reason ?? "not available"),
      health: backend.available ? "ok" : "warn",
      state: backend.available ? "Connected" : "Off",
      fix: backend.available ? null : backend.fix,
      fetchable: null,
      selectable: backend.available,
      selected: backend.id === effective,
      path: null,
    });
  }

  for (const probe of report.asr) {
    const covers = [probe.forUrl ? "links" : null, probe.forFile ? "local files" : null].filter((k) => k !== null);
    out.push({
      id: probe.name,
      group: "Transcription",
      name: label(probe.name),
      role: roleOf(probe.name, "transcribes"),
      detail: covers.length > 0 ? covers.join(" + ") : (probe.hint ?? "unavailable"),
      health: covers.length > 0 ? "ok" : "warn",
      state: covers.length === 0 ? "Off" : covers.length === 1 ? "Partial" : "Ready",
      fix: null,
      fetchable: covers.length === 0 ? (FETCHABLE[probe.name] ?? null) : null,
      selectable: false,
      selected: false,
      path: null,
    });
  }

  return out;
};

const GROUPS = ["Media", "Transcription", "Models"] as const;

/** Copy-to-clipboard with its own confirmation. */
function CopyCommand({ fix }: { fix: Fix }): JSX.Element {
  const { copied, copy } = useCopied();
  return (
    <button
      onClick={() => copy(fix.command)}
      className="hover:bg-elevated flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : `Copy “${fix.label.toLowerCase()}” command`}
    </button>
  );
}

/**
 * One button for every fixable thing at once.
 *
 * On a fresh Mac two rows are red and both are fetchable, and asking someone
 * to find and press two buttons to reach a working app is asking them to do
 * the app's job. The per-row buttons stay for the case where only one is
 * wrong.
 */
function InstallAll({
  items,
  onDone,
}: {
  items: readonly ("whisper-model" | "yt-dlp")[];
  onDone: () => void;
}): JSX.Element {
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const unique = [...new Set(items)];

  if (failed !== null) {
    return (
      <span className="text-danger-text text-xs" title={failed}>
        {failed.slice(0, 48)}
      </span>
    );
  }

  return (
    <button
      disabled={working}
      onClick={() => {
        setWorking(true);
        void (async () => {
          for (const what of unique) {
            const answer = await window.lirovo.install(what);
            if (!answer.ok) {
              setFailed(answer.error.message);
              setWorking(false);
              return;
            }
          }
          setWorking(false);
          onDone();
        })();
      }}
      className="liq-solid liq-solid-brand flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium"
    >
      {working ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {working ? "Installing" : unique.length === 1 ? "Install it" : `Install ${unique.length}`}
    </button>
  );
}

/** The row menu: everything that is not the one obvious action. */
function RowMenu({ entry, onChoose }: { entry: Entry; onChoose: () => void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent): void => {
      if (wrap.current?.contains(e.target as Node) !== true) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const nothing = entry.fix === null && entry.path === null && !entry.selectable;
  if (nothing) return <span className="w-7" />;

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Actions for ${entry.name}`}
        className="text-ink-subtle hover:bg-elevated hover:text-ink grid size-7 place-items-center rounded transition-colors"
      >
        <MoreHorizontal className="size-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="border-hairline bg-base shadow-popover absolute right-0 top-8 z-30 w-60 origin-top-right rounded-xl border py-1.5"
          >
            {entry.selectable && !entry.selected && (
              <button
                onClick={() => {
                  onChoose();
                  setOpen(false);
                }}
                className="hover:bg-elevated flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]"
              >
                <Check className="size-3.5" />
                Use for the next extraction
              </button>
            )}
            {entry.fix !== null && <CopyCommand fix={entry.fix} />}
            {entry.path !== null && (
              <button
                onClick={() => {
                  void window.lirovo.reveal(entry.path as string);
                  setOpen(false);
                }}
                className="hover:bg-elevated flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]"
              >
                <FolderOpen className="size-3.5" />
                Reveal in Finder
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Which speech model transcribes.
 *
 * The only genuine choice on this page: English-only is twice as fast and
 * useless for a French keynote, and the large one is ten times the download
 * for accuracy most talks do not need. Choosing one that is not downloaded
 * downloads it — a radio button that silently does nothing until you find a
 * separate Install elsewhere is two steps pretending to be one.
 */
function SpeechModel({
  chosen,
  onChosen,
}: {
  chosen: string | null;
  onChosen: () => void;
}): JSX.Element {
  const [busy, setBusy] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const current = chosen ?? DEFAULT_WHISPER_MODEL_ID;

  useEffect(
    () =>
      window.lirovo.onInstallProgress((p) => {
        if (p.what !== "whisper-model" || p.total === null) return;
        setPct(Math.min(100, Math.round((p.received / p.total) * 100)));
      }),
    [],
  );

  return (
    <Card title="Speech model">
      {WHISPER_MODELS.map((model) => {
        const selected = model.id === current;
        const working = busy === model.id;
        return (
          <button
            key={model.id}
            disabled={busy !== null}
            onClick={() => {
              setBusy(model.id);
              setPct(0);
              void window.lirovo.install("whisper-model", model.id).then(() => {
                setBusy(null);
                onChosen();
              });
            }}
            className={cn(
              "border-hairline hover:bg-elevated flex w-full items-center gap-3 border-b px-4 py-2.5 text-left transition-colors last:border-b-0",
              selected && "bg-elevated",
            )}
          >
            <span
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full border",
                selected ? "border-ink-strong" : "border-line",
              )}
            >
              {selected && <span className="bg-ink-strong size-2 rounded-full" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-ink-strong block truncate text-[13px] font-medium">{model.label}</span>
              <span className="text-ink-subtle block truncate text-xs">{model.about}</span>
            </span>
            {working && (
              <span className="text-ink-subtle shrink-0 text-xs tabular-nums">
                {pct === null ? "…" : `${pct}%`}
              </span>
            )}
          </button>
        );
      })}
      <p className="border-hairline text-ink-subtle border-t px-4 py-2 text-xs">
        Picking one downloads it if it is not here yet. Nothing leaves this Mac either way.
      </p>
    </Card>
  );
}

/**
 * Which builds this copy accepts, and what it last found.
 *
 * Preview is opt-in and stays opt-in: nobody is moved onto prereleases by a
 * default. Choosing it also means stable releases still arrive — a beta user
 * who stops getting stable updates is a beta user stranded on an old build.
 */
function Updates(): JSX.Element {
  const [state, setState] = useState<UpdateState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(() => {
    void window.lirovo.updateState().then((answer) => {
      if (answer.ok) setState(answer.value);
    });
  }, []);
  useEffect(load, [load]);

  useEffect(
    () =>
      window.lirovo.onUpdateEvent((raw) => {
        const event = raw as { kind: string; version?: string; message?: string };
        if (event.kind === "checking") setNote("checking…");
        if (event.kind === "none") setNote("this is the newest build");
        if (event.kind === "available") setNote(`${event.version} is available`);
        if (event.kind === "ready") setNote(`${event.version} is downloaded`);
        // Shown here and nowhere else: a failed check is not worth a toast, but
        // somebody who came looking deserves the reason.
        if (event.kind === "error") setNote(event.message ?? "the check failed");
        if (event.kind !== "checking") setChecking(false);
      }),
    [],
  );

  return (
    <Card title="Updates">
      <div className="grid gap-x-8 gap-y-2 px-4 py-3 text-[13px]">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-ink-label">This copy</span>
          <span className="text-ink-strong tabular-nums">{state?.version ?? "…"}</span>
        </div>
      </div>

      <div className="border-hairline border-t">
        {(["latest", "beta"] as const).map((channel) => {
          const on = state?.channel === channel;
          return (
            <button
              key={channel}
              onClick={() => {
                void window.lirovo.updateChannel(channel).then((answer) => {
                  if (answer.ok) setState(answer.value);
                });
              }}
              className={cn(
                "border-hairline hover:bg-elevated flex w-full items-center gap-3 border-b px-4 py-2.5 text-left transition-colors last:border-b-0",
                on && "bg-elevated",
              )}
            >
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full border",
                  on ? "border-ink-strong" : "border-line",
                )}
              >
                {on && <span className="bg-ink-strong size-2 rounded-full" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-ink-strong block text-[13px] font-medium">
                  {channel === "latest" ? "Stable" : "Preview"}
                </span>
                <span className="text-ink-subtle block text-xs">
                  {channel === "latest"
                    ? "Released builds only"
                    : "Prereleases as they are cut, and every stable one too"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-hairline flex items-center gap-3 border-t px-4 py-2.5">
        <button
          disabled={checking || state?.supported === false}
          onClick={() => {
            setChecking(true);
            setNote("checking…");
            void window.lirovo.updateCheck().then((answer) => {
              if (!answer.ok) {
                setChecking(false);
                setNote(answer.error.message);
              }
            });
          }}
          className="border-hairline bg-base hover:bg-fill-hover flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", checking && "animate-spin")} />
          Check now
        </button>
        <span className="text-ink-subtle min-w-0 flex-1 truncate text-xs">
          {state?.supported === false ? "a copy run from source does not update itself" : (note ?? "")}
        </span>
      </div>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="border-hairline bg-base overflow-hidden rounded-xl border">
      <div className="border-hairline border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Line({ label: name, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2 text-[13px]">
      <span className="text-ink-label">{name}</span>
      <span className="text-ink-strong min-w-0 truncate text-right">{value}</span>
    </div>
  );
}

/**
 * Everything the app keeps, and everything it needs.
 *
 * The inventory is a grouped table because that is what it is — one row per
 * thing, a state, and the actions behind a menu — and the cards on the right
 * are the settings that are not inventory: where the data lives, how much of
 * it there is, and the two ways to delete it. Deleting is not hidden behind a
 * gesture, but it is the only thing on this page that asks twice.
 */
export function SettingsPage({
  report,
  onRecheck,
  onChooseBackend,
  checking,
}: {
  report: SystemReport | null;
  onRecheck: () => void;
  onChooseBackend: (backendId: string) => void;
  checking: boolean;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [storage, setStorage] = useState<StorageReport | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadStorage = useCallback(() => {
    void window.lirovo.storage().then((answer) => {
      if (answer.ok) setStorage(answer.value);
    });
    void window.lirovo.preferences().then((answer) => {
      if (answer.ok) setPrefs(answer.value);
    });
  }, []);
  useEffect(loadStorage, [loadStorage]);
  // The report is refetched after an install; the rail has to follow it.
  useEffect(loadStorage, [loadStorage, report]);

  const entries = useMemo(() => (report === null ? [] : toEntries(report)), [report]);
  const needle = query.trim().toLowerCase();
  const shown = entries
    .filter((e) => needle === "" || [e.name, e.role, e.detail, e.state].join(" ").toLowerCase().includes(needle))
    // Broken first inside each group. A list in declaration order buries the
    // one row that needs anything among the six that do not.
    .sort((a, b) => RANK[a.health] - RANK[b.health]);

  const needsWork = entries.filter((e) => e.health !== "ok");
  const installable = needsWork.filter((e) => e.fetchable !== null);

  const purge = (what: "runs" | "everything"): void => {
    void window.lirovo.purge(what).then((answer) => {
      if (!answer.ok) {
        setNote(answer.error.message);
        return;
      }
      if (answer.value.cancelled) return;
      setNote(`Freed ${bytes(answer.value.freedBytes)}`);
      loadStorage();
      onRecheck();
    });
  };

  return (
    <div className="pb-16">
      <Hero title="Settings" sub="What this Mac can do, where the data lives, and how to remove it." />

      {/* Nothing when nothing is wrong. A banner that is always there is a
          banner nobody reads on the day it matters. */}
      {needsWork.length > 0 && (
        <section className="border-warning/30 bg-warning-tint/40 mt-8 flex flex-wrap items-center gap-3 rounded-xl border px-5 py-4">
          <TriangleAlert className="text-warning-text size-4 shrink-0" strokeWidth={1.75} />
          <span className="text-warning-text min-w-0 flex-1 text-sm font-medium">
            {needsWork.length === 1
              ? `${needsWork[0]?.name} needs attention`
              : `${needsWork.length} components need attention`}
            <span className="text-ink-label ml-2 font-normal">
              {needsWork.map((e) => e.name).join(", ")}
            </span>
          </span>
          {installable.length > 0 && (
            <InstallAll items={installable.map((e) => e.fetchable as "whisper-model" | "yt-dlp")} onDone={onRecheck} />
          )}
        </section>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
        <section className="border-hairline bg-base overflow-hidden rounded-xl border">
          <div className="border-hairline flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <h3 className="text-sm font-semibold">Components</h3>
            <span className="text-ink-subtle text-xs tabular-nums">
              {entries.filter((e) => e.health === "ok").length} of {entries.length} ready
            </span>
          </div>
          <div className="border-hairline flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <label className="shadow-control focus-within:shadow-[0_0_0_1px_var(--kumo-focus)] bg-base flex h-9 min-w-48 flex-1 items-center gap-2 rounded-lg px-3">
              <Search className="text-ink-placeholder size-4 shrink-0" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="text-ink placeholder:text-ink-placeholder min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
            {/* No filter chips: the group headers below already ARE the
                categories, and two controls for one distinction is one too
                many. Search covers the case a header cannot. */}
            <button
              onClick={onRecheck}
              disabled={checking}
              className="border-hairline text-ink-label hover:bg-fill-hover flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", checking && "animate-spin")} />
              Recheck
            </button>
          </div>

          {report === null ? (
            <div className="grid gap-3 px-4 py-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-ink-subtle text-left text-[11px] uppercase tracking-wide">
                  <th className="border-hairline border-b px-4 py-2 font-medium">Component</th>
                  <th className="border-hairline border-b px-3 py-2 font-medium">Status</th>
                  <th className="border-hairline border-b px-3 py-2 font-medium">Detail</th>
                  <th className="border-hairline w-0 border-b p-0" />
                </tr>
              </thead>
              <tbody>
                {GROUPS.filter((g) => shown.some((e) => e.group === g)).map((g) => (
                  <>
                    <tr key={g}>
                      <td colSpan={4} className="bg-recessed border-hairline text-ink-label border-b px-4 py-1.5 text-xs">
                        {g}
                      </td>
                    </tr>
                    {shown
                      .filter((e) => e.group === g)
                      .map((entry) => (
                        <tr key={`${g}:${entry.id}`} className="group hover:bg-elevated">
                          <td className="border-hairline border-b px-4 py-2.5">
                            <span className="flex items-center gap-2.5">
                              <span className="bg-base shadow-ring grid size-7 shrink-0 place-items-center rounded-md">
                                <Mark id={entry.id} className={cn("size-4", entry.health === "off" && "opacity-40")} />
                              </span>
                              <span className="min-w-0">
                                <span className="text-ink-strong flex items-center gap-2 truncate text-[13px] font-medium">
                                  {entry.name}
                                  {entry.selected && (
                                    <span className="bg-fill-hover text-ink-label rounded px-1.5 text-[10px] font-semibold">
                                      DEFAULT
                                    </span>
                                  )}
                                </span>
                                <span className="text-ink-subtle block truncate text-xs">{entry.role}</span>
                              </span>
                            </span>
                          </td>
                          <td className="border-hairline whitespace-nowrap border-b px-3 py-2.5">
                            {/* A dot alone for the healthy ones. Seven rows
                                that all say "Ready" teach the eye to skip the
                                column that will one day say something else. */}
                            <span
                              className={cn(
                                "flex items-center gap-1.5 text-xs",
                                entry.health === "ok" ? "text-ink-subtle" : "text-ink-strong font-medium",
                              )}
                            >
                              <span className={cn("size-1.5 rounded-full", DOT[entry.health])} />
                              {entry.health === "ok" ? "" : entry.state}
                            </span>
                          </td>
                          <td
                            className={cn(
                              "border-hairline text-ink-label max-w-[280px] truncate border-b px-3 py-2.5 text-xs",
                              entry.fix !== null && "font-mono",
                            )}
                            title={entry.detail}
                          >
                            {entry.detail}
                          </td>
                          <td className="border-hairline border-b px-3 py-2.5">
                            <span className="flex items-center justify-end gap-1.5">
                              {entry.fetchable !== null && (
                                <InstallButton what={entry.fetchable} onDone={onRecheck} />
                              )}
                              <RowMenu entry={entry} onChoose={() => onChooseBackend(entry.id)} />
                            </span>
                          </td>
                        </tr>
                      ))}
                  </>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-ink-subtle px-4 py-10 text-center text-sm">
                      Nothing matches “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>

        <div className="grid gap-4">
          <Card title="Data">
            {storage === null ? (
              <div className="px-4 py-3">
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <>
                <div className="px-4 py-2">
                  <p className="text-ink-subtle text-xs">Everything is in one folder</p>
                  <p className="text-ink-label mt-0.5 break-all font-mono text-[11px]">{storage.dataDir}</p>
                </div>
                <div className="border-hairline border-t">
                  <Line label="Extractions" value={`${storage.runCount} · ${bytes(storage.runsBytes)}`} />
                  <Line label="Speech models" value={bytes(storage.modelsBytes)} />
                  <Line label="Installed tools" value={bytes(storage.binBytes)} />
                  <Line label="Database" value={bytes(storage.dbBytes)} />
                </div>
                <div className="border-hairline border-t px-4 py-2.5">
                  <button
                    onClick={() => void window.lirovo.reveal(storage.dataDir)}
                    className="border-hairline bg-base hover:bg-fill-hover flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors"
                  >
                    <FolderOpen className="size-3.5" />
                    Reveal in Finder
                  </button>
                </div>
              </>
            )}
          </Card>

          <SpeechModel chosen={prefs?.whisperModelId ?? null} onChosen={onRecheck} />
          <Updates />
        </div>
      </div>

      {/* Last on the page, and only after everything safe. A destructive
          control beside the one you came to use is a control that gets hit by
          the pointer that was aiming at its neighbour. */}
      <section className="border-danger-text/25 mt-10 overflow-hidden rounded-xl border">
        <div className="border-danger-text/25 bg-danger-tint/30 border-b px-5 py-2.5">
          <h3 className="text-danger-text text-sm font-semibold">Danger zone</h3>
        </div>
        <div className="bg-base">
          <div className="border-hairline flex flex-wrap items-center gap-4 border-b px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-ink-strong text-[13px] font-medium">Delete every extraction</p>
              <p className="text-ink-subtle mt-0.5 text-xs">
                Runs, frames, transcripts and graphs
                {storage === null ? "" : ` — ${storage.runCount} of them, ${bytes(storage.runsBytes)}`}. Schemas,
                settings and the speech model stay.
              </p>
            </div>
            <button
              onClick={() => purge("runs")}
              className="border-hairline bg-base hover:bg-fill-hover flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs transition-colors"
            >
              <Trash2 className="size-3.5" />
              Delete extractions
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-ink-strong text-[13px] font-medium">Remove everything</p>
              <p className="text-ink-subtle mt-0.5 text-xs">
                The whole folder: database, extractions, schemas, the speech model and any tool this app installed.
                That is what uninstall means for an app whose entire state is one directory.
              </p>
            </div>
            <button
              onClick={() => purge("everything")}
              className="border-danger-text/30 bg-danger-tint/40 text-danger-text hover:bg-danger-tint flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors"
            >
              <Trash2 className="size-3.5" />
              Remove everything
            </button>
          </div>
        </div>
        {note !== null && (
          <p className="border-danger-text/25 bg-base text-ink-subtle border-t px-5 py-2 text-xs">{note}</p>
        )}
      </section>
    </div>
  );
}
