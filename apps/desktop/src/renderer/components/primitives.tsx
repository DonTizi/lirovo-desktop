import { cn } from "../lib/cn";

/** A card: a hairline ring, no border, no soft shadow. */
export function Card({ className, children }: { className?: string; children: React.ReactNode }): JSX.Element {
  return <section className={cn("bg-base shadow-ring rounded-lg", className)}>{children}</section>;
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }): JSX.Element {
  return (
    <div className="border-hairline flex items-center justify-between gap-4 border-b px-4 py-3">
      <h2 className="text-ink-strong font-semibold">{title}</h2>
      {action !== undefined ? <div className="text-ink-subtle text-xs">{action}</div> : null}
    </div>
  );
}

const toneClasses = {
  neutral: "bg-tint text-ink-label",
  info: "bg-info-tint text-info-text",
  success: "bg-success-tint text-success-text",
  warning: "bg-warning-tint text-warning-text",
  danger: "bg-danger-tint text-danger-text",
} as const;

export type Tone = keyof typeof toneClasses;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Quiet label, oversized neutral figure, nothing else.
 *
 * Figures stay neutral on purpose: state is carried by badges, never by
 * colouring the number, so a row of tiles does not turn into a traffic light.
 */
export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }): JSX.Element {
  return (
    <div className="bg-base shadow-ring rounded-lg px-4 py-3">
      <p className="text-ink-label">{label}</p>
      <p className="text-ink-strong mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint !== undefined ? <p className="text-ink-subtle mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}

/** A state the way an account home prints one: quiet uppercase, never tinted. */
export function StateLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return <span className="text-ink-subtle whitespace-nowrap text-xs uppercase">{children}</span>;
}

/** An inline code chip, for a path or an anchor. */
export function Mono({ children, className }: { children: React.ReactNode; className?: string }): JSX.Element {
  return (
    <code className={cn("bg-recessed text-ink-label rounded px-1 py-0.5 font-mono text-xs", className)}>{children}</code>
  );
}
