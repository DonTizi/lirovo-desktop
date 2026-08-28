import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, RefreshCw } from "lucide-react";
import { canExtract, onboardingSteps, type OnboardingStep, type StepId } from "@lirovo/core";
import { InstallButton } from "./system/install-button";
import { Mark } from "./logos";
import { cn } from "../lib/cn";
import { DOT, FETCHABLE, label, type SystemReport } from "../lib/system-vocabulary";

/**
 * The three things a first launch still has to settle.
 *
 * Not a separate window and not a modal: the same shell, the same type, the
 * same rows as the Settings page — because every one of these lines is the
 * same fact, read from the same doctor report. Somebody who finishes this
 * screen and then opens Settings should recognise what they are looking at,
 * not meet a second vocabulary for the same machine.
 *
 * All three steps are visible at once rather than one at a time. There are
 * only three, they are all short, and a wizard that hides two of them turns a
 * page someone could read in ten seconds into three clicks — while making it
 * impossible to see that the one you cannot fix is the third one.
 */

const TITLES: Record<StepId, { title: string; about: string }> = {
  tools: { title: "Tools", about: "Reading video, pulling frames, downloading links." },
  speech: { title: "Speech", about: "Turning what is said into text this app can point back at." },
  model: { title: "Model", about: "Reading the frames and building the graph. This one is yours to choose." },
};

export function Onboarding({
  report,
  onRecheck,
  onDone,
  checking,
}: {
  report: SystemReport;
  onRecheck: () => void;
  onDone: () => void;
  checking: boolean;
}): JSX.Element {
  const steps = onboardingSteps({
    dependencies: report.dependencies,
    asr: report.asr,
    backends: report.backends,
    defaultBackendId: report.defaultBackendId,
  });
  const ready = canExtract(steps);

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="text-ink-strong text-3xl font-semibold tracking-tight">Before the first video</h1>
        <p className="text-ink-subtle mt-2 text-sm">
          Three things decide what this Mac can do. Two are already settled.
        </p>
      </header>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <Step key={step.id} step={step} index={i + 1} report={report} onRecheck={onRecheck} />
        ))}
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={onDone}
          disabled={!ready}
          className={cn(
            "liq-solid liq-solid-brand flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-medium",
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

        {/* Skippable, and deliberately so. Somebody who knows they are about to
            start Ollama should not be held on this screen by a check that is
            about to be true. What it cannot do is pretend the machine is
            ready — the button above stays dead until it is. */}
        {!ready && (
          <button onClick={onDone} className="text-ink-subtle hover:text-ink ml-auto text-xs transition-colors">
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

function Step({
  step,
  index,
  report,
  onRecheck,
}: {
  step: OnboardingStep;
  index: number;
  report: SystemReport;
  onRecheck: () => void;
}): JSX.Element {
  const meta = TITLES[step.id];
  return (
    <section className="border-hairline bg-base overflow-hidden rounded-xl border">
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-medium",
            step.state === "done" ? "bg-success text-white" : "bg-fill text-ink-label",
          )}
        >
          {step.state === "done" ? <Check className="size-3" /> : index}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="text-ink-strong text-sm font-medium">{meta.title}</span>
            <span className={cn("size-1.5 shrink-0 rounded-full", DOT[step.state === "done" ? "ok" : step.state === "attention" ? "warn" : "off"])} />
            <span className="text-ink-subtle min-w-0 flex-1 truncate text-xs">
              {step.subject === null ? step.headline : `${label(step.subject)} — ${step.headline}`}
            </span>
          </span>
          <span className="text-ink-subtle mt-0.5 block text-xs">{meta.about}</span>
        </span>
      </div>

      <Detail id={step.id} report={report} onRecheck={onRecheck} />
    </section>
  );
}

/**
 * The rows behind the headline.
 *
 * Every one comes from the doctor report, so this cannot say something the
 * Settings page would contradict.
 */
function Detail({
  id,
  report,
  onRecheck,
}: {
  id: StepId;
  report: SystemReport;
  onRecheck: () => void;
}): JSX.Element | null {
  if (id === "tools") {
    return (
      <div className="border-hairline border-t">
        {report.dependencies.map((dep) => (
          <Row
            key={dep.id}
            name={label(dep.id)}
            detail={dep.found ? `${dep.version ?? "installed"} · ${dep.origin ?? ""}` : (dep.fix?.command ?? "not found")}
            ok={dep.found}
            fetchable={dep.found ? null : (FETCHABLE[dep.id] ?? null)}
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
          return (
            <Row
              key={probe.name}
              name={label(probe.name)}
              detail={covers.length > 0 ? covers.join(" + ") : (probe.hint ?? "unavailable")}
              ok={covers.length > 0}
              fetchable={covers.length === 0 ? (FETCHABLE[probe.name] ?? null) : null}
              onRecheck={onRecheck}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="border-hairline border-t">
      {report.backends.map((b) => (
        <Row
          key={b.id}
          name={label(b.id)}
          detail={b.available ? (b.version ?? "connected") : (b.fix?.command ?? b.reason ?? "not available")}
          ok={b.available}
          fetchable={null}
          onRecheck={onRecheck}
          logo={b.id}
        />
      ))}
    </div>
  );
}

function Row({
  name,
  detail,
  ok,
  fetchable,
  onRecheck,
  logo,
}: {
  name: string;
  detail: string;
  ok: boolean;
  fetchable: "whisper-model" | "yt-dlp" | null;
  onRecheck: () => void;
  logo?: string;
}): JSX.Element {
  return (
    <div className="border-hairline flex items-center gap-3 border-b px-4 py-2 last:border-b-0">
      {logo !== undefined && <Mark id={logo} className="size-4 shrink-0" />}
      <span className="text-ink-strong w-32 shrink-0 truncate text-[13px]">{name}</span>
      <span className={cn("size-1.5 shrink-0 rounded-full", ok ? "bg-success" : "bg-warning")} />
      <span className="text-ink-subtle min-w-0 flex-1 truncate font-mono text-xs">{detail}</span>
      {fetchable !== null && <InstallButton what={fetchable} onDone={onRecheck} compact />}
    </div>
  );
}
