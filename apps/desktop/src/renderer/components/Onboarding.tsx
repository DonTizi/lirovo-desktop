import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { Fix } from "@lirovo/contracts";
import { canExtract, onboardingSteps, type OnboardingStep, type StepId } from "@lirovo/core";
import { InstallButton } from "./system/install-button";
import { FixButton } from "./system/fix-button";
import { PixelField } from "./PixelField";
import { Mark } from "./logos";
import { cn } from "../lib/cn";
import { useCopied } from "../lib/use-copied";
import { FETCHABLE, label, type SystemReport } from "../lib/system-vocabulary";

/**
 * The first launch: a welcome, and then only the work that is left.
 *
 * The version this replaces was a diagnostics table wearing a welcome's title.
 * Nine rows were expanded at once, most of them saying "9.0.1 · homebrew" — a
 * fact nobody needs on a first launch — and the one step that needed acting on
 * had exactly the same weight, size and density as the two that did not. The
 * eye had no path through it.
 *
 * So: a settled step collapses to a single line and gets out of the way, and
 * only what is unsettled is open. Attention goes where the work is, which is
 * the entire job of this screen.
 *
 * Monospace is reserved for commands — things somebody will actually type. A
 * version string set in mono is a terminal costume on a number nobody will ever
 * retype, and it was most of what the old screen showed.
 */

const TITLES: Record<StepId, { title: string; about: string }> = {
  tools: { title: "Tools", about: "Reading video, pulling frames, downloading links." },
  speech: { title: "Speech", about: "Turning what is said into text this app can point back at." },
  model: { title: "Model", about: "Reading the frames and building the graph. This one is yours." },
};

/** Where a thing comes from, when a command is not the whole answer. */
const HOMEPAGES: Record<string, string> = {
  local: "https://ollama.com/download",
  codex: "https://github.com/openai/codex",
  claude: "https://claude.ai/code",
};

/**
 * Arriving out of a blur, once.
 *
 * Not a slide and not a fade: a soft focus resolving is the one entrance that
 * reads as a thing coming into being rather than a thing sliding in from
 * offscreen — which is what a first launch is. It happens on arrival and never
 * again; nothing on this screen moves after it has landed.
 */
const arrive = (delay: number) => ({
  initial: { opacity: 0, y: 12, filter: "blur(10px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function Onboarding({
  report,
  onRecheck,
  onDone,
  onChooseBackend,
  checking,
}: {
  report: SystemReport;
  onRecheck: () => void;
  onDone: () => void;
  onChooseBackend: (id: string) => void;
  checking: boolean;
}): JSX.Element {
  const steps = onboardingSteps({
    dependencies: report.dependencies,
    asr: report.asr,
    backends: report.backends,
    defaultBackendId: report.defaultBackendId,
  });
  const ready = canExtract(steps);
  const left = steps.filter((s) => s.state !== "done").length;

  return (
    <div className="relative pb-16">
      {/* The texture carries past the title and over the cards, then falls
          away. The old screen let it stop at the heading, so the welcome had
          atmosphere for one line and none where the content actually was. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 h-[440px] overflow-hidden"
        style={{
          WebkitMaskImage: "linear-gradient(180deg, #000 0, rgba(0,0,0,0.35) 55%, transparent 100%)",
          maskImage: "linear-gradient(180deg, #000 0, rgba(0,0,0,0.35) 55%, transparent 100%)",
        }}
      >
        <div className="relative mx-auto h-full w-fit">
          <PixelField side="left" />
          <PixelField side="right" />
        </div>
      </div>

      <header className="relative pt-10 text-center">
        <motion.h1
          {...arrive(0.05)}
          className="text-ink-strong text-[44px] font-semibold leading-[1.05] tracking-[-0.03em]"
        >
          Welcome to Lirovo
        </motion.h1>
        {/* The welcome says what the app is, and stops. Gluing a progress
            count onto the end of it put two registers in one sentence — a
            product line and a status line — and the status belongs with the
            things it is counting. */}
        <motion.p {...arrive(0.14)} className="text-ink-label mx-auto mt-4 max-w-md text-[15px] leading-relaxed">
          Every value it pulls out of a video comes back with the moment that proves it.
        </motion.p>
      </header>

      <div className="relative mx-auto mt-12 max-w-xl">
        <motion.p
          {...arrive(0.2)}
          className="text-ink-subtle mb-3 px-1 text-xs"
        >
          {left === 0
            ? "Everything is in place. This screen will not come back."
            : left === 1
              ? "One thing left to settle."
              : `${left} things left to settle.`}
        </motion.p>

        <div className="space-y-2.5">
        {steps.map((step, i) => (
          <motion.div key={step.id} {...arrive(0.24 + i * 0.08)}>
            <Step
              step={step}
              index={i + 1}
              report={report}
              onRecheck={onRecheck}
              onChooseBackend={onChooseBackend}
            />
          </motion.div>
        ))}
        </div>

        <motion.div {...arrive(0.24 + steps.length * 0.08)} className="flex flex-col items-center gap-3 pt-8">
          <button
            onClick={onDone}
            disabled={!ready}
            className={cn(
              "liq-solid liq-solid-brand flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-medium",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {ready ? "Start extracting" : "Not ready yet"}
            {ready && <ArrowRight className="size-4" />}
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={onRecheck}
              className="text-ink-subtle hover:text-ink flex items-center gap-1.5 text-xs transition-colors"
            >
              <RefreshCw className={cn("size-3", checking && "animate-spin")} />
              Check again
            </button>
            {/* Skippable, deliberately. Somebody who knows they are about to
                start Ollama should not be held here by a check that is about to
                be true. What it cannot do is pretend the machine is ready. */}
            {!ready && (
              <button onClick={onDone} className="text-ink-subtle hover:text-ink text-xs transition-colors">
                Skip for now
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * One step: a line when it is settled, an open card when it is not.
 *
 * The settled ones stay openable, so nothing is hidden — but they cost one line
 * instead of five, and the difference is the whole hierarchy.
 */
function Step({
  step,
  index,
  report,
  onRecheck,
  onChooseBackend,
}: {
  step: OnboardingStep;
  index: number;
  report: SystemReport;
  onRecheck: () => void;
  onChooseBackend: (id: string) => void;
}): JSX.Element {
  const done = step.state === "done";
  const [open, setOpen] = useState(!done);
  const meta = TITLES[step.id];

  return (
    <section
      className={cn(
        "bg-base overflow-hidden rounded-xl transition-shadow",
        // A ring, never a soft shadow — the register has one elevation and this
        // is it. The unsettled card carries a slightly stronger one, which is
        // the only weight difference needed to say which card is the work.
        done ? "shadow-[var(--kumo-ring)]" : "shadow-[var(--kumo-ring-drop)]",
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-elevated/60 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
      >
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-medium transition-colors duration-300",
            done ? "bg-success text-white" : "bg-ink-strong text-base",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.span
                key="ok"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <Check className="size-3.5" />
              </motion.span>
            ) : (
              <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {index}
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        <span className="min-w-0 flex-1">
          <span className="text-ink-strong block text-[15px] font-medium leading-tight">{meta.title}</span>
          <span className={cn("mt-1 block truncate text-[13px]", done ? "text-ink-subtle" : "text-ink-label")}>
            {step.subject === null ? step.headline : `${label(step.subject)} — ${step.headline}`}
          </span>
        </span>

        <ChevronDown
          className={cn("text-ink-subtle size-4 shrink-0 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="text-ink-subtle border-hairline border-t px-4 pb-2 pt-3 text-xs">{meta.about}</p>
            <Detail id={step.id} report={report} onRecheck={onRecheck} onChooseBackend={onChooseBackend} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Detail({
  id,
  report,
  onRecheck,
  onChooseBackend,
}: {
  id: StepId;
  report: SystemReport;
  onRecheck: () => void;
  onChooseBackend: (id: string) => void;
}): JSX.Element {
  if (id === "tools") {
    return (
      <div className="pb-1">
        {report.dependencies.map((dep) => (
          <Row
            key={dep.id}
            name={label(dep.id)}
            detail={dep.found ? `${dep.version ?? "installed"} · ${dep.origin ?? ""}` : (dep.fix?.command ?? "not found")}
            mono={!dep.found}
            ok={dep.found}
            fetchable={dep.found ? null : (FETCHABLE[dep.id] ?? null)}
            fix={dep.found ? null : dep.fix}
            fixId={dep.id}
            onRecheck={onRecheck}
          />
        ))}
      </div>
    );
  }

  if (id === "speech") {
    return (
      <div className="pb-1">
        {report.asr.map((probe) => {
          const covers = [probe.forUrl ? "links" : null, probe.forFile ? "local files" : null].filter((k) => k !== null);
          const on = covers.length > 0;
          return (
            <Row
              key={probe.name}
              name={label(probe.name)}
              detail={on ? covers.join(" + ") : (probe.hint ?? "unavailable")}
              mono={false}
              ok={on}
              fetchable={on ? null : (FETCHABLE[probe.name] ?? null)}
              fix={null}
              onRecheck={onRecheck}
            />
          );
        })}
      </div>
    );
  }

  // The step says this one is yours, so the rows ARE the choosing. An earlier
  // draft left them read-only and sent people to Settings for the one decision
  // this screen exists to make.
  const live = report.backends.filter((b) => b.available).map((b) => b.id);
  const effective = live.find((x) => x === report.defaultBackendId) ?? live[0] ?? null;
  return (
    <div className="pb-1">
      {report.backends.map((b) => (
        <Row
          key={b.id}
          name={label(b.id)}
          detail={b.available ? (b.version ?? "connected") : (b.fix?.command ?? b.reason ?? "not available")}
          mono={!b.available}
          ok={b.available}
          fetchable={null}
          fix={b.available ? null : b.fix}
          fixId={b.id}
          href={b.available ? undefined : HOMEPAGES[b.id]}
          onRecheck={onRecheck}
          logo={b.id}
          // Only a running backend can be picked. Offering the choice on one
          // that is off would store a preference the next extraction silently
          // overrides.
          {...(b.available ? { onChoose: () => onChooseBackend(b.id), chosen: b.id === effective } : {})}
        />
      ))}
    </div>
  );
}

/**
 * One line, and every way this app can help with it.
 *
 * `mono` is set only when the detail is a command — something somebody will
 * type. A version in monospace is a terminal costume on a number nobody will
 * ever retype, and it was most of what the previous screen showed.
 */
function Row({
  name,
  detail,
  mono,
  ok,
  fetchable,
  fix,
  fixId,
  href,
  onRecheck,
  logo,
  onChoose,
  chosen,
}: {
  name: string;
  detail: string;
  mono: boolean;
  ok: boolean;
  fetchable: "whisper-model" | "yt-dlp" | null;
  fix: Fix | null;
  /** Which entry in the app's fix table this row is. Sent instead of a command. */
  fixId?: string | undefined;
  href?: string | undefined;
  onRecheck: () => void;
  logo?: string;
  onChoose?: () => void;
  chosen?: boolean;
}): JSX.Element {
  const body = (
    <>
      {logo !== undefined ? (
        <Mark id={logo} className="size-4 shrink-0" />
      ) : (
        <span className={cn("size-1.5 shrink-0 rounded-full", ok ? "bg-success" : "bg-warning")} />
      )}
      <span className="text-ink-strong w-32 shrink-0 truncate text-left text-[13px]">{name}</span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-left text-xs",
          mono ? "text-ink-label font-mono" : "text-ink-subtle",
        )}
      >
        {detail}
      </span>
      {chosen === true && (
        <span className="bg-success-tint text-success-text shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium">
          Default
        </span>
      )}
    </>
  );

  const actions = (
    <>
      {/* Run it. The previous version copied the command to the clipboard and
          called that an install, which left the row exactly as amber as it
          found it. */}
      {fix !== null && fixId !== undefined && (
        <FixButton fixId={fixId} label={fix.label} command={fix.command} onDone={onRecheck} compact />
      )}
      {href !== undefined && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={href}
          className="text-ink-subtle hover:text-ink-strong shrink-0 transition-colors"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
      {fetchable !== null && <InstallButton what={fetchable} onDone={onRecheck} compact />}
    </>
  );

  const shared = "mx-1.5 flex items-center gap-3 rounded-lg px-2.5 py-2";
  return onChoose === undefined ? (
    <div className={shared}>
      {body}
      {actions}
    </div>
  ) : (
    <div className={cn(shared, "hover:bg-elevated transition-colors", chosen === true && "bg-elevated")}>
      <button onClick={onChoose} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {body}
      </button>
      {actions}
    </div>
  );
}

/**
 * The command, one click from the clipboard.
 *
 * It says "Copy", not the fix's own verb. Wearing `fix.label` made it read
 * "Install" and install nothing: you would press it, nothing would happen, and
 * the row would still be amber.
 */
function CopyCommand({ fix }: { fix: Fix }): JSX.Element {
  const { copied, copy } = useCopied();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        copy(fix.command);
      }}
      title={`Copy: ${fix.command}`}
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
