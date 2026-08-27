import { motion } from "framer-motion";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { useRef } from "react";
import { useScrollMask } from "../lib/useScrollMask";
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

/** Column counters are shortened the way an account home does it: 20, 3,3 k. */
const compact = new Intl.NumberFormat("fr-CA", { notation: "compact" });

export type ListEntry = {
  id: string;
  label: string;
  hint?: string;
  meta?: string;
  /**
   * `className?: string | undefined` rather than `className?: string`.
   *
   * Under exactOptionalPropertyTypes the two are different types, and lucide's
   * icons declare the former — so the narrower spelling rejects every icon in
   * the library.
   */
  icon?: React.ComponentType<{ className?: string | undefined }>;
};

/**
 * One of the account-home columns: quiet header, hairline-separated rows.
 *
 * The gradient mask is dynamic rather than always on. A permanent fade at both
 * ends implies there is more above and below even when the list is three items
 * long, so it is applied only on the edge that actually has more content.
 */
export function ListColumn({
  title,
  count,
  entries,
  empty,
  delay = 0,
  onSelect,
  onTitle,
}: {
  title: string;
  count?: number;
  entries: ListEntry[];
  empty: string;
  delay?: number;
  /** Open one row. Rows are inert when absent, as in the reference. */
  onSelect?: (id: string) => void;
  /** Follow the column header through to its own section. */
  onTitle?: () => void;
}): JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);
  const { maskImage, onScroll } = useScrollMask(listRef, [entries.length]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: [0, 0, 0.2, 1] }}
    >
      <header className="flex items-center gap-2 px-1 pb-1">
        <button
          type="button"
          onClick={onTitle}
          className="text-ink-subtle hover:text-ink flex items-center gap-1 transition-colors"
        >
          {title}
          <ChevronRight className="size-3.5" />
        </button>
        {count !== undefined ? (
          <span className="bg-tint text-ink-label rounded-full px-2 text-xs">{compact.format(count)}</span>
        ) : null}
        <button
          type="button"
          aria-label={`More ${title.toLowerCase()} options`}
          className="text-ink-subtle hover:text-ink ml-auto transition-colors"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </header>

      {entries.length === 0 ? (
        <p className="border-hairline text-ink-subtle border-t px-1 py-3">{empty}</p>
      ) : (
        <ul
          ref={listRef}
          tabIndex={0}
          aria-label={`${title} list`}
          onScroll={onScroll}
          style={maskImage !== undefined ? { WebkitMaskImage: maskImage, maskImage } : undefined}
          className="scrollbar-hide max-h-80 overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kumo-focus)]"
        >
          {entries.map((entry) => {
            const Icon = entry.icon;
            return (
              <li key={entry.id} className="h-16">
                <button
                  type="button"
                  onClick={onSelect === undefined ? undefined : () => onSelect(entry.id)}
                  className="border-hairline hover:bg-elevated group flex h-full w-full items-center gap-2.5 border-t px-1 py-2 text-left transition-colors"
                >
                  {Icon !== undefined ? <Icon className="text-ink-subtle size-4 shrink-0" /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="text-ink-strong block truncate group-hover:underline">{entry.label}</span>
                    {entry.hint !== undefined ? (
                      <span className="text-ink-subtle block truncate text-xs">{entry.hint}</span>
                    ) : null}
                  </span>
                  {entry.meta !== undefined ? (
                    <span className="text-ink-subtle shrink-0 text-xs">{entry.meta}</span>
                  ) : null}
                  <ChevronRight className="text-ink-subtle size-4 shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </motion.section>
  );
}
