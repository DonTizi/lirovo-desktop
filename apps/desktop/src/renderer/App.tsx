import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, CircleDashed, CircleSlash, CircleX, Loader2, Upload } from "lucide-react";
import { STAGES, mergeStagePointer, type PipelineEvent, type Stage } from "@lirovo/contracts";
import type { RunDetail, RunSummary, ValueRow } from "../main/ipc.js";
import { NavBar, type NavTab, type TabId } from "./components/NavBar";
import { TitleBar } from "./components/TitleBar";
import { Badge, Card, CardHeader, Mono, StateLabel, StatTile } from "./components/primitives";
import { cn } from "./lib/cn";

const DEFAULT_SCHEMA = `{
  "type": "object",
  "additionalProperties": false,
  "required": ["title", "topics"],
  "properties": {
    "title": { "type": "string" },
    "topics": { "type": "array", "items": { "type": "string" } }
  }
}`;

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
  stages: Map<Stage, StageState>;
  reset: () => void;
  apply: (event: PipelineEvent) => void;
} => {
  const [stages, setStages] = useState<Map<Stage, StageState>>(new Map());

  const reset = useCallback(() => setStages(new Map()), []);

  const apply = useCallback((event: PipelineEvent) => {
    setStages((current) => {
      const next = new Map(current);
      switch (event.type) {
        case "stage:start":
          next.set(event.stage, { state: "active", meta: event.attempt > 1 ? `attempt ${event.attempt}` : "" });
          break;
        case "stage:resumed":
          next.set(event.stage, { state: "done", meta: "resumed" });
          break;
        case "stage:skipped":
          next.set(event.stage, { state: "skipped", meta: event.why });
          break;
        case "stage:progress":
          next.set(event.stage, {
            state: "active",
            meta: `${event.done}/${event.total}${event.note === undefined ? "" : ` ${event.note}`}`,
          });
          break;
        case "stage:done":
          next.set(event.stage, { state: "done", meta: `${(event.ms / 1000).toFixed(1)}s` });
          break;
        case "stage:degraded":
          next.set(event.stage, { state: "failed", meta: event.message.slice(0, 70) });
          break;
        case "run:failed":
          if (event.stage !== null) next.set(event.stage, { state: "failed", meta: event.code });
          break;
        default:
          break;
      }
      return next;
    });
  }, []);

  return { stages, reset, apply };
};

const StageRow = ({ stage, state }: { stage: Stage; state: StageState | undefined }): JSX.Element => {
  const kind = state?.state ?? "waiting";
  // A skipped stage gets its own mark. Leaving it as a pending circle reads as
  // "still to come" and never resolves, which is the one state that makes a
  // finished run look stuck.
  const Icon =
    kind === "done"
      ? CircleCheck
      : kind === "failed"
        ? CircleX
        : kind === "skipped"
          ? CircleSlash
          : kind === "active"
            ? Loader2
            : CircleDashed;
  return (
    <div
      className={cn(
        "border-hairline flex items-center gap-2.5 border-b px-4 py-2 last:border-b-0",
        (kind === "waiting" || kind === "skipped") && "opacity-55",
      )}
    >
      <Icon
        size={15}
        className={cn(
          kind === "done" && "text-success",
          kind === "failed" && "text-danger",
          kind === "active" && "text-brand animate-spin",
          (kind === "waiting" || kind === "skipped") && "text-ink-subtle",
        )}
      />
      <span className={cn("flex-1", kind === "active" ? "text-ink-strong font-medium" : "text-ink-label")}>{stage}</span>
      <span className="text-ink-subtle tabular-nums text-xs">{state?.meta ?? ""}</span>
    </div>
  );
};

export const App = (): JSX.Element => {
  const [tab, setTab] = useState<TabId>("overview");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [schema, setSchema] = useState(DEFAULT_SCHEMA);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [open, setOpen] = useState<Map<string, RunDetail>>(new Map());
  const [ready, setReady] = useState<{ ok: boolean; note: string; dataDir: string | null } | null>(null);
  const { stages, reset, apply } = useStages();
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => window.lirovo.onEngineEvent((e) => apply(e as PipelineEvent)), [apply]);

  const loadRuns = useCallback(async () => {
    const answer = await window.lirovo.listRuns();
    if (answer.ok) setRuns(answer.value);
  }, []);

  // Asking the engine what this machine can do is also the first proof that the
  // engine process started and that the bridge works. If either is wrong the
  // user learns it here, not after picking a two-hour video.
  useEffect(() => {
    void window.lirovo.doctor().then((answer) => {
      if (!answer.ok) {
        setReady({ ok: false, note: `${answer.error.code}: ${answer.error.message}`, dataDir: null });
        return;
      }
      const report = answer.value as {
        ok: boolean;
        problems: string[];
        paths: { data: string };
        backends: { id: string; available: boolean }[];
      };
      const usable = report.backends.filter((b) => b.available).map((b) => b.id);
      setReady({
        ok: report.ok,
        note: report.ok ? (usable.length === 0 ? "no backend" : usable.join(", ")) : (report.problems[0] ?? "not ready"),
        dataDir: report.paths.data,
      });
    });
    void loadRuns();
  }, [loadRuns]);

  const start = async (): Promise<void> => {
    if (source.trim() === "") return;
    setError(null);
    reset();
    setRunning(true);
    setTab("overview");

    const answer = await window.lirovo.extract({
      source: source.trim(),
      schemaJson: schema.trim() === "" ? null : schema,
      backendId: null,
    });
    setRunning(false);
    void loadRuns();

    if (!answer.ok) {
      setError(`${answer.error.code}: ${answer.error.message}`);
      return;
    }
    await openRun((answer.value as { runId: string }).runId);
  };

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

  const seek = (t: number): void => {
    const el = video.current;
    if (el === null) return;
    el.currentTime = t;
    void el.play();
  };

  const detail = open.get(tab) ?? null;
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

  const sections: NavTab[] = [
    { id: "overview", label: "Overview" },
    { id: "library", label: "Library", count: runs.length },
  ];
  const runTabs: NavTab[] = [...open.values()].map((r) => ({
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
        canStart={source.trim() !== ""}
        onStart={() => void start()}
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
        dataDir={ready?.dataDir ?? null}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto grid max-w-5xl gap-4 p-5">
          {tab === "overview" && (
            <>
              {ready !== null && !ready.ok && (
                <Card className="border-danger/30 px-4 py-3">
                  <span className="text-danger-text text-sm">{ready.note}</span>
                </Card>
              )}

              <div className="grid grid-cols-4 gap-3">
                <StatTile label="Runs" value={String(runs.length)} />
                <StatTile label="Succeeded" value={String(runs.filter((r) => r.status === "succeeded").length)} />
                <StatTile label="Values" value={String(runs.reduce((n, r) => n + r.valueCount, 0))} />
                <StatTile label="Backends" value={ready?.note ?? "…"} hint="detected on this machine" />
              </div>

              <Card>
                <CardHeader title="New extraction" action={ready?.dataDir ?? ""} />
                <div className="p-4">
                  <div
                    className={cn(
                      "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 transition-colors",
                      over ? "border-brand bg-brand-soft/40" : "border-line hover:border-ink-tertiary",
                    )}
                    data-awake={over}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOver(true);
                    }}
                    onDragLeave={() => setOver(false)}
                    onDrop={onDrop}
                    onClick={async () => {
                      const picked = await window.lirovo.pickFile();
                      if (picked.ok && picked.value !== null) setSource(picked.value);
                    }}
                  >
                    <Upload size={20} className="text-ink-tertiary" />
                    <span className="text-ink-label text-sm">Drop a video here, or click to choose one</span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <input
                      className="border-line bg-surface-subtle text-ink placeholder:text-ink-tertiary focus:border-brand focus:bg-surface focus:ring-brand/20 h-9 flex-1 rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2"
                      placeholder="…or paste a URL, or a file path"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                    />
                  </div>

                  <p className="text-ink-label mt-4 text-xs uppercase tracking-wide">
                    Schema — leave empty to transcribe only
                  </p>
                  <textarea
                    className="border-line bg-surface-subtle text-ink focus:border-brand focus:bg-surface focus:ring-brand/20 mt-1.5 min-h-[132px] w-full rounded-lg border p-3 font-mono text-xs outline-none transition-colors focus:ring-2"
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              </Card>

              {(running || stages.size > 0) && (
                <Card>
                  <CardHeader title="Progress" action={running ? "running" : "finished"} />
                  <div>
                    {STAGES.map((stage) => (
                      <StageRow key={stage} stage={stage} state={stages.get(stage)} />
                    ))}
                  </div>
                </Card>
              )}

              {error !== null && (
                <Card className="px-4 py-3">
                  <span className="text-danger-text font-mono text-xs">{error}</span>
                </Card>
              )}
            </>
          )}

          {tab === "library" && (
            <Card>
              <CardHeader title="Runs" action={`${runs.length} recorded`} />
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-hairline border-b">
                    <th className="text-ink-label px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                      Source
                    </th>
                    <th className="text-ink-label px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-ink-label px-4 py-2 text-right text-xs font-medium uppercase tracking-wide">
                      Values
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-ink-subtle px-4 py-8 text-center">
                        Nothing extracted yet.
                      </td>
                    </tr>
                  )}
                  {runs.map((r) => (
                    <tr
                      key={r.runId}
                      className="border-hairline hover:bg-elevated cursor-pointer border-b last:border-b-0"
                      onClick={() => void openRun(r.runId)}
                    >
                      <td className="text-ink-strong px-4 py-2.5">{r.title ?? <Mono>{r.runId}</Mono>}</td>
                      <td className="px-4 py-2.5">
                        {r.status === "succeeded" ? (
                          <Badge tone="success">succeeded</Badge>
                        ) : r.status === "failed" ? (
                          <Badge tone="danger">failed</Badge>
                        ) : (
                          <StateLabel>{r.status}</StateLabel>
                        )}
                      </td>
                      <td className="text-ink-label px-4 py-2.5 text-right tabular-nums">{r.valueCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {detail !== null && (
            <>
              {detail.sourcePath !== null && !/^https?:/i.test(detail.sourcePath) && (
                <Card className="overflow-hidden">
                  <video ref={video} controls src={`file://${detail.sourcePath}`} className="w-full bg-black" />
                </Card>
              )}

              <Card>
                <CardHeader
                  title={detail.title ?? "Result"}
                  action={
                    <span>
                      {grounded} of {values.length} grounded
                      {detail.transcriptEngine !== null ? ` · ${detail.transcriptEngine}` : ""}
                    </span>
                  }
                />
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-hairline border-b">
                      <th className="text-ink-label w-[26%] px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                        Field
                      </th>
                      <th className="text-ink-label w-[34%] px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                        Value
                      </th>
                      <th className="text-ink-label px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                        Proven at
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {values.map((row: ValueRow) => (
                      <tr key={row.observationId} className="border-hairline hover:bg-elevated border-b last:border-b-0">
                        <td className="px-4 py-2.5 align-top">
                          <Mono>{row.fieldPath}</Mono>
                        </td>
                        <td className="text-ink-strong px-4 py-2.5 align-top">{row.value.replace(/^"|"$/g, "")}</td>
                        <td className="px-4 py-2.5 align-top">
                          {row.evidence.length === 0 ? (
                            <StateLabel>nothing backs this</StateLabel>
                          ) : (
                            row.evidence.map((e, i) => (
                              <button
                                key={`${row.observationId}-${i}`}
                                className={cn(
                                  "mb-1 mr-1.5 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-xs transition-colors",
                                  e.modality === "visual"
                                    ? "bg-warning-tint text-warning-text hover:brightness-95"
                                    : "bg-info-tint text-info-text hover:brightness-95",
                                )}
                                title={e.quote ?? e.sourceRef}
                                onClick={() => seek(e.tStart)}
                              >
                                {clock(e.tStart)}
                              </button>
                            ))
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
