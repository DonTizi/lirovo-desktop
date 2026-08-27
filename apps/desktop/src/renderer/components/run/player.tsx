import { Film } from "lucide-react";
import type { RunArtifacts } from "../../../main/ipc.js";
import { formatTime, type Lens } from "./lens";
import { cn } from "../../lib/cn";

/**
 * The player, the filmstrip and the timeline, as one control.
 *
 * They sit together because they are one instrument: the strip says what the
 * video looks like at a glance, the timeline says where the evidence is, and
 * both seek the clock the player reads from. Splitting them across tabs would
 * make the position something the user has to re-establish every time.
 */
/**
 * At most one mark per slot along the strip.
 *
 * A twenty-minute talk produces hundreds of evidence spans and hundreds of
 * frames. Drawn one-for-one they merge into a solid blue band that says
 * nothing except "there is a lot", and cost hundreds of DOM nodes to say it.
 */
const SLOTS = 120;
const thinned = (times: readonly number[], durationS: number): number[] => {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const t of times) {
    const slot = Math.round((t / Math.max(1, durationS)) * SLOTS);
    if (seen.has(slot)) continue;
    seen.add(slot);
    out.push(t);
  }
  return out;
};

export function Player({
  artifacts,
  lens,
  marks,
}: {
  artifacts: RunArtifacts;
  lens: Lens;
  /** Instants worth pointing at — one per evidence span. */
  marks: readonly { readonly t: number; readonly label: string }[];
}): JSX.Element {
  const durationS = artifacts.durationS ?? 1;
  const kept = artifacts.frames.filter((f) => f.kept);

  // Evenly spaced across the video rather than the first N: a strip that stops
  // a third of the way in describes a third of the video. Six, not twelve,
  // because the column is 40% of the window — twelve made each thumbnail 26px
  // wide with its timecode overlapping its neighbour's.
  const wanted = Math.min(6, kept.length);
  const strip = Array.from({ length: wanted }, (_, i) => {
    const target = ((i + 0.5) / wanted) * durationS * 1000;
    return kept.reduce((best, f) => (Math.abs(f.tMs - target) < Math.abs(best.tMs - target) ? f : best));
  }).filter((f, i, all) => all.findIndex((x) => x.idx === f.idx) === i);

  const at = (t: number): string => `${Math.min(100, Math.max(0, (t / durationS) * 100))}%`;

  return (
    <div className="bg-base shadow-ring overflow-hidden rounded-lg">
      {artifacts.videoUrl === null ? (
        <div className="text-ink-subtle flex h-40 flex-col items-center justify-center gap-2 text-sm">
          <Film className="size-5" />
          No video was kept for this run.
        </div>
      ) : (
        <video
          ref={lens.attach}
          controls
          preload="metadata"
          src={artifacts.videoUrl}
          className="max-h-[46vh] w-full bg-black"
        />
      )}

      {strip.length > 0 && (
        <div className="border-hairline flex h-16 gap-px border-t">
          {strip.map((frame) => {
            const active = Math.abs(lens.t * 1000 - frame.tMs) < (durationS * 1000) / (strip.length * 2);
            return (
              <button
                key={frame.idx}
                onClick={() => lens.seek(frame.tMs / 1000)}
                aria-label={`Seek to ${formatTime(frame.tMs / 1000)}`}
                className={cn(
                  "group/strip relative min-w-0 flex-1 overflow-hidden transition-opacity",
                  active ? "opacity-100" : "opacity-70 hover:opacity-100",
                )}
              >
                <img src={frame.url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                {/* Shown on the current frame and on hover only: six timecodes
                    printed permanently is a caption competing with the picture
                    it is captioning. */}
                <span
                  className={cn(
                    "absolute bottom-0.5 right-1 rounded bg-black/70 px-1 font-mono text-[10px] tabular-nums text-white transition-opacity",
                    active ? "opacity-100" : "opacity-0 group-hover/strip:opacity-100",
                  )}
                >
                  {formatTime(frame.tMs / 1000)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* The timeline is where the evidence is, not a second scrubber: the
          player already has one, and two would compete. */}
      <div
        className="border-hairline bg-recessed relative h-8 cursor-pointer border-t"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          lens.seek(((e.clientX - box.left) / box.width) * durationS);
        }}
      >
        {thinned(marks.map((m) => m.t), durationS).map((t) => (
          <span
            key={`m${t}`}
            title={formatTime(t)}
            className="bg-brand/50 absolute top-2 h-4 w-px"
            style={{ left: at(t) }}
          />
        ))}
        {thinned(
          artifacts.frames.filter((f) => f.kept).map((f) => f.tMs / 1000),
          durationS,
        ).map((t) => (
          <span
            key={`f${t}`}
            className="bg-ink-subtle absolute bottom-1 size-1 -translate-x-1/2 rounded-full"
            style={{ left: at(t) }}
          />
        ))}
        <span
          className="bg-ink-strong absolute inset-y-0 w-0.5 transition-[left] duration-100"
          style={{ left: at(lens.t) }}
        />
      </div>
    </div>
  );
}
