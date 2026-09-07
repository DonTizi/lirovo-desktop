import { useId, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { ExportOptions } from "@lirovo/node-runtime";

/** The native save dialog is the only destination authority; no path or content crosses from this component. */
export function ExportResults({ runId }: { runId: string }): JSX.Element {
  const id = useId();
  const [format, setFormat] = useState<ExportOptions["format"]>("folder");
  const [scope, setScope] = useState<ExportOptions["scope"]>("approved");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const complete = format === "folder";
  const save = async () => {
    setBusy(true); setStatus(null); setError(null); setWarnings([]);
    try {
      const result = await window.lirovo.exportRun(runId, { format, scope: complete ? "all" : scope });
      if (!result.ok) throw new Error(result.error.message);
      setStatus(result.value.cancelled ? "Export cancelled. Nothing was saved." : complete ? `${result.value.files} files verified and saved to ${result.value.directory}` : "Export saved with sources and review history.");
      setWarnings(result.value.warnings ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The export could not be saved. Please try again."); }
    finally { setBusy(false); }
  };
  const select = "min-w-0 rounded-lg border border-hairline bg-base px-2.5 py-2 text-xs text-ink-secondary disabled:opacity-50";
  return <details className="relative text-sm">
    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-ink-secondary transition-colors hover:bg-tint hover:text-ink"><Download aria-hidden="true" className="size-4" />Export</summary>
    <div className="absolute right-0 z-30 mt-2 max-h-[70vh] w-[min(360px,calc(100vw-32px))] space-y-4 overflow-y-auto rounded-2xl border border-hairline bg-base p-4 shadow-xl">
      <div><p className="font-medium text-ink">Take your findings with you</p><p className="mt-1 text-xs leading-relaxed text-ink-subtle">{complete ? "Your complete saved extraction, in one portable folder." : "A lightweight report of values, timestamps and linked evidence."}</p></div>
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={`${id}-format`} className="flex flex-col gap-1.5 text-xs text-ink-subtle">Format<select id={`${id}-format`} className={select} value={format} disabled={busy} onChange={(event) => { setFormat(event.target.value as ExportOptions["format"]); setStatus(null); setError(null); setWarnings([]); }}><option value="folder">Complete extraction folder</option><option value="markdown">Markdown · Obsidian</option><option value="json">Structured JSON</option><option value="csv">Spreadsheet CSV</option></select></label>
        <label htmlFor={`${id}-scope`} className="flex flex-col gap-1.5 text-xs text-ink-subtle">Results<select id={`${id}-scope`} className={select} value={complete ? "all" : scope} disabled={busy || complete} onChange={(event) => { setScope(event.target.value as ExportOptions["scope"]); setStatus(null); setError(null); }}><option value="approved">Accepted only</option><option value="all">All results</option></select></label>
      </div>
      {complete && <div className="space-y-1.5 border-y border-hairline py-3 text-xs leading-relaxed text-ink-secondary"><p>Results + review history</p><p>Full transcript + timestamps</p><p>Frame images + visual analysis</p><p>Knowledge graph + connections</p><p>Stored media + run metadata</p><p className="pt-1 text-ink-subtle">Every file is verified. Missing data is listed, never invented. Finish or stop queued extractions first.</p></div>}
      <p className="text-xs leading-relaxed text-ink-subtle">{complete ? "Includes original/rejected values, prompts, media, local paths and host/process diagnostics. Not encrypted. External original videos are not copied. Review before sharing." : "The audit includes original and rejected values, corrections and local source paths. Transcript, frame and graph files require Complete extraction folder."}</p>
      {complete && <p className="text-xs leading-relaxed text-ink-subtle">Keep Lirovo open while files are copied and verified. Other library actions pause during the export; large videos can take several minutes.</p>}
      <button type="button" disabled={busy} onClick={() => void save()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-tint px-3 py-2.5 text-xs font-medium text-ink transition-colors hover:bg-tint-hover disabled:opacity-50">{busy ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}{busy ? "Preparing export…" : "Choose where to save"}</button>
      {status && <p role="status" className="break-words text-xs leading-relaxed text-ink-secondary">{status}</p>}
      {warnings.length > 0 && <details className="text-xs leading-relaxed text-ink-subtle"><summary className="cursor-pointer">Export notes</summary><ul className="mt-2 list-disc space-y-2 pl-4">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>}
      {error && <p role="alert" className="text-xs leading-relaxed text-warning-text">{error}</p>}
    </div>
  </details>;
}
