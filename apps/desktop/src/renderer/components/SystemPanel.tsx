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
  /** Version and origin when it works; the reason, or the command, when not. */
  readonly detail: string;
  /** What it is for. On hover only: a user needs it once, not on every render. */
  readonly role: string;
  readonly health: Health;
  /** Right-hand word. Empty when the row is fine — silence is the good state. */
  readonly state: string;
  readonly fix: Fix | null;
}

const NAMES: Record<string, string> = {
  ffmpeg: "FFmpeg",
  "yt-dlp": "yt-dlp",
  local: "Ollama",
  codex: "Codex",
  claude: "Claude Code",
  captions: "Subtitles",
  "whisper-cpp": "Whisper",
  "whisper-api": "Whisper API",
};

const ROLES: Record<string, string> = {
  ffmpeg: "cuts frames and audio, reads duration and streams",
  "yt-dlp": "downloads links and their subtitles",
  local: "runs a model on this Mac",
  codex: "reads frames and builds the graph",
  claude: "reads frames and builds the graph",
  captions: "free transcript when the platform publishes one",
  "whisper-cpp": "transcription on this Mac, no network",
  "whisper-api": "transcription off the machine",
};

const label = (id: string): string => NAMES[id] ?? id;

const DOT: Record<Health, string> = { ok: "bg-success", warn: "bg-warning", off: "bg-danger" };
const RANK: Record<Health, number> = { off: 0, warn: 1, ok: 2 };

/**
 * Broken first. A list in declaration order buries the one row that matters.
 *
 * Generic so a caller that has already narrowed its items — to the ones with a
 * fix, say — does not lose that narrowing by sorting them.
 */
const worstFirst = <T extends { readonly health: Health }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => RANK[a.health] - RANK[b.health]);

/** Copy-to-clipboard with its own confirmation, so nothing else has to track it. */
function CopyFix({ fix, solid }: { fix: Fix; solid?: boolean }): JSX.Element {
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
        "flex h-6 shrink-0 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors",
        copied
          ? "bg-success-tint text-success-text"
          : solid
            ? "liq-solid liq-solid-brand"
            : "bg-tint text-ink-label hover:bg-fill hover:text-ink-strong",
      )}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : fix.label}
    </button>
  );
}

/**
 * One line, 36px, and nothing on the right when the row is fine.
 *
 * A column of identical "Ready"s trains the eye to skip that column, which is
 * exactly the column that has to be read the day one of them changes.
 */
function Row({ item }: { item: Item }): JSX.Element {
  return (
    <div
      title={item.role}
      className="hover:bg-elevated flex h-9 items-center gap-2.5 px-3.5 transition-colors"
    >
      <Mark id={item.id} className={cn("size-4", item.health === "off" && "opacity-35 grayscale")} />
      <span className="text-ink-strong w-28 shrink-0 truncate text-sm font-medium">{label(item.id)}</span>
      <span className={cn("text-ink-subtle min-w-0 flex-1 truncate text-xs", item.fix !== null && "font-mono")}>
        {item.detail}
      </span>
      {item.fix !== null ? (
        <CopyFix fix={item.fix} />
      ) : item.state !== "" ? (
        <span className="text-ink-subtle shrink-0 text-xs">{item.state}</span>
      ) : null}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="text-ink-subtle px-3.5 pb-1 pt-3 text-[11px] uppercase tracking-wide">{children}</p>;
}

/**
 * ffprobe ships inside FFmpeg and is never installed on its own, so two rows
 * for it are two rows that always say the same thing — except when they do not,
 * and that is the case the merged row has to keep. It takes the worse of the two.
 */
const mergeFfmpeg = (deps: readonly BinaryStatus[]): BinaryStatus | null => {
  const parts = deps.filter((d) => d.id === "ffmpeg" || d.id === "ffprobe");
  const broken = parts.find((d) => !d.found || d.stale !== null);
  return broken ?? parts[0] ?? null;
};

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
    // "9.0.1 · homebrew" says which copy answered, which is the whole question
    // when two are installed.
    ...base,
    detail: `${dep.version ?? "installed"}${dep.origin === null ? "" : ` · ${dep.origin}`}`,
    health: "ok",
    state: "",
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
        state: "",
        fix: null,
      }
    : {
        ...base,
        detail: backend.fix?.command ?? backend.reason ?? "not available",
        // Off is not broken: one connected model is all a run needs, and the
        // strip only turns amber when the doctor itself raised something.
        health: "warn",
        state: "Off",
        fix: backend.fix,
      };
};

/**
 * A transcription link, carrying the fix for the tool it depends on.
 *
 * Whisper on this Mac is off because whisper-cli is missing or its model is
 * not downloaded. The row that reports the loss is the row that should offer
 * the cure, rather than sending someone hunting one group up.
 */
const fromAsr = (probe: AsrProbe, toolFix: Fix | null): Item => {
  const covers = [probe.forUrl ? "links" : null, probe.forFile ? "local files" : null].filter((k) => k !== null);
  const health: Health = covers.length === 2 ? "ok" : covers.length === 1 ? "ok" : "warn";
  return {
    id: probe.name,
    name: label(probe.name),
    role: ROLES[probe.name] ?? "transcribes",
    detail: covers.length > 0 ? covers.join(" + ") : (probe.hint ?? "unavailable"),
    health,
    state: covers.length === 0 ? "Off" : "",
    fix: covers.length === 0 ? toolFix : null,
  };
};

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

  const ffmpeg = mergeFfmpeg(report.dependencies);
  const media = [
    ...(ffmpeg === null ? [] : [fromBinary(ffmpeg)]),
    ...report.dependencies.filter((d) => d.id === "yt-dlp").map(fromBinary),
  ];
  const models = report.backends.map(fromBackend);
  // whisper-cli has no row of its own: the transcription link that needs it
  // reports the loss, so it carries the cure.
  const whisperFix = report.dependencies.find((d) => d.id === "whisper-cli")?.fix ?? null;
  const transcription = report.asr.map((probe) => fromAsr(probe, whisperFix));

  const all = [...media, ...models, ...transcription];
  const connected = all.filter((i) => i.health === "ok").length;

  // The strip follows the doctor's own verdict. Deriving it from the rows made
  // an optional backend sitting idle turn the whole thing amber, which said
  // "something is wrong" about a machine that was completely fine.
  const health: Health = !report.ok ? "off" : report.warnings.length > 0 ? "warn" : "ok";

  const blocking = worstFirst(all.filter((i): i is Item & { readonly fix: Fix } => i.fix !== null && i.health === "off"))[0] ?? null;

  const headline = !report.ok ? "Not ready" : "Ready to extract";
  const because = !report.ok
    ? (report.problems[0] ?? "something is missing")
    : health === "warn"
      ? (report.warnings[0] ?? "")
      : `${connected} connected`;

  return (
    <div className="bg-base shadow-ring overflow-hidden rounded-lg">
      <div className="flex h-11 items-center gap-3 px-3.5">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className={cn("size-2 shrink-0 rounded-full", DOT[health])} aria-hidden />
          <span className="text-ink-strong shrink-0 text-sm font-medium">{headline}</span>
          <span className="text-ink-subtle min-w-0 truncate text-xs">{because}</span>

          {/* The marks are the glance: recognising five logos is faster than
              reading "5 connected", and the dimmed ones say which is asleep. */}
          <span className="ml-auto flex shrink-0 items-center gap-1 pl-3">
            {all
              // One mark per brand, and no generic glyph: a placeholder shape in
              // a row of real logos reads as a mark that failed to load.
              .filter((item) => markFamily(item.id) !== "other")
              .filter((item, i, kept) => kept.findIndex((o) => markFamily(o.id) === markFamily(item.id)) === i)
              .map((item) => (
                <Mark
                  key={item.id}
                  id={item.id}
                  className={cn("size-4", item.health !== "ok" && "opacity-25 grayscale")}
                />
              ))}
          </span>
        </button>

        {blocking !== null && !open && <CopyFix fix={blocking.fix} solid />}

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
            <div className="border-hairline border-t pb-2">
              <Caption>Media</Caption>
              {worstFirst(media).map((item) => (
                <Row key={item.id} item={item} />
              ))}

              <Caption>Transcription</Caption>
              {worstFirst(transcription).map((item) => (
                <Row key={item.id} item={item} />
              ))}

              <Caption>Models</Caption>
              {worstFirst(models).map((item) => (
                <Row key={item.id} item={item} />
              ))}

              <p className="text-ink-subtle mt-2 px-3.5 text-[11px]">
                Each check runs the tool and reads its version. That proves it starts, not that a given
                video will download.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
