import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STAGES, mergeStagePointer, type PipelineEvent, type Stage } from "@lirovo/contracts";
import type { RunDetail, ValueRow } from "../main/ipc.js";

const DEFAULT_SCHEMA = `{
  "type": "object",
  "additionalProperties": false,
  "required": ["title", "topics"],
  "properties": {
    "title": { "type": "string" },
    "topics": { "type": "array", "items": { "type": "string" } }
  }
}`;

const seconds = (s: number): string => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

interface StageState {
  readonly state: "waiting" | "active" | "done" | "failed";
  readonly meta: string;
}

/**
 * Stage state built only from events the engine actually sent.
 *
 * No timers, no interpolation. A bar that advances on a clock is a bar that
 * lies the moment a stage takes longer than the author guessed, and the user
 * learns to distrust the whole screen.
 */
const useStages = (): {
  stages: Map<Stage, StageState>;
  pointer: Stage | null;
  reset: () => void;
  apply: (event: PipelineEvent) => void;
} => {
  const [stages, setStages] = useState<Map<Stage, StageState>>(new Map());
  const [pointer, setPointer] = useState<Stage | null>(null);

  const reset = useCallback(() => {
    setStages(new Map());
    setPointer(null);
  }, []);

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
          next.set(event.stage, { state: "failed", meta: event.message.slice(0, 60) });
          break;
        case "run:failed":
          if (event.stage !== null) next.set(event.stage, { state: "failed", meta: event.code });
          break;
        default:
          break;
      }
      return next;
    });

    if ("stage" in event && event.stage !== null && event.type !== "stage:degraded") {
      setPointer((p) => mergeStagePointer(p, event.stage as Stage));
    }
  }, []);

  return { stages, pointer, reset, apply };
};

export const App = (): JSX.Element => {
  const [source, setSource] = useState("");
  const [schema, setSchema] = useState(DEFAULT_SCHEMA);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const { stages, pointer, reset, apply } = useStages();
  const [ready, setReady] = useState<{ ok: boolean; note: string } | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => window.lirovo.onEngineEvent((e) => apply(e as PipelineEvent)), [apply]);

  // Asking the engine what this machine can do is also the first proof that the
  // engine process started, that the bridge works, and that the native database
  // module loaded under Electron's runtime. If any of those is wrong, the user
  // sees it here rather than after picking a two-hour video.
  useEffect(() => {
    void window.lirovo.doctor().then((answer) => {
      if (!answer.ok) {
        setReady({ ok: false, note: `${answer.error.code}: ${answer.error.message}` });
        return;
      }
      const report = answer.value as {
        ok: boolean;
        problems: string[];
        backends: { id: string; available: boolean }[];
      };
      const usable = report.backends.filter((b) => b.available).map((b) => b.id);
      setReady({
        ok: report.ok,
        note: report.ok
          ? `${usable.length === 0 ? "no backend" : usable.join(", ")}`
          : (report.problems[0] ?? "not ready"),
      });
    });
  }, []);

  const start = async (): Promise<void> => {
    if (source.trim() === "") return;
    setError(null);
    setDetail(null);
    reset();
    setRunning(true);

    const answer = await window.lirovo.extract({
      source: source.trim(),
      schemaJson: schema.trim() === "" ? null : schema,
      backendId: null,
    });
    setRunning(false);

    if (!answer.ok) {
      setError(`${answer.error.code}: ${answer.error.message}`);
      return;
    }
    const runId = (answer.value as { runId: string }).runId;
    const got = await window.lirovo.runDetail(runId);
    if (got.ok && got.value !== null) setDetail(got.value);
  };

  const onDrop = (event: React.DragEvent): void => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    // The File object carries no path; only the preload can recover it.
    if (file !== undefined) setSource(window.lirovo.pathForFile(file));
  };

  const seek = (t: number): void => {
    const el = video.current;
    if (el === null) return;
    el.currentTime = t;
    void el.play();
  };

  // Whatever proves the most values first — that is the moment worth watching.
  const sorted = useMemo(
    () => (detail === null ? [] : [...detail.values].sort((a, b) => b.reviewPriority - a.reviewPriority)),
    [detail],
  );
  const grounded = sorted.filter((v) => v.evidence.length > 0).length;

  return (
    <>
      <div className="titlebar">
        <span className="mark">Lirovo</span>
        {ready !== null && (
          <span className={ready.ok ? "muted" : "error"} style={{ fontSize: 12 }}>
            {ready.note}
          </span>
        )}
        <span className="spacer" />
        {running ? (
          <button className="no-drag" onClick={() => void window.lirovo.cancel()}>
            Cancel
          </button>
        ) : (
          <button className="primary no-drag" onClick={() => void start()} disabled={source.trim() === ""}>
            Extract
          </button>
        )}
      </div>

      <main>
        <section className="card">
          <div className="label" style={{ marginBottom: 10 }}>
            Source
          </div>
          <div
            className="drop"
            data-over={over}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            Drop a video here
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <input
              type="text"
              placeholder="…or paste a URL, or a file path"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <button
              onClick={async () => {
                const picked = await window.lirovo.pickFile();
                if (picked.ok && picked.value !== null) setSource(picked.value);
              }}
            >
              Choose…
            </button>
          </div>
        </section>

        <section className="card">
          <div className="label" style={{ marginBottom: 10 }}>
            Schema — leave empty to transcribe only
          </div>
          <textarea value={schema} onChange={(e) => setSchema(e.target.value)} spellCheck={false} />
        </section>

        {(running || stages.size > 0) && (
          <section className="card">
            <div className="label" style={{ marginBottom: 10 }}>
              Progress
            </div>
            <div className="stages">
              {STAGES.map((stage) => {
                const s = stages.get(stage);
                return (
                  <div key={stage} className="stage" data-state={s?.state ?? "waiting"}>
                    <span className="dot" />
                    <span className="name">{stage}</span>
                    <span className="meta">{s?.meta ?? (pointer === null ? "" : "")}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {error !== null && (
          <section className="card">
            <div className="error">{error}</div>
          </section>
        )}

        {detail !== null && (
          <>
            {detail.sourcePath !== null && !/^https?:/i.test(detail.sourcePath) && (
              <section className="card">
                <video ref={video} controls src={`file://${detail.sourcePath}`} />
              </section>
            )}

            <section className="card">
              <div className="label" style={{ marginBottom: 10 }}>
                {detail.title ?? "Result"} — {grounded} of {sorted.length} values grounded
                {detail.transcriptEngine !== null && <span className="muted"> · {detail.transcriptEngine}</span>}
              </div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "26%" }}>Field</th>
                    <th style={{ width: "34%" }}>Value</th>
                    <th>Proven at</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row: ValueRow) => (
                    <tr key={row.observationId} className="value">
                      <td className="path">{row.fieldPath}</td>
                      <td>{row.value.replace(/^"|"$/g, "")}</td>
                      <td>
                        {row.evidence.length === 0 ? (
                          <span className="muted">nothing backs this</span>
                        ) : (
                          row.evidence.map((e, i) => (
                            <span
                              key={`${row.observationId}-${i}`}
                              className="chip"
                              data-modality={e.modality}
                              title={e.quote ?? e.sourceRef}
                              onClick={() => seek(e.tStart)}
                            >
                              <span className="dot" />
                              {seconds(e.tStart)}
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </>
  );
};
