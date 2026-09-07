import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { LirovoMark } from "./components/LirovoMark";
import { type PipelineEvent, type Stage } from "@lirovo/contracts";
import { SCHEMA_PRESETS, compileSchema, type FieldSpec } from "@lirovo/core";
import { submittedSchemaKey as categoryKeyFor } from "../bridge/schema-identity";
import type { RunDetail, RunSummary } from "../bridge/contract.js";
import { NavBar, type TabId } from "./components/NavBar";
import { Onboarding } from "./components/Onboarding";
import { applyChoice, type ThemeChoice } from "./lib/theme";
import { TitleBar } from "./components/TitleBar";
import { SourceInput } from "./components/SourceInput";
import { RunProgress, type LiveStage } from "./components/RunProgress";
import { eventStage } from "./components/progress-model";
import { isWorking } from "./components/progress-model";
import { pollSerial } from "./lib/poll";
import { pendingRun } from "./lib/run-session";
import { RunView } from "./components/run/run-view";
import { SchemaPicker } from "./components/SchemaPicker";
import { Library } from "./components/library";
import { SchemasPage } from "./components/SchemasPage";
import { SettingsPage } from "./components/SettingsPage";
import { UpdateToast } from "./components/UpdateToast";
import { type SystemReport } from "./components/SystemPanel";

/**
 * Stage state built only from events the engine actually sent.
 *
 * No timers, no interpolation. A bar that advances on a clock lies the moment a
 * stage takes longer than its author guessed, and a user who catches it once
 * stops believing the rest of the screen.
 */
const useStages = (): {
  byRun: Map<string, Map<Stage, LiveStage>>;
  reset: (runId: string) => void;
  apply: (event: PipelineEvent) => void;
} => {
  const [byRun, setByRun] = useState<Map<string, Map<Stage, LiveStage>>>(
    new Map(),
  );

  const reset = useCallback((runId: string) => {
    setByRun((current) => {
      const next = new Map(current);
      next.delete(runId);
      return next;
    });
  }, []);

  const apply = useCallback((event: PipelineEvent) => {
    setByRun((current) => {
      const next = new Map(current);
      // Keyed by run, because two tabs can be open on two runs and a single
      // map would paint one run's vision progress onto the other's row.
      const mine = new Map(next.get(event.runId) ?? []);
      const update = eventStage(event);
      if (update !== null) mine.set(update.stage, update.value);
      next.set(event.runId, mine);
      return next;
    });
  }, []);

  return { byRun, reset, apply };
};

export const App = (): JSX.Element => {
  const [tab, setTab] = useState<TabId>("overview");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [fields, setFields] = useState<FieldSpec[]>([
    ...(SCHEMA_PRESETS[0]?.fields ?? []),
  ]);
  const [schemaLabel, setSchemaLabel] = useState(
    SCHEMA_PRESETS[0]?.label ?? "Transcript only",
  );
  const [schemaVersion, setSchemaVersion] = useState<number | null>(null);
  // Set only while the fields are exactly a stored revision, so a run can point
  // at the contract it was actually asked with.
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarToggle = useRef<HTMLButtonElement>(null);
  const previousCollapsed = useRef(sidebarCollapsed);
  useEffect(() => {
    if (previousCollapsed.current !== sidebarCollapsed)
      sidebarToggle.current?.focus();
    previousCollapsed.current = sidebarCollapsed;
  }, [sidebarCollapsed]);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [openTabs, setOpen] = useState<Map<string, RunDetail>>(new Map());
  const [system, setSystem] = useState<SystemReport | null>(null);
  // `null` until the engine answers. Rendering the first-run screen on a guess
  // would flash it at every returning user for one frame.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  // `null` until the engine answers. The pre-paint script in index.html has
  // already put a palette on the document by then, so there is nothing to draw
  // and nothing to flash.
  const [themeChoice, setThemeChoice] = useState<ThemeChoice | null>(null);
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const { byRun, reset, apply } = useStages();
  // The run this window is executing, so its tab can show it live.
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const sessionIds = useRef(new Set<string>());
  const pendingReads = useRef(new Set<string>());
  const executingRun = useRef<string | null>(null);
  const submittedSource = useRef("");
  const submittedAt = useRef(0);
  const submittedSchemaName = useRef<string | null>(null);
  const submittedCategory = useRef<string>("unknown");

  const refreshRun = useCallback(async (runId: string) => {
    if (pendingReads.current.has(runId)) return;
    pendingReads.current.add(runId);
    try {
      const got = await window.lirovo.runDetail(runId);
      if (!sessionIds.current.has(runId)) return;
      if (got.ok && got.value !== null) {
        const loaded = got.value;
        setOpen((current) => new Map(current).set(runId, loaded));
      } else if (!got.ok)
        setRunsError(`${got.error.code}: ${got.error.message}`);
    } catch (cause) {
      setRunsError(`Could not refresh extraction: ${String(cause)}`);
    } finally {
      pendingReads.current.delete(runId);
    }
  }, []);

  const openRun = useCallback(
    (runId: string) => {
      sessionIds.current.add(runId);
      setQuery("");
      setTab(runId);
      void refreshRun(runId);
    },
    [refreshRun],
  );

  // The main process decides whether it may quit and install, and it cannot
  // see the engine's state. It is told here, whenever the answer changes —
  // without this the guard is dead and "Restart now" ends a running
  // extraction.
  useEffect(() => {
    void window.lirovo.busy(running);
  }, [running]);

  const loadRuns = useCallback(async () => {
    const answer = await window.lirovo.listRuns();
    if (answer.ok) {
      setRuns(answer.value);
      setRunsError(null);
      return;
    }
    // Never silent. A query that throws used to render as "Nothing extracted
    // yet", which is the same picture as a working app with no runs — and the
    // one state where the user has no reason to suspect anything is wrong.
    setRunsError(`${answer.error.code}: ${answer.error.message}`);
  }, []);

  useEffect(
    () =>
      window.lirovo.onEngineEvent((e) => {
        const event = e as PipelineEvent;
        apply(event);
        // The id is only knowable from the stream: `extract` does not answer
        // until the run is over, and the progress has to be watchable before
        // that. `run:start` is the first thing the engine sends.
        if (event.type === "run:start") {
          reset(event.runId);
          setActiveRunId(event.runId);
          executingRun.current = event.runId;
          setOpen((current) =>
            new Map(current).set(
              event.runId,
              pendingRun(event.runId, submittedSource.current),
            ),
          );
          openRun(event.runId);
          void loadRuns();
        }
        if (
          event.type === "run:done" ||
          event.type === "run:failed" ||
          event.type === "run:cancelled"
        ) {
          void loadRuns();
        }
      }),
    [apply, reset, loadRuns, openRun],
  );

  // Asking the engine what this machine can do is also the first proof that the
  // engine process started and that the bridge works. If either is wrong the
  // user learns it here, not after picking a two-hour video.
  const check = useCallback(async () => {
    setChecking(true);
    const answer = await window.lirovo.doctor();
    setChecking(false);
    if (!answer.ok) {
      setBridgeError(`${answer.error.code}: ${answer.error.message}`);
      return;
    }
    const report = answer.value as SystemReport & { paths: { data: string } };
    setBridgeError(null);
    setSystem(report);
    setDataDir(report.paths.data);
  }, []);

  useEffect(() => {
    void check();
    void loadRuns();
    void window.lirovo.preferences().then((answer) => {
      if (answer.ok) {
        setOnboarded(answer.value.onboarded);
        setThemeChoice(answer.value.theme);
      }
    });
  }, [check, loadRuns]);

  // The choice drives the document; the document is never read back. One
  // direction, one property, and nothing to keep in step.
  //
  // No listener for the system palette: `applyChoice` clears the inline value
  // for `system`, and the stylesheet's own `color-scheme: light dark` then
  // follows the machine live. The browser was already doing the job.
  useEffect(() => {
    if (themeChoice !== null) applyChoice(themeChoice);
  }, [themeChoice]);

  /** Painted immediately, then confirmed: a click that waits on a round trip
   *  before the check moves reads as broken. */
  const chooseBackend = (backendId: string): void => {
    setSystem((current) =>
      current === null ? current : { ...current, defaultBackendId: backendId },
    );
    void window.lirovo.setDefaultBackend(backendId).then((answer) => {
      if (!answer.ok) return;
      setSystem((current) =>
        current === null
          ? current
          : { ...current, defaultBackendId: answer.value.defaultBackendId },
      );
    });
  };

  const start = async (): Promise<void> => {
    if (running || source.trim() === "") return;
    setError(null);
    setActiveRunId(null);
    setRunning(true);
    submittedSource.current = source.trim();
    submittedAt.current = Date.now() / 1000;
    submittedSchemaName.current =
      fields.length === 0 ? "Transcript only" : schemaLabel;
    executingRun.current = null;
    setTab("overview");

    const schemaJson =
      fields.length === 0 ? null : JSON.stringify(compileSchema(fields));
    const answer = await categoryKeyFor(schemaJson, selectedSchemaId)
      .then((key) => {
        submittedCategory.current = key;
        return window.lirovo.extract({
          source: source.trim(),
          // No fields means transcribe and detect scenes, and fill nothing in.
          schemaJson,
          backendId: null,
          schemaRevisionId: revisionId,
          schemaName: submittedSchemaName.current,
        });
      })
      .catch((cause) => ({
        ok: false as const,
        error: { code: "EXTRACTION_INTERRUPTED", message: String(cause) },
      }));
    setRunning(false);
    void loadRuns();

    if (!answer.ok) {
      setError(`${answer.error.code}: ${answer.error.message}`);
      const id = executingRun.current;
      if (id !== null && sessionIds.current.has(id)) {
        setOpen((current) => {
          const previous = current.get(id);
          return previous
            ? new Map(current).set(id, {
                ...previous,
                status:
                  answer.error.code === "CANCELLED" ? "cancelled" : "failed",
                errorCode: answer.error.code,
                errorMessage: answer.error.message,
              })
            : current;
        });
        void refreshRun(id);
      }
      return;
    }
    // Completion refreshes the session without taking the user away from another page.
    await refreshRun((answer.value as { runId: string }).runId);
  };

  // Anything unfinished keeps refreshing. Without this a run only updates when
  // the user clicks something, which is exactly when it looks stuck.
  const watching =
    running ||
    runs.some((r) => isWorking(r.status)) ||
    [...openTabs.values()].some((r) => isWorking(r.status));
  useEffect(() => {
    if (!watching) return;
    return pollSerial(async () => {
      await loadRuns().catch((cause) => setRunsError(String(cause)));
      await Promise.all([...sessionIds.current].map(refreshRun));
    });
  }, [watching, loadRuns, refreshRun]);

  const detail = openTabs.get(tab) ?? null;
  const values = useMemo(() => {
    if (detail === null) return [];
    const needle = query.trim().toLowerCase();
    const rows = [...detail.values].sort(
      (a, b) => b.reviewPriority - a.reviewPriority,
    );
    if (needle === "") return rows;
    return rows.filter(
      (r) =>
        r.fieldPath.toLowerCase().includes(needle) ||
        r.value.toLowerCase().includes(needle) ||
        r.evidence.some((e) => (e.quote ?? "").toLowerCase().includes(needle)),
    );
  }, [detail, query]);
  const grounded = values.filter((v) => v.evidence.length > 0).length;

  const attention =
    system === null
      ? 0
      : (system.ok ? 0 : system.problems.length) + system.warnings.length;
  const firstRun = onboarded === false && system !== null;
  const title = firstRun
    ? "Welcome to Lirovo"
    : detail !== null
      ? (detail.title ?? detail.runId)
      : tab === "overview"
        ? "New extraction"
        : tab === "library"
          ? "Library"
          : tab === "schemas"
            ? "Schemas"
            : "Settings";

  return (
    <MotionConfig reducedMotion="user">
      <div className="text-ink flex h-full overflow-hidden">
        {!sidebarCollapsed && (
          <NavBar
            runs={
              activeRunId !== null &&
              !runs.some((r) => r.runId === activeRunId) &&
              openTabs.has(activeRunId)
                ? [
                    {
                      runId: activeRunId,
                      title: openTabs.get(activeRunId)!.title,
                      status: openTabs.get(activeRunId)!.status,
                      createdAt: submittedAt.current,
                      valueCount: 0,
                      groundedCount: 0,
                      durationS: null,
                      sourceType: null,
                      schemaName: submittedSchemaName.current,
                      schemaKey: submittedCategory.current,
                      frameCount: null,
                    },
                    ...runs,
                  ]
                : runs
            }
            openRunIds={new Set(openTabs.keys())}
            active={tab}
            onSelect={setTab}
            onOpenRun={(id) => void openRun(id)}
            onCloseRun={(id) => {
              sessionIds.current.delete(id);
              setOpen((current) => {
                const next = new Map(current);
                next.delete(id);
                return next;
              });
              if (tab === id) setTab("library");
            }}
            onCollapse={() => setSidebarCollapsed(true)}
            toggleRef={sidebarToggle}
            attention={attention}
            ready={system?.ok === true && bridgeError === null}
            dataDir={dataDir}
            error={runsError}
          />
        )}
        <div className="workspace-main flex min-w-0 flex-1 flex-col">
          <TitleBar
            title={title}
            query={query}
            onQuery={setQuery}
            grounded={grounded}
            total={values.length}
            showSearch={detail !== null}
            running={running}
            onCancel={() => void window.lirovo.cancel()}
            onRefresh={() => void loadRuns()}
            sidebarCollapsed={sidebarCollapsed}
            onShowSidebar={() => setSidebarCollapsed(false)}
            toggleRef={sidebarToggle}
          />
          <UpdateToast />
          <main className="min-h-0 flex-1 overflow-auto">
            {firstRun && system !== null && (
              <div className="mx-auto max-w-5xl px-8 py-10">
                <Onboarding
                  report={system}
                  checking={checking}
                  onRecheck={() => void check()}
                  onChooseBackend={chooseBackend}
                  onDone={() => {
                    setOnboarded(true);
                    void window.lirovo.markOnboarded();
                  }}
                />
              </div>
            )}
            {!firstRun && tab === "overview" && (
              <div className="workspace-overview">
                {running && activeRunId === null ? (
                  <div className="workspace-progress">
                    <RunProgress
                      status="running"
                      live={byRun.get(activeRunId ?? "") ?? new Map()}
                      attempts={[]}
                      errorMessage={error}
                    />
                  </div>
                ) : (
                  <div className="workspace-welcome">
                    <LirovoMark className="text-ink-secondary mb-7 size-11 opacity-75" />
                    <h1 className="text-ink text-[28px] font-normal leading-tight tracking-[-0.02em]">
                      What would you like to extract?
                    </h1>
                  </div>
                )}
                <div className="workspace-compose">
                  <p className="text-ink-tertiary mb-6 flex items-center gap-2 px-4 text-sm">
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                    Your library stays on this device.
                  </p>
                  {(bridgeError ??
                    (system !== null && !system.ok
                      ? (system.problems[0] ?? null)
                      : null)) !== null && (
                    <div
                      role="alert"
                      className="border-danger/30 bg-danger-soft text-danger-text mb-4 rounded-xl border p-4 text-sm"
                    >
                      <p>{bridgeError ?? system?.problems[0]}</p>
                      <button
                        className="mt-2 underline underline-offset-4"
                        onClick={() => setTab("settings")}
                      >
                        Open settings to resolve this
                      </button>
                    </div>
                  )}
                  <fieldset disabled={running} className="min-w-0">
                    <SchemaPicker
                      label={schemaLabel}
                      version={schemaVersion}
                      fields={fields}
                      onChoose={(choice) => {
                        setFields([...choice.fields]);
                        setSchemaLabel(choice.label);
                        setRevisionId(choice.revisionId);
                        setSelectedSchemaId(choice.schemaId ?? null);
                        setSchemaVersion(null);
                        if (choice.revisionId !== null) {
                          void window.lirovo.listSchemas().then((answer) => {
                            if (!answer.ok) return;
                            setSchemaVersion(
                              answer.value.find((x) => x.name === choice.label)
                                ?.version ?? null,
                            );
                          });
                        }
                      }}
                      onEdit={(next) => {
                        setFields(next);
                        setRevisionId(null);
                        setSelectedSchemaId(null);
                        setSchemaVersion(null);
                        setSchemaLabel((current) =>
                          current.endsWith(" (edited)")
                            ? current
                            : `${current} (edited)`,
                        );
                      }}
                      onManage={() => setTab("schemas")}
                    />
                  </fieldset>
                  <SourceInput
                    value={source}
                    onChange={setSource}
                    onSubmit={() => void start()}
                    busy={running}
                    onBrowse={() => {
                      void window.lirovo.pickFile().then((picked) => {
                        if (picked.ok && picked.value !== null)
                          setSource(picked.value);
                      });
                    }}
                  />
                  {error !== null && (
                    <p
                      role="alert"
                      className="text-danger-text mt-3 break-words text-sm"
                    >
                      {error}
                    </p>
                  )}
                </div>
              </div>
            )}
            {!firstRun && tab !== "overview" && (
              <div
                className={
                  detail !== null
                    ? "mx-auto max-w-[1440px] px-6 py-7"
                    : "mx-auto max-w-6xl px-6 py-8 lg:px-10"
                }
              >
                {tab === "schemas" && <SchemasPage />}
                {tab === "settings" && (
                  <SettingsPage
                    report={system}
                    onRecheck={() => void check()}
                    onChooseBackend={chooseBackend}
                    checking={checking}
                  />
                )}
                {tab === "library" && (
                  <Library
                    runs={runs}
                    loading={
                      runs.length === 0 && system === null && runsError === null
                    }
                    error={runsError}
                    onOpen={(id) => void openRun(id)}
                  />
                )}
                {detail !== null && (
                  <RunView
                    key={detail.runId}
                    detail={detail}
                    values={values}
                    live={byRun.get(detail.runId) ?? new Map()}
                  />
                )}
                {detail === null && sessionIds.current.has(tab) && (
                  <p role="status" className="text-ink-secondary py-12">
                    Opening extraction…
                  </p>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </MotionConfig>
  );
};
