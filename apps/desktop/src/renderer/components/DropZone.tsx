import { CloudUpload, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../lib/cn";
import { PixelField } from "./PixelField";

const FORMAT_HINT = "MP4 · MOV · MKV · WEBM · M4A · MP3 · a URL";

/**
 * One quiet ringed panel, the same shape as every other control here: no tinted
 * header band, no gradient. Elevation is the 1px ring, and the dashed inner edge
 * is the only thing saying "drop here".
 *
 * The whole card is the drop target, so a file let go anywhere over it lands.
 */
export function DropZone({
  busy,
  onPath,
  onBrowse,
}: {
  busy: boolean;
  onPath: (path: string) => void;
  onBrowse: () => void;
}): JSX.Element {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        if (file !== undefined) onPath(window.lirovo.pathForFile(file));
      }}
      data-awake={drag || busy ? "true" : undefined}
      className={cn(
        "relative rounded-xl transition-shadow",
        drag ? "shadow-[0_0_0_1px_var(--kumo-focus)] bg-elevated" : "shadow-control bg-base",
      )}
    >
      {/* Decoration, outside the card on both sides. It lives here rather than in
          the page so the drag state that lights it up is the same state that
          styles the card. */}
      <PixelField side="left" />
      <PixelField side="right" />

      <button
        type="button"
        onClick={onBrowse}
        disabled={busy}
        aria-label="Browse for a video"
        className={cn(
          "group flex w-full flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed px-6 py-10 text-center transition-colors disabled:cursor-default",
          drag ? "border-ink-strong" : "border-hairline hover:bg-elevated",
        )}
      >
        <span className="text-ink-subtle">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <CloudUpload className="size-5" />}
        </span>

        <span className="text-ink-strong text-lg font-medium">
          {busy ? "Extracting…" : "Drop your video here"}
        </span>

        <span className="text-ink-subtle text-xs">{FORMAT_HINT}</span>

        {/* A disabled control must not look pressable, so it drops the solid
            treatment entirely rather than dimming it. */}
        <span className={cn("mt-1.5 rounded-lg px-5 py-2.5 text-sm font-medium", busy ? "bg-fill text-ink-subtle" : "liq-solid")}>
          Browse files
        </span>
      </button>

      <input ref={inputRef} type="file" className="hidden" />
    </div>
  );
}
