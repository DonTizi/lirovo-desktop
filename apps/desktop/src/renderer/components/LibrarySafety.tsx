import { useEffect, useState } from "react";
import { ArchiveRestore, FolderArchive, HardDriveDownload, Loader2 } from "lucide-react";
import type { ArchivedRun, LibraryTransferResult } from "@lirovo/node-runtime";

export function LibrarySafety({ onChanged }: { onChanged?: () => void }): JSX.Element {
  const [archived, setArchived] = useState<ArchivedRun[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<LibraryTransferResult | null>(null);
  const load = async (): Promise<void> => {
    const result = await window.lirovo.archivedRuns();
    if (result.ok) setArchived(result.value); else setError(result.error.message);
  };
  useEffect(() => { void load().catch((cause: unknown) => setError(String(cause))); }, []);
  const copy = async (kind: "backup" | "restore"): Promise<void> => {
    if (busy !== null) return;
    setBusy(kind); setError(null); setTransfer(null);
    try {
      const result = kind === "backup" ? await window.lirovo.backupLibrary() : await window.lirovo.restoreLibrary();
      if (!result.ok) setError(result.error.message);
      else if (!result.value.cancelled && result.value.transfer) setTransfer(result.value.transfer);
    } catch (cause) { setError(String(cause)); }
    finally { setBusy(null); }
  };
  const unarchive = async (runId: string): Promise<void> => {
    if (busy !== null) return;
    setBusy(runId); setError(null);
    try {
      const result = await window.lirovo.archiveRun(runId, false);
      if (!result.ok) setError(result.error.message);
      else { await load(); onChanged?.(); }
    } catch (cause) { setError(String(cause)); }
    finally { setBusy(null); }
  };
  return <section aria-labelledby="library-safety-heading" className="space-y-5 rounded-2xl border border-line p-5">
    <div><h2 id="library-safety-heading" className="text-base font-medium text-ink">Keep your library safe</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-secondary">A verified copy of your results, review history and saved media. Your current library is never replaced.</p></div>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy !== null} onClick={() => void copy("backup")} className="flex items-center gap-2 rounded-lg bg-fill px-3 py-2 text-sm text-ink disabled:opacity-50">
        {busy === "backup" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <HardDriveDownload className="size-4" />} Create backup…
      </button>
      <button type="button" disabled={busy !== null} onClick={() => void copy("restore")} className="flex items-center gap-2 rounded-lg bg-fill px-3 py-2 text-sm text-ink disabled:opacity-50">
        {busy === "restore" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <FolderArchive className="size-4" />} Restore to new profile…
      </button>
    </div>
    <p className="text-xs leading-relaxed text-ink-tertiary">Stop extractions first. Choose a new folder. Models, tools, credential files and external original videos are not included. Backups are not encrypted; stored content may be sensitive.</p>
    {busy !== null && <p role="status" className="text-sm text-ink-secondary">{busy === "backup" || busy === "restore" ? "Copying and verifying every file. Please keep Lirovo open…" : "Restoring extraction visibility…"}</p>}
    {error && <p role="alert" className="break-words text-sm text-danger-text">{error}</p>}
    {transfer && <div role="status" className="rounded-xl bg-fill/50 p-4 text-sm text-ink-secondary">
      <p className="font-medium text-ink">Verified · {transfer.runCount} extractions · {transfer.files} files</p>
      <p className="mt-2 break-all font-mono text-xs">{transfer.directory}</p>
      <ul className="mt-3 list-disc space-y-1 pl-4 text-xs leading-relaxed">{transfer.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
    </div>}
    <div className="border-t border-line pt-4">
      <h3 className="text-sm font-medium text-ink">Archived extractions <span className="ml-1 text-ink-tertiary">{archived.length}</span></h3>
      <p className="mt-1 text-xs text-ink-tertiary">Archiving hides an extraction without deleting its files or review history.</p>
      {archived.length === 0 ? <p className="mt-3 text-sm text-ink-secondary">No archived extractions.</p> : <ul className="mt-3 space-y-2">
        {archived.map((run) => <li key={run.runId} className="flex items-center gap-3 rounded-lg bg-fill/40 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-ink" title={run.title ?? run.runId}>{run.title ?? run.runId}</span>
          <button type="button" disabled={busy !== null} onClick={() => void unarchive(run.runId)} aria-label={`Unarchive ${run.title ?? run.runId}`}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-fill disabled:opacity-50"><ArchiveRestore className="size-3.5" /> Unarchive</button>
        </li>)}
      </ul>}
    </div>
  </section>;
}
