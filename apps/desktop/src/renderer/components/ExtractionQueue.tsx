import { useState } from "react";
import { ChevronDown, Clock3, PauseCircle, Play, X } from "lucide-react";
import type { QueueItem } from "../../bridge/contract";

/** Persistent work is separate from the page being viewed. No modal or navigation capture. */
export function ExtractionQueue({ items, onOpen, onResume, onCancel }: {
  items: readonly QueueItem[];
  onOpen: (runId: string) => void;
  onResume: (runId: string) => void;
  onCancel: (runId: string) => void;
}): JSX.Element | null {
  const [expanded, setExpanded] = useState(true);
  const visible = items.filter((item) => item.status !== "succeeded" && item.status !== "cancelled");
  if (visible.length === 0) return null;
  const waiting = visible.filter((item) => item.status === "queued").length;
  const active = visible.find((item) => item.status === "running");
  return <section aria-label="Extraction queue" className="mx-6 mt-3 rounded-xl border border-line bg-surface/40 px-4 py-3 text-sm">
    <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}
      className="flex w-full items-center gap-2 text-left text-ink-secondary">
      <Clock3 aria-hidden="true" className="size-4" />
      <span className="flex-1">{active ? "Extraction in progress" : "Extraction queue"}{waiting > 0 ? ` · ${waiting} waiting` : ""}</span>
      <span className="text-xs text-ink-tertiary">{visible.length}</span><ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
    {expanded && <ul className="mt-3 space-y-2">
      {visible.map((item) => <li key={item.runId} className="flex flex-wrap items-center gap-2 rounded-lg bg-fill/40 px-3 py-2">
        <button type="button" onClick={() => onOpen(item.runId)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-ink" title={item.source}>{item.source}</span>
          <span className="text-xs text-ink-tertiary">{item.schemaName ?? "Extraction"} · {item.status === "interrupted" ? "Paused after restart — resume explicitly" : item.status}</span>
        </button>
        {(item.status === "interrupted" || item.status === "failed") && <button type="button" onClick={() => onResume(item.runId)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-ink hover:bg-fill" aria-label={`Resume ${item.source}`}><Play className="size-3" /> Resume</button>}
        <button type="button" onClick={() => onCancel(item.runId)} className="rounded-md p-1.5 text-ink-secondary hover:bg-fill"
          aria-label={`Cancel ${item.source}`}>{item.status === "running" ? <PauseCircle className="size-4" /> : <X className="size-4" />}</button>
        {item.error && <p role="status" className="w-full break-words text-xs text-danger-text">{item.error}</p>}
      </li>)}
    </ul>}
  </section>;
}
