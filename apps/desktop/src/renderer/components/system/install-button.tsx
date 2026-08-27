import { Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";

/**
 * The button for a row this app can fix on its own.
 *
 * A verified download, with the bytes shown as they arrive: at 60MB for a
 * speech model and 37MB for yt-dlp, a button that only greys out reads as one
 * that did nothing. On failure the message stays on the row — a checksum that
 * did not match is the one failure a user must not be allowed to miss.
 *
 * `compact` is the strip's version, which sits inside a row that is itself
 * clickable and so has to swallow the click.
 */
export function InstallButton({
  what,
  onDone,
  compact = false,
}: {
  what: "whisper-model" | "yt-dlp";
  onDone: () => void;
  compact?: boolean;
}): JSX.Element {
  const [working, setWorking] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(
    () =>
      window.lirovo.onInstallProgress((p) => {
        if (p.what !== what || p.total === null) return;
        setPct(Math.min(100, Math.round((p.received / p.total) * 100)));
      }),
    [what],
  );

  if (failed !== null) {
    return (
      <span className={cn("text-danger-text text-xs", compact && "shrink-0")} title={failed}>
        {failed.slice(0, compact ? 40 : 36)}
      </span>
    );
  }

  return (
    <button
      disabled={working}
      onClick={(e) => {
        if (compact) e.stopPropagation();
        setWorking(true);
        setPct(0);
        void window.lirovo.install(what).then((answer) => {
          setWorking(false);
          if (answer.ok) onDone();
          else setFailed(answer.error.message);
        });
      }}
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium transition-colors",
        compact ? "h-6 shrink-0 rounded px-2" : "h-7 rounded-md px-2.5",
        working ? "bg-tint text-ink-label" : "liq-solid liq-solid-brand",
      )}
    >
      {working ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
      {working ? (pct === null ? "downloading" : `${pct}%`) : "Install"}
    </button>
  );
}
