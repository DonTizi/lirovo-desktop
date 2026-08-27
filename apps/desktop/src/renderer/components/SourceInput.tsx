import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Clapperboard, FileVideo, Link2, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SourceInspection } from "../../main/ipc.js";
import { cn } from "../lib/cn";
import { PixelField } from "./PixelField";

/**
 * Recognise the platform without asking anyone.
 *
 * A round trip to fetch the title takes seconds; naming YouTube takes a regex.
 * Doing the cheap half in the renderer is what lets the field acknowledge a
 * paste on the same frame instead of sitting blank while the network answers.
 */
const platformOf = (value: string): string | null => {
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    if (host.endsWith("youtube.com") || host === "youtu.be") return "YouTube";
    if (host.endsWith("vimeo.com")) return "Vimeo";
    if (host.endsWith("loom.com")) return "Loom";
    return host;
  } catch {
    return null;
  }
};

const looksLikeSource = (value: string): boolean =>
  /^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("~");

const clock = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

const size = (bytes: number): string =>
  bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;

/**
 * One field that takes a link, a path, a dropped file or a click.
 *
 * Two controls for one intention — a drop panel AND a URL box — makes a person
 * choose an affordance before they can act, and the one they did not pick reads
 * as an afterthought. So there is one target: the whole panel accepts a drop,
 * the field accepts everything else, and what changes is the chip underneath
 * saying what was understood.
 *
 * That chip is the part that was missing. Pasting a link used to leave the
 * screen unchanged, so nothing confirmed the app had even seen it.
 */
export function SourceInput({
  value,
  onChange,
  onSubmit,
  busy,
  onBrowse,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  onBrowse: () => void;
}): JSX.Element {
  const [drag, setDrag] = useState(false);
  const [focused, setFocused] = useState(false);
  const [found, setFound] = useState<SourceInspection | null>(null);
  const [resolving, setResolving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const platform = platformOf(value);
  const ready = looksLikeSource(value.trim());

  // Inspect after typing settles, and let a newer input win.
  //
  // A token rather than an abort: the inspection is a round trip through two
  // processes, and a stale answer arriving after a newer one would overwrite
  // the chip with a description of a source the user has already replaced.
  useEffect(() => {
    const source = value.trim();
    if (!looksLikeSource(source)) {
      setFound(null);
      setResolving(false);
      return;
    }

    let current = true;
    setFound(null);
    setResolving(true);
    const timer = setTimeout(() => {
      void window.lirovo.inspect(source).then((answer) => {
        if (!current) return;
        setResolving(false);
        if (answer.ok) setFound(answer.value);
      });
    }, 350);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [value]);

  // ⌘O opens the picker, the way every macOS app opens a document.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        onBrowse();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBrowse]);

  const Leading = busy ? Loader2 : found?.kind === "file" ? FileVideo : platform !== null ? Clapperboard : Link2;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const file = e.dataTransfer.files[0];
        // A dropped File carries no path; only the preload can recover it.
        if (file !== undefined) onChange(window.lirovo.pathForFile(file));
      }}
      data-awake={drag || busy ? "true" : undefined}
      className="relative"
    >
      {/* Decoration lives here so the drag state that lights it is the same
          state that styles the field. */}
      <PixelField side="left" />
      <PixelField side="right" />

      <div
        className={cn(
          "bg-base flex items-center gap-3 rounded-xl px-4 transition-all duration-100",
          drag
            ? "shadow-[0_0_0_1px_var(--kumo-focus)] bg-elevated h-[76px]"
            : focused
              ? "shadow-[0_0_0_1px_var(--kumo-focus)] h-[68px]"
              : "shadow-control h-[68px]",
        )}
      >
        <Leading className={cn("size-5 shrink-0", busy ? "text-brand animate-spin" : "text-ink-subtle")} />

        <input
          ref={inputRef}
          className="text-ink placeholder:text-ink-placeholder h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none"
          placeholder={drag ? "Let go to use this file" : "Paste a link, or drop a video"}
          value={value}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ready && !busy) onSubmit();
          }}
          spellCheck={false}
        />

        {value !== "" && !busy && (
          <button
            className="text-ink-subtle hover:text-ink shrink-0 text-xs transition-colors"
            onClick={() => onChange("")}
          >
            Clear
          </button>
        )}

        <button
          className={cn(
            "flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors",
            ready && !busy ? "liq-solid liq-solid-brand" : "bg-fill text-ink-placeholder cursor-default",
          )}
          onClick={onSubmit}
          disabled={!ready || busy}
        >
          {busy ? "Extracting" : "Extract"}
          {!busy && <ArrowRight className="size-4" />}
        </button>
      </div>

      {/* One line under the field: what it understood, or how to feed it. The
          height is reserved either way so nothing below shifts. */}
      <div className="flex h-7 items-center justify-center px-1 pt-2">
        <AnimatePresence mode="wait">
          {found?.problem != null ? (
            <motion.span
              key="problem"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
              className="text-danger-text flex items-center gap-1.5 text-xs"
            >
              <TriangleAlert className="size-3.5" />
              {found.problem}
            </motion.span>
          ) : found !== null ? (
            <motion.span
              key="found"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
              className="text-ink-subtle flex min-w-0 items-center gap-2 text-xs"
            >
              <span className="bg-tint text-ink-label rounded px-1.5 py-0.5 font-medium">
                {found.kind === "url" ? (platform ?? found.label) : found.label}
              </span>
              {found.title !== null && <span className="text-ink-label max-w-[380px] truncate">{found.title}</span>}
              {found.durationS !== null && <span className="tabular-nums">{clock(found.durationS)}</span>}
              {found.bytes !== null && <span className="tabular-nums">{size(found.bytes)}</span>}
            </motion.span>
          ) : resolving ? (
            <motion.span
              key="resolving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-ink-subtle flex items-center gap-2 text-xs"
            >
              {platform !== null && (
                <span className="bg-tint text-ink-label rounded px-1.5 py-0.5 font-medium">{platform}</span>
              )}
              <span>reading…</span>
            </motion.span>
          ) : (
            <motion.span
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-ink-subtle text-xs"
            >
              Paste a link, drop a file, or press{" "}
              <kbd className="bg-tint text-ink-label rounded px-1 py-0.5 font-sans text-[11px]">⌘O</kbd> to browse
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
