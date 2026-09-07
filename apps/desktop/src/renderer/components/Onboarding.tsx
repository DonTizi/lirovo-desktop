import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useId, useState } from "react";
import type { Fix } from "@lirovo/contracts";
import {
  canExtract,
  onboardingSteps,
  recommendBackend,
  type OnboardingStep,
  type StepId,
} from "@lirovo/core";
import { InstallButton } from "./system/install-button";
import { FixButton } from "./system/fix-button";
import { LirovoMark } from "./LirovoMark";
import { Mark } from "./logos";
import { cn } from "../lib/cn";
import { FETCHABLE, label, type SystemReport } from "../lib/system-vocabulary";
import "./onboarding.css";

const TITLES: Record<StepId, { title: string; about: string }> = {
  tools: {
    title: "Bring your videos",
    about: "Tools for opening videos, reading frames, and importing links.",
  },
  speech: {
    title: "Capture every word",
    about:
      "Use published subtitles, or a speech model to transcribe your recordings.",
  },
  model: {
    title: "Choose your intelligence",
    about:
      "Choose the model that reads your video and connects the ideas. You can change it in Settings.",
  },
};

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
  const reduced = useReducedMotion();
  const steps = onboardingSteps(report);
  const ready = canExtract(steps);
  const blocked = steps.filter((s) => s.state === "blocked").length;
  const optional = steps.some((s) => s.state === "attention");
  const arrive = (delay: number) => ({
    initial: reduced ? (false as const) : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.35, delay: reduced ? 0 : delay },
  });
  return (
    <div className="onboarding">
      <motion.header {...arrive(0)} className="onboarding-welcome">
        <LirovoMark className="onboarding-mark" />
        <p className="onboarding-eyebrow">YOUR WORKSPACE, READY FOR IDEAS</p>
        <h1>Welcome to Lirovo</h1>
        <p className="onboarding-intro">
          Turn videos into knowledge you can explore.
          <br />
          Find the ideas, with their sources a click away.
        </p>
      </motion.header>
      <motion.div {...arrive(0.08)} className="onboarding-setup">
        <div className="onboarding-setup-heading">
          <h2>Make it yours</h2>
          <span role="status" className="onboarding-readiness">
            <span
              className="onboarding-status-dot"
              data-state={ready ? "done" : "blocked"}
              aria-hidden="true"
            />
            {checking
              ? "Checking your setup…"
              : ready
                ? optional
                  ? "Ready · optional improvements below"
                  : "Ready for your first video"
                : `${blocked} ${blocked === 1 ? "step needs" : "steps need"} your attention`}
          </span>
        </div>
        <div className="onboarding-steps">
          {steps.map((step, i) => (
            <Step
              key={step.id}
              step={step}
              index={i + 1}
              report={report}
              onRecheck={onRecheck}
              onChooseBackend={onChooseBackend}
            />
          ))}
        </div>
        <div className="onboarding-footer">
          <p>
            {ready
              ? "You’re all set. Your first extraction starts with a link or a video."
              : "Finish the required steps, or explore the workspace and set up later."}
          </p>
          <div className="onboarding-actions">
            <button
              onClick={onRecheck}
              disabled={checking}
              className="onboarding-recheck"
            >
              <RefreshCw
                className={cn(
                  "size-3.5",
                  checking && !reduced && "animate-spin",
                )}
                aria-hidden="true"
              />
              {checking ? "Checking…" : "Check again"}
            </button>
            <div className="onboarding-continue-actions">
              {!ready && (
                <button onClick={onDone} className="onboarding-skip">
                  Set up later
                </button>
              )}
              <button
                onClick={onDone}
                disabled={!ready}
                className="onboarding-continue"
              >
                Open workspace{" "}
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
      <motion.p {...arrive(0.16)} className="onboarding-privacy">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        Your library stays on this device. Processing follows your chosen
        provider.
      </motion.p>
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
  const reduced = useReducedMotion();
  const panelId = useId();
  // Default to the work still needed; a user's disclosure choice survives rechecks.
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const open = expanded ?? step.state !== "done";
  const meta = TITLES[step.id];
  return (
    <section className="onboarding-step" data-open={open}>
      <h3>
        <button
          className="onboarding-step-toggle"
          onClick={() => setExpanded(!open)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <span className="onboarding-step-number" aria-hidden="true">
            0{index}
          </span>
          <span className="onboarding-step-copy">
            <span className="onboarding-step-title">{meta.title}</span>
            <span className="onboarding-step-summary">
              {step.subject === null
                ? step.headline
                : `${label(step.subject)} — ${step.headline}`}
            </span>
          </span>
          <span className="onboarding-step-state" data-state={step.state}>
            {step.state === "done"
              ? "Ready"
              : step.state === "attention"
                ? "Optional"
                : "Setup needed"}
          </span>
          <ChevronDown className="onboarding-chevron" aria-hidden="true" />
        </button>
      </h3>
      <div id={panelId}>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              className="onboarding-detail"
            >
              <p className="onboarding-about">{meta.about}</p>
              <Detail
                id={step.id}
                report={report}
                onRecheck={onRecheck}
                onChooseBackend={onChooseBackend}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
      <div className="onboarding-options">
        {report.dependencies.map((dep) => (
          <Row
            key={dep.id}
            name={label(dep.id)}
            detail={
              dep.found
                ? [dep.version ?? "Installed", dep.origin]
                    .filter(Boolean)
                    .join(" · ")
                : (dep.fix?.command ?? "Not found")
            }
            mono={!dep.found && dep.fix !== null}
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
      <div className="onboarding-options">
        {report.asr.map((probe) => {
          const covers = [
            probe.forUrl ? "links" : null,
            probe.forFile ? "local files" : null,
          ].filter((k) => k !== null);
          const on = covers.length > 0;
          return (
            <Row
              key={probe.name}
              name={label(probe.name)}
              detail={on ? covers.join(" + ") : (probe.hint ?? "Unavailable")}
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
  const effective = recommendBackend(
    report.backends,
    report.defaultBackendId,
  ).id;
  return (
    <div className="onboarding-options">
      {report.backends.map((b) => (
        <Row
          key={b.id}
          name={label(b.id)}
          detail={
            b.available
              ? (b.version ?? "Connected")
              : (b.fix?.command ?? b.reason ?? "Not available")
          }
          mono={!b.available && b.fix !== null}
          ok={b.available}
          fetchable={null}
          fix={b.available ? null : b.fix}
          fixId={b.id}
          href={b.available ? undefined : HOMEPAGES[b.id]}
          onRecheck={onRecheck}
          logo={b.id}
          {...(b.available
            ? {
                onChoose: () => onChooseBackend(b.id),
                chosen: b.id === effective,
              }
            : {})}
        />
      ))}
    </div>
  );
}

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
        <span
          className="onboarding-status-dot"
          data-state={ok ? "done" : "blocked"}
          aria-hidden="true"
        />
      )}
      <span className="onboarding-option-copy">
        <span className="onboarding-option-name">{name}</span>
        <span className={cn("onboarding-option-detail", mono && "font-mono")}>
          {detail}
        </span>
      </span>
      {chosen === true && <span className="onboarding-selected">Selected</span>}
    </>
  );
  return (
    <div className="onboarding-option" data-selected={chosen === true}>
      {onChoose ? (
        <button
          onClick={onChoose}
          aria-pressed={chosen === true}
          className="onboarding-option-select"
        >
          {body}
        </button>
      ) : (
        <div className="onboarding-option-body">{body}</div>
      )}
      {(fix !== null || href !== undefined || fetchable !== null) && (
        <div className="onboarding-option-actions">
          {fetchable === null && fix !== null && fixId !== undefined && (
            <FixButton
              fixId={fixId}
              label={fix.label}
              command={fix.command}
              onDone={onRecheck}
            />
          )}
          {href !== undefined && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${name} setup website`}
              className="onboarding-website"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
          {fetchable !== null && (
            <InstallButton what={fetchable} onDone={onRecheck} />
          )}
        </div>
      )}
    </div>
  );
}
