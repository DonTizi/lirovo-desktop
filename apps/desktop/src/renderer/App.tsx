import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, CircleDashed, CircleSlash, CircleX, FileVideo, History, Loader2, ShieldAlert } from "lucide-react";
import { STAGES, mergeStagePointer, type PipelineEvent, type Stage } from "@lirovo/contracts";
import { SCHEMA_PRESETS, compileSchema, type FieldSpec } from "@lirovo/core";
import type { RunDetail, RunSummary, ValueRow } from "../main/ipc.js";
import { NavBar, type NavTab, type TabId } from "./components/NavBar";
import { TitleBar } from "./components/TitleBar";
import { ListColumn, type ListEntry } from "./components/primitives";
import { SourceInput } from "./components/SourceInput";
import { RunProgress, type LiveStage } from "./components/RunProgress";
import { RunView } from "./components/run/run-view";
import { SchemaPicker } from "./components/SchemaPicker";
import { Hero } from "./components/hero";
import { Library } from "./components/library";
import { SchemasPage } from "./components/SchemasPage";
import { SystemPanel, type SystemReport } from "./components/SystemPanel";
import { cn } from "./lib/cn";

const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

interface StageState {
  readonly state: "waiting" | "active" | "done" | "failed" | "skipped";
  readonly meta: string;
}

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
  const [byRun, setByRun] = useState<Map<string, Map<Stage, LiveStage>>>(new Map());

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
      const set = (stage: Stage, state: LiveStage): void => {
        mine.set(stage, state);
      };
      switch (event.type) {
        case "stage:start":
          set(event.stage, { state: "active", meta: event.attempt > 1 ? `attempt ${event.attempt}` : "" });
          break;
        case "stage:resumed":
          set(event.stage, { state: "done", meta: "resumed" });
          break;
        case "stage:skipped":
          set(event.stage, { state: "skipped", meta: event.why });
          break;
        case "stage:progress":
          set(event.stage, {
            state: "active",
            meta: `${event.done}/${event.total}${event.note === undefined ? "" : ` ${event.note}`}`,
          });
          break;
        case "stage:done":
          set(event.stage, { state: "done", meta: `${(event.ms / 1000).toFixed(1)}s` });
          break;
        case "stage:degraded":
          set(event.stage, { state: "failed", meta: event.message });
          break;
        case "run:failed":
          if (event.stage !== null) set(event.stage, { state: "failed", meta: event.code });
          break;
        default:
          break;
      }
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
  const [fields, setFields] = useState<FieldSpec[]>([...(SCHEMA_PRESETS[0]?.fields ?? [])]);
  const [schemaLabel, setSchemaLabel] = useState(SCHEMA_PRESETS[0]?.label ?? "Transcript only");
  const [schemaVersion, setSchemaVersion] = useState<number | null>(null);
  // Set only while the fields are exactly a stored revision, so a run can point
  // at the contract it was actually asked with.
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [openTabs, setOpen] = useState<Map<string, RunDetail>>(new Map());
  const [system, setSystem] = useState<SystemReport | null>(null);
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const { byRun, reset, apply } = useStages();
  // The run this window is executing, so its tab can show it live.
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

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
        }
        if (event.type === "run:done" || event.type === "run:failed" || event.type === "run:cancelled") {
          void loadRuns();
        }
      }),
    [apply, reset, loadRuns],
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
  }, [check, loadRuns]);

  const start = async (): Promise<void> => {
    if (source.trim() === "") return;
    setError(null);
    setActiveRunId(null);
    setRunning(true);
    setTab("overview");

    const answer = await window.lirovo.extract({
      source: source.trim(),
      // No fields means transcribe and detect scenes, and fill nothing in.
      schemaJson: fields.length === 0 ? null : JSON.stringify(compileSchema(fields)),
      backendId: null,
      schemaRevisionId: revisionId,
    });
    setRunning(false);
    void loadRuns();

    if (!answer.ok) {
      setError(`${answer.error.code}: ${answer.error.message}`);
      return;
    }
    await openRun((answer.value as { runId: string }).runId);
  };

  // Anything unfinished keeps refreshing. Without this a run only updates when
  // the user clicks something, which is exactly when it looks stuck.
  const watching = running || runs.some((r) => r.status === "running" || r.status === "claimed");
  useEffect(() => {
    if (!watching) return;
    const timer = window.setInterval(() => {
      void loadRuns();
      const open = [...openTabs.keys()];
      for (const runId of open) {
        void window.lirovo.runDetail(runId).then((got) => {
          if (got.ok && got.value !== null) setOpen((m) => new Map(m).set(runId, got.value as RunDetail));
        });
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [watching, loadRuns, openTabs]);

  const openRun = async (runId: string): Promise<void> => {
    const got = await window.lirovo.runDetail(runId);
    if (got.ok && got.value !== null) {
      setOpen((m) => new Map(m).set(runId, got.value as RunDetail));
      setTab(runId);
    }
  };

  const onDrop = (event: React.DragEvent): void => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    // A dropped File carries no path; only the preload can recover the real one.
    if (file !== undefined) setSource(window.lirovo.pathForFile(file));
  };

  const detail = openTabs.get(tab) ?? null;
  const values = useMemo(() => {
    if (detail === null) return [];
    const needle = query.trim().toLowerCase();
    const rows = [...detail.values].sort((a, b) => b.reviewPriority - a.reviewPriority);
    if (needle === "") return rows;
    return rows.filter(
      (r) =>
        r.fieldPath.toLowerCase().includes(needle) ||
        r.value.toLowerCase().includes(needle) ||
        r.evidence.some((e) => (e.quote ?? "").toLowerCase().includes(needle)),
    );
  }, [detail, query]);
  const grounded = values.filter((v) => v.evidence.length > 0).length;

  const runEntries: ListEntry[] = runs.map((r) => ({
    id: r.runId,
    label: r.title ?? r.runId,
    hint: `${r.valueCount} value${r.valueCount === 1 ? "" : "s"}`,
    meta: r.status,
    icon: FileVideo,
  }));

  // A run that produced nothing is the one a human most needs to look at, so it
  // ranks above one that merely finished.
  const reviewEntries: ListEntry[] = runs
    .filter((r) => r.status !== "succeeded" || r.valueCount === 0)
    .map((r) => ({
      id: r.runId,
      label: r.title ?? r.runId,
      hint:
        r.status === "succeeded"
          ? "nothing was extracted"
          : r.status === "stopped"
            ? "nothing is working on this"
            : `run ${r.status}`,
      meta: String(r.valueCount),
      icon: ShieldAlert,
    }));

  const activityEntries: ListEntry[] = runs.map((r) => ({
    id: r.runId,
    label: `${r.title ?? r.runId} · ${r.status}`,
    hint: `${r.valueCount} value${r.valueCount === 1 ? "" : "s"} recorded`,
    meta: new Date(r.createdAt * 1000).toLocaleDateString(),
    icon: History,
  }));

  const sections: NavTab[] = [
    { id: "overview", label: "Overview" },
    { id: "library", label: "Library", count: runs.length },
    { id: "schemas", label: "Schemas" },
  ];
  const runTabs: NavTab[] = [...openTabs.values()].map((r) => ({
    id: r.runId,
    label: r.title ?? r.runId,
    closable: true,
  }));

  return (
    <div className="bg-canvas text-ink flex h-full flex-col">
      <TitleBar
        query={query}
        onQuery={setQuery}
        grounded={grounded}
        total={values.length}
        running={running}
        onCancel={() => void window.lirovo.cancel()}
        onRefresh={() => void loadRuns()}
      />
      <NavBar
        sections={sections}
        runs={runTabs}
        active={tab}
        onSelect={setTab}
        onCloseRun={(id) =>
          setOpen((m) => {
            const next = new Map(m);
            next.delete(id);
            setTab("library");
            return next;
          })
        }
        onOpenSettings={() => setTab("overview")}
        dataDir={dataDir}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-10">
          {tab === "overview" && (
            <>
              {/* The blocking reason belongs ABOVE the field, not only in the
                  panel below: a user who drops a two-hour video and learns
                  afterwards that ffmpeg is missing has already spent the wait. */}
              {(bridgeError ?? (system !== null && !system.ok ? (system.problems[0] ?? null) : null)) !== null && (
                <p className="border-hairline text-danger-text mb-6 border-b pb-3 text-sm">
                  {bridgeError ?? system?.problems[0]}
                </p>
              )}

              <Hero title="Lirovo" sub="Drop a link or a file. Every value comes back with the moment that proves it." />

              <div className="relative mx-auto mt-7 max-w-3xl">
                <SourceInput
                  value={source}
                  onChange={setSource}
                  onSubmit={() => void start()}
                  busy={running}
                  onBrowse={() => {
                    void window.lirovo.pickFile().then((picked) => {
                      if (picked.ok && picked.value !== null) setSource(picked.value);
                    });
                  }}
                />

                {/* The progress opens where the field is, not somewhere else on
                    the page. Keeping the work in the place the user just acted
                    is what makes it read as the same thing continuing rather
                    than a second thing appearing. */}
                <AnimatePresence>
                  {(running || activeRunId !== null) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2">
                        <RunProgress
                          status={running ? "running" : "finished"}
                          live={byRun.get(activeRunId ?? "") ?? new Map()}
                          attempts={[]}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error !== null && (
                  <p className="border-hairline text-danger-text mt-3 border-t px-1 py-3 font-mono text-xs">{error}</p>
                )}

                <SchemaPicker
                  label={schemaLabel}
                  version={schemaVersion}
                  fields={fields}
                  onChoose={(choice) => {
                    setFields([...choice.fields]);
                    setSchemaLabel(choice.label);
                    setRevisionId(choice.revisionId);
                    setSchemaVersion(null);
                    if (choice.revisionId !== null) {
                      // The badge on the trigger has to be the version actually
                      // in force, not a number guessed from the label.
                      void window.lirovo.listSchemas().then((answer) => {
                        if (!answer.ok) return;
                        setSchemaVersion(answer.value.find((x) => x.name === choice.label)?.version ?? null);
                      });
                    }
                  }}
                  onEdit={(next) => {
                    setFields(next);
                    // Edited in place, so it is no longer the stored revision.
                    setRevisionId(null);
                    setSchemaVersion(null);
                    setSchemaLabel((current) => (current.endsWith(" (edited)") ? current : `${current} (edited)`));
                  }}
                  onManage={() => setTab("schemas")}
                />
              </div>

              <div className="mt-8">
                <SystemPanel
                  report={system}
                  onRecheck={() => void check()}
                  onChooseBackend={(backendId) => {
                    // Painted immediately, then confirmed: a click that waits
                    // on a round trip before the check moves reads as broken.
                    setSystem((current) => (current === null ? current : { ...current, defaultBackendId: backendId }));
                    void window.lirovo.setDefaultBackend(backendId).then((answer) => {
                      if (!answer.ok) return;
                      setSystem((current) =>
                        current === null ? current : { ...current, defaultBackendId: answer.value.defaultBackendId },
                      );
                    });
                  }}
                  checking={checking}
                />
              </div>

              <div className="mt-10 grid gap-8 lg:grid-cols-3">
                <ListColumn
                  title="Runs"
                  count={runs.length}
                  entries={runEntries}
                  empty="Nothing extracted yet."
                  onSelect={(id) => void openRun(id)}
                  onTitle={() => setTab("library")}
                />
                <ListColumn
                  title="Needs review"
                  count={reviewEntries.length}
                  entries={reviewEntries}
                  empty="Every value carries evidence."
                  onSelect={(id) => void openRun(id)}
                  delay={0.05}
                />
                <ListColumn
                  title="Activity"
                  entries={activityEntries}
                  empty="No run recorded yet."
                  onTitle={() => setTab("library")}
                  delay={0.1}
                />
              </div>
            </>
          )}

          {tab === "schemas" && <SchemasPage />}

          {tab === "library" && (
            <Library
              runs={runs}
              loading={runs.length === 0 && system === null && runsError === null}
              error={runsError}
              onOpen={(id) => void openRun(id)}
            />
          )}

          {detail !== null && (
            <RunView detail={detail} values={values} live={byRun.get(detail.runId) ?? new Map()} />
          )}
        </div>
      </div>
    </div>
  );
};
