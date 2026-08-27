import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownToLine, RotateCw, X } from "lucide-react";
import { cn } from "../lib/cn";

type Phase =
  | { kind: "idle" }
  | { kind: "available"; version: string }
  | { kind: "downloading"; version: string; percent: number }
  | { kind: "ready"; version: string }
  | { kind: "refused"; version: string; why: string };

interface UpdateEvent {
  readonly kind: "checking" | "none" | "available" | "progress" | "ready" | "error";
  readonly version?: string;
  readonly percent?: number;
  readonly message?: string;
}

/**
 * One toast that changes state, not three that stack.
 *
 * An update is a single conversation — found, downloading, ready — and giving
 * each step its own notification means the reader is dismissing the middle of
 * a sentence.
 *
 * Nothing appears when there is no update. A toast that reports "you are up to
 * date" teaches people to dismiss this corner of the screen without reading
 * it, including on the day it says something else.
 */
export function UpdateToast(): JSX.Element | null {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Per version, not forever: dismissing 0.4.0 should not hide 0.5.0.
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(
    () =>
      window.lirovo.onUpdateEvent((raw) => {
        const event = raw as UpdateEvent;
        switch (event.kind) {
          case "available":
            setPhase({ kind: "available", version: event.version ?? "" });
            break;
          case "progress":
            setPhase((current) =>
              current.kind === "downloading" || current.kind === "available"
                ? { kind: "downloading", version: current.version, percent: event.percent ?? 0 }
                : current,
            );
            break;
          case "ready":
            setPhase({ kind: "ready", version: event.version ?? "" });
            break;
          // `none`, `checking` and `error` are deliberately silent. A failed
          // check is the updater's problem, not an interruption — Settings
          // shows it to anyone who goes looking.
          default:
            break;
        }
      }),
    [],
  );

  if (phase.kind === "idle") return null;
  if (dismissed === phase.version && phase.kind !== "refused") return null;

  const install = (): void => {
    void window.lirovo.updateInstall().then((answer) => {
      if (!answer.ok) return;
      if (!answer.value.installed) {
        setPhase({ kind: "refused", version: phase.version, why: answer.value.why ?? "not now" });
      }
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="bg-base shadow-popover fixed bottom-4 right-4 z-50 w-80 overflow-hidden rounded-xl"
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="text-ink-strong block text-[13px] font-medium">
              {phase.kind === "available" && `Lirovo ${phase.version} is available`}
              {phase.kind === "downloading" && `Downloading ${phase.version}`}
              {phase.kind === "ready" && `Lirovo ${phase.version} is ready`}
              {phase.kind === "refused" && "Not while a run is going"}
            </span>
            <span className="text-ink-subtle mt-0.5 block text-xs">
              {phase.kind === "available" && "Downloads in the background. Nothing restarts on its own."}
              {phase.kind === "downloading" && `${phase.percent}%`}
              {phase.kind === "ready" && "Restart when you are ready. Your library is untouched."}
              {phase.kind === "refused" && phase.why}
            </span>

            {phase.kind === "downloading" && (
              <span className="bg-fill mt-2 block h-1 overflow-hidden rounded-full">
                <span
                  className="bg-brand block h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${phase.percent}%` }}
                />
              </span>
            )}
          </span>

          <button
            onClick={() => setDismissed(phase.version)}
            aria-label="Dismiss"
            className="text-ink-subtle hover:text-ink shrink-0 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {(phase.kind === "available" || phase.kind === "ready" || phase.kind === "refused") && (
          <div className="border-hairline flex items-center justify-end gap-2 border-t px-4 py-2.5">
            <button
              onClick={() => setDismissed(phase.version)}
              className="text-ink-label hover:text-ink-strong h-7 px-2 text-xs transition-colors"
            >
              Later
            </button>
            <button
              onClick={() => {
                if (phase.kind === "available") {
                  setPhase({ kind: "downloading", version: phase.version, percent: 0 });
                  void window.lirovo.updateDownload();
                  return;
                }
                install();
              }}
              className={cn("liq-solid liq-solid-brand flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium")}
            >
              {phase.kind === "available" ? <ArrowDownToLine className="size-3" /> : <RotateCw className="size-3" />}
              {phase.kind === "available" ? "Download" : "Restart now"}
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
