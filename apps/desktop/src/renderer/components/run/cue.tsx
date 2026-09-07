import { cn } from "../../lib/cn";
import { formatTime, type Lens } from "./lens";

/** An explicit playback action, shared by every evidence surface. */
export function Cue({
  t,
  lens,
  tone,
}: {
  t: number;
  lens: Lens;
  tone?: "quiet";
}): JSX.Element {
  const active = lens.t >= t && lens.t < t + 6;
  return (
    <button
      onClick={() => lens.seek(t)}
      aria-label={`Play source at ${formatTime(t)}`}
      className={cn(
        "inline-flex min-h-7 shrink-0 items-center rounded-md px-2 py-1 font-mono text-xs tabular-nums transition-colors",
        tone === "quiet"
          ? "text-ink-subtle hover:bg-tint hover:text-ink"
          : active
            ? "bg-ink-strong text-ink-inverse"
            : "bg-tint text-ink-label hover:bg-ink-strong hover:text-ink-inverse",
      )}
    >
      {formatTime(t)}
    </button>
  );
}
