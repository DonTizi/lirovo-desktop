import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { Fix } from "@lirovo/contracts";
import type { AsrProbe, BackendStatus, BinaryStatus } from "@lirovo/core";
import { InstallButton } from "./system/install-button";
import { Mark, markFamily } from "./logos";
import { cn } from "../lib/cn";
import { useCopied } from "../lib/use-copied";
import {
  DOT,
  FETCHABLE,
  RANK,
  label,
  roleOf,
  worstFirst,
  type Health,
  type SystemReport,
} from "../lib/system-vocabulary";

export type { SystemReport };

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

/** Copy-to-clipboard with its own confirmation, so nothing else has to track it. */
function CopyFix({ fix, solid }: { fix: Fix; solid?: boolean }): JSX.Element {
  const { copied, copy } = useCopied();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        copy(fix.command);
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
function Row({
  item,
  selected,
  onSelect,
  onInstalled,
}: {
  item: Item;
  /** Set only on a row that is one of several a user picks between. */
  selected?: boolean;
  onSelect?: () => void;
  onInstalled?: () => void;
}): JSX.Element {
  const fetchable = FETCHABLE[item.id];
  const choosable = onSelect !== undefined;
  const body = (
    <>
      <Mark id={item.id} className={cn("size-4", item.health === "off" && "opacity-35 grayscale")} />
      <span className="text-ink-strong w-28 shrink-0 truncate text-sm font-medium">{label(item.id)}</span>
      <span className={cn("text-ink-subtle min-w-0 flex-1 truncate text-xs", item.fix !== null && "font-mono")}>
        {item.detail}
      </span>
      {/* An artifact this app can fetch and verify beats a command a person has
          to paste: the download is checked against a published checksum, and
          the paste is not checked at all. */}
      {item.fix !== null && fetchable !== undefined && onInstalled !== undefined ? (
        <InstallButton what={fetchable} onDone={onInstalled} compact />
      ) : item.fix !== null ? (
        <CopyFix fix={item.fix} />
      ) : selected === true ? (
        <span className="text-ink-strong flex shrink-0 items-center gap-1 text-xs font-medium">
          <Check className="size-3.5" />
          Default
        </span>
      ) : choosable ? (
        // Only on hover: a row of "Use" buttons next to the one that says
        // Default turns a settled choice back into a decision every time.
        <span className="text-ink-subtle shrink-0 text-xs opacity-0 transition-opacity group-hover:opacity-100">
          Make default
        </span>
      ) : item.state !== "" ? (
        <span className="text-ink-subtle shrink-0 text-xs">{item.state}</span>
      ) : null}
    </>
  );

  const shell = "group flex h-9 w-full items-center gap-2.5 px-3.5 text-left transition-colors hover:bg-elevated";
  return choosable ? (
    <button title={item.role} onClick={onSelect} className={cn(shell, selected === true && "bg-elevated")}>
      {body}
    </button>
  ) : (
    <div title={item.role} className={shell}>
      {body}
    </div>
  );
}

/**
 * A group's name, its rule, and whether the rule is met.
 *
 * The rule is the part a list of rows cannot express: three green models and
 * three green tools look identical, and yet one group needs all of its members
 * and the other needs exactly one.
 */
function Caption({ title, rule, note, tone }: { title: string; rule: string; note: string; tone: Health }): JSX.Element {
  return (
    <div className="flex items-baseline gap-2 px-3.5 pb-1 pt-3">
      <p className="text-ink-subtle text-[11px] uppercase tracking-wide">{title}</p>
      <p className="text-ink-placeholder text-[11px]">{rule}</p>
      <p
        className={cn(
          "ml-auto truncate text-[11px]",
          tone === "off" ? "text-danger-text" : tone === "warn" ? "text-warning-text" : "text-ink-subtle",
        )}
      >
        {note}
      </p>
    </div>
  );
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
  const base = { id: dep.id, name: label(dep.id), role: roleOf(dep.id, dep.why) };
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
  const base = { id: backend.id, name: label(backend.id), role: roleOf(backend.id, "runs the model") };
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
    role: roleOf(probe.name, "transcribes"),
    detail: covers.length > 0 ? covers.join(" + ") : (probe.hint ?? "unavailable"),
    health,
    state: covers.length === 0 ? "Off" : "",
    fix: covers.length === 0 ? toolFix : null,
  };
};

/**
 * What a group's rule means for this machine, said as a consequence.
 *
 * "yt-dlp missing" is a fact about a binary. "links cannot be downloaded" is
 * the same fact in the terms the person actually cares about, and it is the
 * only version that tells them whether to act.
 */
const MEDIA_LOSS: Record<string, { missing: string; stale: string }> = {
  ffmpeg: { missing: "nothing can be extracted", stale: "" },
  "yt-dlp": { missing: "links cannot be downloaded", stale: "downloads will start failing" },
};

const mediaVerdict = (items: readonly Item[]): { note: string; tone: Health } => {
  const hurt = worstFirst(items.filter((i) => i.health !== "ok"))[0];
  if (hurt === undefined) return { note: "both present", tone: "ok" };
  const loss = MEDIA_LOSS[hurt.id];
  const said = hurt.state === "Out of date" ? (loss?.stale ?? "") : (loss?.missing ?? "");
  return { note: said === "" ? `${label(hurt.id)} ${hurt.state.toLowerCase()}` : said, tone: hurt.health };
};

const transcriptionVerdict = (probes: readonly AsrProbe[]): { note: string; tone: Health } => {
  const links = probes.some((p) => p.forUrl);
  const files = probes.some((p) => p.forFile);
  if (links && files) return { note: "links and local files", tone: "ok" };
  if (links) return { note: "local files cannot be transcribed", tone: "warn" };
  if (files) return { note: "links cannot be transcribed", tone: "warn" };
  return { note: "nothing can be transcribed", tone: "off" };
};

const modelVerdict = (items: readonly Item[], chosenId: string | null): { note: string; tone: Health } => {
  const live = items.filter((i) => i.health === "ok");
  if (live.length === 0) return { note: "none available — extraction cannot run", tone: "off" };
  const chosen = live.find((i) => i.id === chosenId) ?? live[0];
  // Names the model that will actually run, not the one that is stored: a
  // preference pointing at something that quit should not read as in force.
  return {
    note: `${label(chosen?.id ?? "")} runs the next extraction`,
    tone: "ok",
  };
};

export function SystemPanel({
  report,
  onRecheck,
  onChooseBackend,
  checking,
  expanded,
}: {
  report: SystemReport | null;
  onRecheck: () => void;
  onChooseBackend: (backendId: string) => void;
  checking: boolean;
  /** On its own page there is nothing to disclose: it is already the subject. */
  expanded?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(expanded === true);

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

  const blocking =
    worstFirst(all.filter((i): i is Item & { readonly fix: Fix } => i.fix !== null && i.health === "off"))[0] ?? null;

  // The stored choice only counts while that model still answers. Marking a
  // backend "Default" while a different one would actually run is the kind of
  // small lie that makes people stop trusting the whole panel.
  const liveModels = models.filter((m) => m.health === "ok");
  const effectiveBackendId =
    liveModels.find((m) => m.id === report.defaultBackendId)?.id ?? liveModels[0]?.id ?? null;

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

        {blocking !== null &&
          !open &&
          (FETCHABLE[blocking.id] !== undefined ? (
            <InstallButton what={FETCHABLE[blocking.id] as "whisper-model" | "yt-dlp"} onDone={onRecheck} compact />
          ) : (
            <CopyFix fix={blocking.fix} solid />
          ))}

        <button
          onClick={onRecheck}
          disabled={checking}
          title="Check again"
          className="text-ink-subtle hover:text-ink shrink-0 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", checking && "animate-spin")} />
        </button>
        {expanded !== true && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Hide details" : "Show details"}
            className="text-ink-subtle hover:text-ink shrink-0 transition-colors"
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
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
              <Caption title="Media" rule="both needed" {...mediaVerdict(media)} />
              {worstFirst(media).map((item) => (
                <Row key={item.id} item={item} onInstalled={onRecheck} />
              ))}

              <Caption title="Transcription" rule="one is enough" {...transcriptionVerdict(report.asr)} />
              {worstFirst(transcription).map((item) => (
                <Row key={item.id} item={item} onInstalled={onRecheck} />
              ))}

              <Caption title="Models" rule="pick one" {...modelVerdict(models, report.defaultBackendId)} />
              {worstFirst(models).map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  {...(item.health === "ok"
                    ? { selected: item.id === effectiveBackendId, onSelect: () => onChooseBackend(item.id) }
                    : {})}
                />
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
