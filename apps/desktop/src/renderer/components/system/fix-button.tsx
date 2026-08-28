import { useState } from "react";
import { AlertCircle, ArrowUpRight, Check, Copy, Download, Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { useCopied } from "../../lib/use-copied";

/**
 * The button that actually installs the thing.
 *
 * It used to copy the command to the clipboard, which is not an action: you
 * pressed "Install", nothing installed, and the row stayed amber. Now it runs
 * the command — through a login shell, so `npm` and `brew` mean what they mean
 * in a terminal rather than what they mean to a Finder-launched app, which is
 * nothing.
 *
 * It sends an ID, never a command. The main process owns the table of what can
 * be run. A button that could name its own command would be a way to run
 * anything from a web page.
 *
 * When it fails, the failure is the point. `npm i -g` fails for reasons a
 * person can act on — a permission, a proxy, a package that moved — and those
 * reasons are in the output. Reporting "failed" and hiding them would send
 * somebody to a terminal to run the command again just to read the error. So
 * the output is shown, the command is still copyable, and there is a link to
 * where the thing comes from.
 */
export function FixButton({
  fixId,
  label,
  command,
  onDone,
  compact = false,
}: {
  fixId: string;
  /** The verb for this particular fix: Install, Start, Sign in. */
  label: string;
  /** Shown on failure, and copyable, so nothing here is a dead end. */
  command: string;
  onDone: () => void;
  compact?: boolean;
}): JSX.Element {
  const [state, setState] = useState<"idle" | "running">("idle");
  const [failure, setFailure] = useState<{ output: string; homepage: string | null } | null>(null);
  const { copied, copy } = useCopied();

  const run = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setState("running");
    setFailure(null);
    void window.lirovo.runFix(fixId).then((answer) => {
      setState("idle");
      if (!answer.ok) {
        setFailure({ output: answer.error.message, homepage: null });
        return;
      }
      if (answer.value.ok) {
        onDone();
        return;
      }
      setFailure({ output: answer.value.output, homepage: answer.value.homepage });
    });
  };

  if (failure !== null) {
    return (
      <span className="flex min-w-0 shrink-0 items-center gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            copy(command);
          }}
          title={failure.output === "" ? command : failure.output}
          className={cn(
            "flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors",
            copied ? "bg-success-tint text-success-text" : "bg-danger-tint text-danger-text hover:opacity-80",
          )}
        >
          {copied ? <Check className="size-3" /> : <AlertCircle className="size-3" />}
          {copied ? "Copied" : "Failed — copy it"}
        </button>
        {failure.homepage !== null && (
          <a
            href={failure.homepage}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={failure.homepage}
            className="text-ink-subtle hover:text-ink-strong transition-colors"
          >
            <ArrowUpRight className="size-3.5" />
          </a>
        )}
      </span>
    );
  }

  return (
    <button
      onClick={run}
      disabled={state === "running"}
      title={command}
      className={cn(
        "flex shrink-0 items-center gap-1.5 font-medium transition-colors",
        compact ? "h-6 rounded px-2 text-[11px]" : "h-7 rounded-md px-2.5 text-xs",
        state === "running" ? "bg-tint text-ink-label" : "liq-solid liq-solid-brand",
      )}
    >
      {state === "running" ? (
        <>
          <Loader2 className="size-3 animate-spin" />
          Installing
        </>
      ) : (
        <>
          <Download className="size-3" />
          {label}
        </>
      )}
    </button>
  );
}

/** Still available, for anyone who would rather run it themselves. */
export function CopyCommandButton({ command }: { command: string }): JSX.Element {
  const { copied, copy } = useCopied();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        copy(command);
      }}
      title={`Copy: ${command}`}
      className={cn(
        "flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors",
        copied ? "bg-success-tint text-success-text" : "text-ink-subtle hover:bg-tint hover:text-ink-strong",
      )}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
