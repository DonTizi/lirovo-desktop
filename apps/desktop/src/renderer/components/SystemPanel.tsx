import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { Fix } from "@lirovo/contracts";
import type { AsrProbe, BackendStatus, BinaryStatus } from "@lirovo/core";
import { Mark, markFamily } from "./logos";
import { cn } from "../lib/cn";

/** Exactly the part of the doctor report this strip draws. */
export interface SystemReport {
  readonly ok: boolean;
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
  readonly dependencies: readonly BinaryStatus[];
  readonly backends: readonly BackendStatus[];
  readonly asr: readonly AsrProbe[];
}

type Health = "ok" | "warn" | "off";

interface Item {
  readonly id: string;
  readonly name: string;
  /** What it is for. Constant, so the row still reads when everything is fine. */
  readonly role: string;
  /** Version and origin when it works; the reason, or the command, when not. */
  readonly detail: string;
  readonly health: Health;
  readonly state: string;
  readonly fix: Fix | null;
}

/**
 * Names as a person would say them, not as the binary is called.
 *
 * `whisper-cli` is a build artefact of whisper.cpp and means nothing to someone
 * deciding whether their Mac can transcribe without the network.
 */
const NAMES: Record<string, string> = {
  ffmpeg: "FFmpeg",
  ffprobe: "FFprobe",
  "yt-dlp": "yt-dlp",
  "whisper-cli": "Whisper",
  local: "Ollama",
  codex: "Codex",
  claude: "Claude Code",
  captions: "Subtitles",
  "whisper-cpp": "Whisper on this Mac",
  "whisper-api": "Whisper API",
};

const ROLES: Record<string, string> = {
  ffmpeg: "cuts frames and audio",
  ffprobe: "reads duration and streams",
  "yt-dlp": "downloads links and subtitles",
  "whisper-cli": "transcribes without the network",
  local: "runs a model on this Mac",
  codex: "reads frames and builds the graph",
  claude: "reads frames and builds the graph",
  captions: "free transcript when the platform has one",
  "whisper-cpp": "on-device transcription",
  "whisper-api": "transcription off the machine",
};

const label = (id: string): string => NAMES[id] ?? id;

const DOT: Record<Health, string> = { ok: "bg-success", warn: "bg-warning", off: "bg-danger" };

/** Copy-to-clipboard with its own confirmation, so nothing else has to track it. */
function CopyFix({ fix, subtle }: { fix: Fix; subtle?: boolean }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(fix.command).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
      title={`Copy: ${fix.command}`}
      className={cn(
        "flex h-7 shrink-0 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
        copied
          ? "bg-success-tint text-success-text"
          : subtle
            ? "bg-tint text-ink-label hover:bg-fill hover:text-ink-strong"
            : "liq-solid liq-solid-brand",
      )}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : fix.label}
    </button>
  );
}

function Row({ item }: { item: Item }): JSX.Element {
  return (
    <div className="border-hairline hover:bg-elevated flex items-center gap-3 border-b px-3.5 py-2.5 transition-colors last:border-b-0">
      <span className="bg-base shadow-ring grid size-7 shrink-0 place-items-center rounded-md">
        <Mark id={item.id} className={cn("size-4", item.health === "off" && "opacity-40")} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-ink-strong truncate font-medium">{label(item.id)}</span>
          <span className="text-ink-subtle truncate text-xs">{item.role}</span>
        </span>
        <span className={cn("text-ink-subtle block truncate text-xs", item.fix !== null && "font-mono")}>
          {item.detail}
        </span>
      </span>

      {item.fix === null ? (
        <span
          className={cn(
            "shrink-0 text-xs",
            item.health === "ok" ? "text-success-text" : "text-ink-subtle",
          )}
        >
          {item.state}
        </span>
      ) : (
        <CopyFix fix={item.fix} subtle />
      )}
    </div>
  );
}

const fromBinary = (dep: BinaryStatus): Item => {
  const base = { id: dep.id, name: label(dep.id), role: ROLES[dep.id] ?? dep.why };
  if (!dep.found) {
    return {
      ...base,
      detail: dep.fix?.command ?? `not found — needed to ${dep.why}`,
      health: dep.required ? "off" : "warn",
      state: dep.required ? "Missing" : "Optional",
      fix: dep.fix,
    };
  }
  if (dep.stale !== null) {
    return { ...base, detail: dep.fix?.command ?? dep.stale, health: "warn", state: "Out of date", fix: dep.fix };
  }
  return {
    ...base,
    // Version and origin: "8.0 · homebrew" tells a user which copy answered,
    // which is the whole question when two are installed.
    detail: `${dep.version ?? "installed"}${dep.origin === null ? "" : ` · ${dep.origin}`}`,
    health: "ok",
    state: "Ready",
    fix: null,
  };
};

const fromBackend = (backend: BackendStatus): Item => {
  const base = { id: backend.id, name: label(backend.id), role: ROLES[backend.id] ?? "runs the model" };
  return backend.available
    ? {
        ...base,
        detail: `${backend.version ?? "connected"}${backend.images === "none" ? " · text only" : ""}`,
        health: "ok",
        state: "Connected",
        fix: null,
      }
    : {
        ...base,
        detail: backend.fix?.command ?? backend.reason ?? "not available",
        health: "off",
        state: "Off",
        fix: backend.fix,
      };
};

const fromAsr = (probe: AsrProbe): Item => {
  const covers = [probe.forUrl ? "links" : null, probe.forFile ? "local files" : null].filter((k) => k !== null);
  return {
    id: probe.name,
    name: label(probe.name),
    role: ROLES[probe.name] ?? "transcribes",
    detail: covers.length > 0 ? covers.join(" + ") : (probe.hint ?? "unavailable"),
    health: covers.length === 2 ? "ok" : covers.length === 1 ? "warn" : "off",
    state: covers.length === 0 ? "Off" : covers.length === 1 ? "Partial" : "Ready",
    // No button: a transcription link is turned on by installing one of the
    // tools above, never by itself, and two buttons for one action is a lie.
    fix: null,
  };
};

/**
 * Broken first. A list in declaration order buries the one row that matters.
 *
 * Generic so a caller that has already narrowed its items — to the ones with a
 * fix, say — does not lose that narrowing by sorting them.
 */
const worstFirst = <T extends { readonly health: Health }>(items: readonly T[]): T[] => {
  const rank: Record<Health, number> = { off: 0, warn: 1, ok: 2 };
  return [...items].sort((a, b) => rank[a.health] - rank[b.health]);
};

function Group({ title, items }: { title: string; items: readonly Item[] }): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <>
      <p className="text-ink-subtle bg-recessed border-hairline border-b px-3.5 py-1 text-[11px] uppercase tracking-wide">
        {title}
      </p>
      {worstFirst(items).map((item) => (
        <Row key={item.id} item={item} />
      ))}
    </>
  );
}

/**
 * Whether this machine can run an extraction, in one line.
 *
 * It replaces a row of counters that repeated what the lists below already
 * said. Collapsed is the normal state on purpose: when everything works there
 * is nothing to decide, and a permanent wall of green rows trains people to
 * stop reading it — which is exactly when it needs to be read. It opens only
 * when someone asks, or carries the single blocking fix inline when it cannot
 * wait.
 */
export function SystemPanel({
  report,
  onRecheck,
  checking,
}: {
  report: SystemReport | null;
  onRecheck: () => void;
  checking: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  if (report === null) {
    return (
      <div className="bg-base shadow-ring text-ink-subtle flex h-12 items-center gap-2.5 rounded-lg px-3.5 text-sm">
        <RefreshCw className="size-3.5 animate-spin" />
        Checking what this machine can do
      </div>
    );
  }

  const tools = report.dependencies.map(fromBinary);
  const backends = report.backends.map(fromBackend);
  const asr = report.asr.map(fromAsr);
  const all = [...tools, ...backends, ...asr];
  const connected = all.filter((i) => i.health === "ok").length;

  // The one thing worth acting on, if there is one: a blocking tool before a
  // stale one, because the first stops the run and the second only degrades it.
  const actionable = all.filter((i): i is Item & { readonly fix: Fix } => i.fix !== null);
  const top = worstFirst(actionable)[0] ?? null;
  const health: Health = !report.ok ? "off" : all.some((i) => i.health !== "ok") ? "warn" : "ok";

  const headline = !report.ok ? "Not ready" : "Ready to extract";
  const because =
    top !== null
      ? `${label(top.id)} · ${top.state.toLowerCase()}`
      : health === "ok"
        ? "everything is connected"
        : "working with what is installed";

  return (
    <div className="bg-base shadow-ring overflow-hidden rounded-lg">
      <div className="flex h-12 items-center gap-3 px-3.5">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className={cn("size-2 shrink-0 rounded-full", DOT[health])} aria-hidden />
          <span className="min-w-0">
            <span className="text-ink-strong mr-2 font-medium">{headline}</span>
            <span className="text-ink-subtle text-xs">{because}</span>
          </span>

          {/* The stack is the glance: five marks at full strength say more, and
              faster, than "5 of 7 connected" ever does. */}
          <span className="ml-1 flex shrink-0 -space-x-1.5">
            {all
              .filter((item, i) => all.findIndex((o) => markFamily(o.id) === markFamily(item.id)) === i)
              .map((item) => (
                <span
                  key={item.id}
                  title={`${label(item.id)} — ${item.state.toLowerCase()}`}
                  className={cn(
                    "bg-base ring-hairline grid size-6 place-items-center rounded-full ring-1",
                    item.health !== "ok" && "opacity-35 grayscale",
                  )}
                >
                  <Mark id={item.id} className="size-3.5" />
                </span>
              ))}
          </span>
        </button>

        {top !== null && !open && <CopyFix fix={top.fix} />}

        <button
          onClick={onRecheck}
          disabled={checking}
          title="Check again"
          className="text-ink-subtle hover:text-ink shrink-0 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", checking && "animate-spin")} />
        </button>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Hide details" : "Show details"}
          className="text-ink-subtle hover:text-ink shrink-0 transition-colors"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="border-hairline border-t">
              <Group title="Tools" items={tools} />
              <Group title="Models" items={backends} />
              <Group title="Transcription" items={asr} />
            </div>
            <p className="border-hairline text-ink-subtle border-t px-3.5 py-2 text-[11px]">
              Each check runs the binary and reads its version. It proves the tool starts, not that a
              particular video will download.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
