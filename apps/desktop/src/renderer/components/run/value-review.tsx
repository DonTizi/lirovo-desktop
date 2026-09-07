import { useId, useState } from "react";
import { Check, ChevronDown, Pencil, RotateCcw, X } from "lucide-react";
import type { ReviewHistoryEntry, ReviewSnapshot } from "@lirovo/node-runtime";
import type { ValueRow } from "../../../bridge/contract.js";
import { cn } from "../../lib/cn";
import { displayValue } from "./value-groups";

export type OnReviewSaved = (observationId: string, review: ReviewSnapshot) => void;
const label = (review?: ReviewSnapshot): string => review?.decision === "approved" ? "Accepted" : review?.decision === "rejected" ? "Rejected" : review?.corrected ? "Edited · needs review" : "Needs review";

/** Deliberate human decisions, separate from the model's evidence coverage. */
export function ValueReview({ runId, row, onSaved }: { runId: string; row: ValueRow; onSaved: OnReviewSaved }): JSX.Element {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingRevision, setEditingRevision] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<readonly ReviewHistoryEntry[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const decoded: unknown = JSON.parse(row.value);
  const originallyMissing = (row.review ? row.review.originalValue : decoded) === null;
  // Keep originally-null fields in explicit JSON mode after a string correction,
  // so the user can deliberately change its type or restore null later.
  const textValue = typeof decoded === "string" && !originallyMissing;
  const revision = row.review?.revision ?? 0;
  const save = async (action: "approve" | "reject" | "reopen" | "correct") => {
    // A decision applies to the saved value, never an invisible unsaved draft.
    if (busy || (editing && action !== "correct")) return;
    setBusy(true);
    setError(null);
    try {
      const value: unknown = action === "correct" ? textValue ? draft : JSON.parse(draft) : undefined;
      const result = await window.lirovo.reviewValue({ runId, observationId: row.observationId, expectedRevision: action === "correct" ? editingRevision : revision, action, ...(action === "correct" ? { value, ...(note ? { note } : {}) } : {}) });
      if (!result.ok) throw new Error(result.error.message);
      onSaved(row.observationId, result.value);
      setEditing(false);
      setNote("");
      setHistory(null);
      setHistoryOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your review could not be saved. Please try again.");
    } finally { setBusy(false); }
  };
  const openHistory = async () => {
    if (historyOpen) { setHistoryOpen(false); return; }
    setHistoryOpen(true);
    setHistoryBusy(true);
    setError(null);
    try {
      const result = await window.lirovo.reviewHistory(runId, row.observationId);
      if (!result.ok) throw new Error(result.error.message);
      setHistory(result.value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review history could not be loaded."); }
    finally { setHistoryBusy(false); }
  };
  const button = "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-tint hover:text-ink disabled:opacity-40";
  return <div className="mt-4 border-t border-hairline/60 pt-3" aria-label={`Review ${row.fieldPath}`}>
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <span className={cn("text-xs", row.review?.decision === "approved" ? "text-success-text" : row.review?.decision === "rejected" ? "text-warning-text" : "text-ink-subtle")}>{label(row.review)}</span>
      <div className="flex flex-wrap items-center gap-1" aria-busy={busy}>
        {row.review?.decision !== "approved" && <button className={button} disabled={busy || editing} onClick={() => void save("approve")}><Check className="size-3" aria-hidden="true" />Accept</button>}
        <button className={button} disabled={busy || editing} aria-expanded={editing} aria-controls={`${id}-editor`} onClick={() => { setDraft(textValue ? decoded as string : JSON.stringify(decoded, null, 2)); setEditingRevision(revision); setNote(""); setEditing(true); setError(null); }}><Pencil className="size-3" aria-hidden="true" />Edit</button>
        {row.review?.decision === "approved" || row.review?.decision === "rejected" ? <button className={button} disabled={busy || editing} onClick={() => void save("reopen")}><RotateCcw className="size-3" aria-hidden="true" />Reopen</button> : <button className={button} disabled={busy || editing} onClick={() => void save("reject")}><X className="size-3" aria-hidden="true" />Reject</button>}
        {revision > 0 && <button className={button} disabled={busy || historyBusy} aria-expanded={historyOpen} aria-controls={`${id}-history`} onClick={() => void openHistory()}>History {revision}<ChevronDown className="size-3" aria-hidden="true" /></button>}
      </div>
    </div>
    {editing && <form id={`${id}-editor`} className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); void save("correct"); }}>
      <label className="block text-xs text-ink-subtle" htmlFor={`${id}-value`}>{textValue ? "Your correction" : "Your correction (JSON)"}</label>
      <textarea autoFocus id={`${id}-value`} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={busy} rows={4} className="w-full resize-y rounded-xl border border-hairline bg-base px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-ink-subtle" />
      {originallyMissing && <p className="text-xs leading-relaxed text-ink-subtle">This result was originally empty. Enter an explicit JSON value: a quoted string, number, boolean, object, array or null. A saved field schema is checked when resolvable; otherwise only valid JSON is checked, not schema conformance.</p>}
      <label className="block text-xs text-ink-subtle" htmlFor={`${id}-note`}>Reason for this change (optional)</label>
      <input id={`${id}-note`} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} className="w-full rounded-lg border border-hairline bg-base px-3 py-2 text-sm text-ink" />
      <p className="text-xs leading-relaxed text-ink-subtle">The original and its sources stay unchanged. Saving an edit reopens this result for review; use Accept afterward to include it in accepted-only exports.</p>
      <div className="flex gap-2"><button type="submit" disabled={busy} className={`${button} bg-tint`}>{busy ? "Saving…" : "Save correction"}</button><button type="button" disabled={busy} className={button} onClick={() => setEditing(false)}>Cancel</button></div>
    </form>}
    {historyOpen && <div id={`${id}-history`} className="mt-3 space-y-3 rounded-xl bg-tint/50 p-3 text-xs">
      <div><p className="mb-1 text-ink-subtle">Original extraction</p><p className="whitespace-pre-wrap break-words text-ink-secondary">{displayValue(JSON.stringify(row.review ? row.review.originalValue : decoded))}</p></div>
      {historyBusy ? <p role="status">Loading review history…</p> : history?.map((event) => <div key={event.id} className="border-t border-hairline pt-3">
        <p className="flex flex-wrap justify-between gap-2 text-ink-subtle"><span>Revision {event.revision} · {event.action === "correct" ? "Edited" : event.action === "approve" ? "Accepted" : event.action === "reject" ? "Rejected" : "Reopened"}</span><time dateTime={new Date(event.createdAt * 1000).toISOString()}>{new Date(event.createdAt * 1000).toLocaleString()}</time></p>
        <p className="mt-1 text-ink-subtle">{event.actor}</p>
        {"value" in event && <p className="mt-2 whitespace-pre-wrap break-words text-ink-secondary">{displayValue(JSON.stringify(event.value))}</p>}
        {event.note && <p className="mt-2 whitespace-pre-wrap break-words text-ink-secondary">{event.note}</p>}
      </div>)}
    </div>}
    {error && <p role="alert" className="mt-3 text-xs leading-relaxed text-warning-text">{error}</p>}
  </div>;
}
