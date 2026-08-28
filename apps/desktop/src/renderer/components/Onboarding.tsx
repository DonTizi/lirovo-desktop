import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import type { Fix } from "@lirovo/contracts";
import { canExtract, onboardingSteps, type OnboardingStep, type StepId } from "@lirovo/core";
import { InstallButton } from "./system/install-button";
import { Hero } from "./hero";
import { Mark } from "./logos";
import { cn } from "../lib/cn";
import { useCopied } from "../lib/use-copied";
import { FETCHABLE, label, type SystemReport } from "../lib/system-vocabulary";

/**
 * The three things a first launch still has to settle.
 *
 * Same shell, same hero, same pixel field as every other primary surface, and
 * the same rows as the Settings page — because every line here is the same
 * fact, read from the same doctor report. Somebody who finishes this screen and
 * opens Settings should recognise what they are looking at rather than meet a
 * second vocabulary for one machine.
 *
 * All three steps are visible at once rather than one per click. There are only
 * three, they are short, and hiding two of them makes it impossible to see that
 * the one you cannot fix is the third.
 *
 * Nothing here is decoration for its own sake. The cards arrive in sequence
 * because that is the order they are meant to be read in; the badge turns into
 * a tick when a step is settled, so the eye can find the unsettled one without
 * reading a word. Nothing bounces, nothing pulses, and nothing moves after it
 * has arrived.
 */

const TITLES: Record<StepId, { title: string; about: string }> = {
  tools: { title: "Tools", about: "Reading video, pulling frames, downloading links." },
  speech: { title: "Speech", about: "Turning what is said into text this app can point back at." },
  model: { title: "Model", about: "Reading the frames and building the graph. This one is yours to choose." },
};

/** Where a thing comes from, when a command is not the whole answer. */
const HOMEPAGES: Record<string, string> = {
  local: "https://ollama.com/download",
  codex: "https://github.com/openai/codex",
  claude: "https://claude.ai/code",
};

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
  const settled = steps.filter((s) => s.state === "done").length;

  return (
    <div className="pb-10">
      <Hero
        title="Before the first video"
        sub={
          settled === steps.length
            ? "Everything is in place. This screen will not come back."
            : `${settled} of ${steps.length} settled. The rest is below.`
        }
      />

      <div className="mx-auto mt-10 max-w-2xl space-y-3">
        {steps.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            // Read in order, so they arrive in order. 70ms apart is enough to
            // be a sequence rather than a stagger anyone has to wait through.
            transition={{ duration: 0.28, delay: 0.1 + i * 0.07, ease: [0.2, 0, 0, 1] }}
          >
            <Step
              step={step}
              index={i + 1}
              report={report}
              onRecheck={onRecheck}
              onChooseBackend={onChooseBackend}
            />
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 + steps.length * 0.07 }}
          className="flex items-center gap-3 pt-5"
        >
          <button
            onClick={onDone}
            disabled={!ready}
            className={cn(
              "liq-solid liq-solid-brand flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-medium transition-opacity",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {ready ? "Start extracting" : "Not ready yet"}
            {ready && <ArrowRight className="size-3.5" />}
          </button>

          <button
            onClick={onRecheck}
            className="border-hairline bg-base hover:bg-fill-hover flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors"
          >
            <RefreshCw className={cn("size-3.5", checking && "animate-spin")} />
            Check again
          </button>

          {/* Skippable, deliberately. Somebody who knows they are about to start
              Ollama should not be held here by a check that is about to be
              true. What it cannot do is pretend the machine is ready — the
              button above stays dead until it is. */}
          {!ready && (
            <button onClick={onDone} className="text-ink-subtle hover:text-ink ml-auto text-xs transition-colors">
              Skip for now
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

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
  const meta = TITLES[step.id];
  const done = step.state === "done";
  return (
    <section className="border-hairline bg-base overflow-hidden rounded-xl border">
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-medium transition-colors duration-300",
            done ? "bg-success text-white" : "bg-fill text-ink-label",
          )}
        >
          {/* The number becomes a tick, so an unsettled step can be found
              without reading anything. */}
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.span
                key="done"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              >
                <Check className="size-3" />
              </motion.span>
            ) : (
              <motion.span key="num" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {index}
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="text-ink-strong text-sm font-medium">{meta.title}</span>
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                done ? "bg-success" : step.state === "attention" ? "bg-warning" : "bg-danger",
              )}
            />
            <span className="text-ink-subtle min-w-0 flex-1 truncate text-xs">
              {step.subject === null ? step.headline : `${label(step.subject)} — ${step.headline}`}
            </span>
          </span>
          <span className="text-ink-subtle mt-0.5 block text-xs">{meta.about}</span>
        </span>
      </div>

      <Detail id={step.id} report={report} onRecheck={onRecheck} onChooseBackend={onChooseBackend} />
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
      <div className="border-hairline border-t">
        {report.dependencies.map((dep) => (
          <Row
            key={dep.id}
            name={label(dep.id)}
            // The command when there is one, so every amber row on this screen
            // shows what to run rather than only that something is wrong.
            detail={dep.found ? `${dep.version ?? "installed"} · ${dep.origin ?? ""}` : (dep.fix?.command ?? "not found")}
            ok={dep.found}
            fetchable={dep.found ? null : (FETCHABLE[dep.id] ?? null)}
            fix={dep.found ? null : dep.fix}
            onRecheck={onRecheck}
          />
        ))}
      </div>
    );
  }

  if (id === "speech") {
    return (
      <div className="border-hairline border-t">
        {report.asr.map((probe) => {
          const covers = [probe.forUrl ? "links" : null, probe.forFile ? "local files" : null].filter((k) => k !== null);
          const on = covers.length > 0;
          return (
            <Row
              key={probe.name}
              name={label(probe.name)}
              detail={on ? covers.join(" + ") : (probe.hint ?? "unavailable")}
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

  // The step says "This one is yours to choose", so the rows ARE the choosing.
  // An earlier draft left them read-only and sent people to Settings for the
  // one decision this screen exists to make.
  const live = report.backends.filter((b) => b.available).map((b) => b.id);
  const effective = live.find((x) => x === report.defaultBackendId) ?? live[0] ?? null;
  return (
    <div className="border-hairline border-t">
      {report.backends.map((b) => (
        <Row
          key={b.id}
          name={label(b.id)}
          detail={b.available ? (b.version ?? "connected") : (b.fix?.command ?? b.reason ?? "not available")}
          ok={b.available}
          fetchable={null}
          fix={b.available ? null : b.fix}
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
 * A verified download when there is one. Otherwise the command, on a button
 * that copies it — because the alternative is asking somebody to retype
 * `npm i -g @anthropic-ai/claude-code` from a screenshot. And a link to where
 * the thing comes from, for the cases where a command is not the whole story.
 */
function Row({
  name,
  detail,
  ok,
  fetchable,
  fix,
  href,
  onRecheck,
  logo,
  onChoose,
  chosen,
}: {
  name: string;
  detail: string;
  ok: boolean;
  fetchable: "whisper-model" | "yt-dlp" | null;
  fix: Fix | null;
  href?: string | undefined;
  onRecheck: () => void;
  logo?: string;
  onChoose?: () => void;
  chosen?: boolean;
}): JSX.Element {
  const shared = "border-hairline flex w-full items-center gap-3 border-b px-4 py-2 last:border-b-0";
  const body = (
    <>
      {logo !== undefined && <Mark id={logo} className="size-4 shrink-0" />}
      <span className="text-ink-strong w-32 shrink-0 truncate text-left text-[13px]">{name}</span>
      <span className={cn("size-1.5 shrink-0 rounded-full", ok ? "bg-success" : "bg-warning")} />
      <span className="text-ink-subtle min-w-0 flex-1 truncate text-left font-mono text-xs">{detail}</span>
      {chosen === true && <span className="text-ink-label shrink-0 text-xs">Default</span>}
    </>
  );

  const actions = (
    <>
      {fix !== null && <CopyCommand fix={fix} />}
      {href !== undefined && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-ink-subtle hover:text-ink-strong shrink-0 transition-colors"
          title={href}
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
      {fetchable !== null && <InstallButton what={fetchable} onDone={onRecheck} compact />}
    </>
  );

  return onChoose === undefined ? (
    <div className={shared}>
      {body}
      {actions}
    </div>
  ) : (
    <div className={cn(shared, chosen === true && "bg-elevated")}>
      <button onClick={onChoose} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {body}
      </button>
      {actions}
    </div>
  );
}

/**
 * The command, one click away from the clipboard.
 *
 * It says "Copy", not the fix's own verb. Labelling it "Install" — which is
 * what `fix.label` holds — promises an action this button does not perform:
 * you would press Install, nothing would install, and the row would still be
 * amber. The command itself stays visible on the line, so the button is a
 * convenience rather than the only way to see what to run.
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
        "flex h-6 shrink-0 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors",
        copied ? "bg-success-tint text-success-text" : "bg-tint text-ink-label hover:bg-fill hover:text-ink-strong",
      )}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
