import {
  ArrowUp,
  FileVideo,
  Link2,
  Loader2,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { SourceInspection } from "../../bridge/contract.js";
import { cn } from "../lib/cn";

const platformOf = (value: string): string | null => {
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be"
    )
      return "YouTube";
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) return "Vimeo";
    if (host === "loom.com" || host.endsWith(".loom.com")) return "Loom";
    return host;
  } catch {
    return null;
  }
};

const looksLikeSource = (value: string): boolean =>
  /^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("~");

const clock = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(Math.floor(seconds % 60)).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
};
const size = (bytes: number): string =>
  bytes >= 1e9
    ? `${(bytes / 1e9).toFixed(1)} GB`
    : `${(bytes / 1e6).toFixed(1)} MB`;

/** One source, one action. Inspection and extraction still use the real bridge. */
export function SourceInput({
  value,
  onChange,
  onSubmit,
  busy,
  onBrowse,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  onBrowse: () => void;
}): JSX.Element {
  const [drag, setDrag] = useState(false);
  const [found, setFound] = useState<SourceInspection | null>(null);
  const [resolving, setResolving] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const platform = platformOf(value.trim());
  const ready = looksLikeSource(value.trim());

  useEffect(() => {
    const source = value.trim();
    setFound(null);
    setInspectionError(null);
    if (!looksLikeSource(source)) {
      setResolving(false);
      return;
    }
    let current = true;
    setResolving(true);
    const timer = setTimeout(() => {
      void window.lirovo
        .inspect(source)
        .then((answer) => {
          if (!current) return;
          setResolving(false);
          if (answer.ok) setFound(answer.value);
          else setInspectionError(answer.error.message);
        })
        .catch(() => {
          if (!current) return;
          setResolving(false);
          setInspectionError(
            "Could not inspect this source. Check the link or choose the file again.",
          );
        });
    }, 350);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        if (!busy) onBrowse();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBrowse, busy]);

  const problem = found?.problem ?? inspectionError;
  const canSubmit = ready && !busy && found?.problem == null;
  return (
    <div className="source-stack">
      <form
        className="source-composer"
        data-drag={drag ? "true" : undefined}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDrag(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDrag(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDrag(false);
          if (busy) return;
          const file = event.dataTransfer.files[0];
          if (file !== undefined) onChange(window.lirovo.pathForFile(file));
          else {
            const transferred =
              event.dataTransfer.getData("text/uri-list") ||
              event.dataTransfer.getData("text/plain");
            const link =
              transferred
                .split(/\r?\n/)
                .find(
                  (line) => line.trim() !== "" && !line.trim().startsWith("#"),
                ) ?? "";
            if (looksLikeSource(link.trim())) onChange(link.trim());
          }
        }}
      >
        <div className="flex items-center gap-3">
          <Link2
            className="text-ink-tertiary size-[18px] shrink-0"
            aria-hidden="true"
          />
          <input
            id="video-source"
            aria-label="Video link or file path"
            aria-describedby="source-feedback"
            className="text-ink placeholder:text-ink-tertiary h-8 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none focus-visible:outline-none"
            placeholder={
              drag
                ? "Drop to add this video"
                : "Paste a video link, or drop a file…"
            }
            value={value}
            disabled={busy}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
          />
          {value !== "" && !busy && (
            <button
              type="button"
              className="text-ink-tertiary hover:text-ink rounded-md px-2 py-1 text-xs"
              onClick={() => onChange("")}
            >
              Clear
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onBrowse}
            className="text-ink-secondary hover:bg-fill flex h-8 items-center gap-2 rounded-lg px-1 text-sm"
            title="Choose a video file (⌘O / Ctrl+O)"
          >
            <Plus className="size-[18px]" strokeWidth={1.6} /> Add video
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            title={busy ? "Extraction in progress" : "Extract video"}
            className={cn(
              "flex h-8 shrink-0 items-center justify-center gap-2 rounded-full px-2 text-sm",
              canSubmit ? "liq-solid" : "bg-fill text-ink-placeholder",
            )}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Extracting…
              </>
            ) : (
              <>
                <span className="sr-only">Extract video</span>
                <ArrowUp className="size-4" />
              </>
            )}
          </button>
        </div>
      </form>
      <div
        id="source-feedback"
        role="status"
        aria-live="polite"
        className="source-feedback text-ink-tertiary text-xs"
      >
        {problem != null ? (
          <span className="text-danger-text flex items-start gap-2 break-words">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            {problem}
          </span>
        ) : found !== null ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <FileVideo className="size-3.5" />
            <span>{platform ?? found.label}</span>
            {found.title !== null && (
              <span className="text-ink-secondary break-all">
                {found.title}
              </span>
            )}
            {found.durationS !== null && (
              <span>· {clock(found.durationS)}</span>
            )}
            {found.bytes !== null && <span>· {size(found.bytes)}</span>}
          </span>
        ) : resolving ? (
          <span>Reading {platform ?? "video"}…</span>
        ) : null}
      </div>
    </div>
  );
}
