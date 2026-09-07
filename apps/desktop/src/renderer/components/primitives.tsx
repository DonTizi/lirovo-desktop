import { cn } from "../lib/cn";

/** A card: a hairline ring, no border, no soft shadow. */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className={cn("bg-base shadow-ring rounded-lg", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="border-hairline flex items-center justify-between gap-4 border-b px-4 py-3">
      <h2 className="text-ink-strong font-semibold">{title}</h2>
      {action !== undefined ? (
        <div className="text-ink-subtle text-xs">{action}</div>
      ) : null}
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
 * A shape where content will be, at the size the content will be.
 *
 * Not a spinner: a spinner says "wait" and nothing else, while a block that
 * matches the coming layout means the page does not jump when it arrives, and
 * the reader can already tell what is loading.
 */
export function Skeleton({ className }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn("bg-fill animate-pulse rounded", className)}
      aria-hidden
    />
  );
}

/** A state the way an account home prints one: quiet uppercase, never tinted. */
export function StateLabel({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <span className="text-ink-subtle whitespace-nowrap text-xs uppercase">
      {children}
    </span>
  );
}

/** An inline code chip, for a path or an anchor. */
export function Mono({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <code
      className={cn(
        "bg-recessed text-ink-label rounded px-1 py-0.5 font-mono text-xs",
        className,
      )}
    >
      {children}
    </code>
  );
}
