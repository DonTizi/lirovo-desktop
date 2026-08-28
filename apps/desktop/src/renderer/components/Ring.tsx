export type Tone = "governed" | "partial" | "ready" | "brand";

/**
 * Tokens, not hex.
 *
 * These were five fixed colours. Three of them were semantic — a green, an
 * amber, a blue that the palette already names — and two were light greys that
 * simply vanish on a dark canvas: a track the colour of a light background is
 * invisible against a dark one, so the ring would have read as complete at
 * every value.
 */
const TONE_COLOR: Record<Tone, string> = {
  governed: "var(--kumo-success)",
  partial: "var(--kumo-warning)",
  // `ready` is the neutral filled arc, so it has to be readable against the
  // track and not the same token as it.
  ready: "var(--kumo-text-subtle)",
  brand: "var(--kumo-brand)",
};

/** The unfilled part. A surface tone, so it stays a track in either palette. */
const TRACK = "var(--kumo-fill)";

/** A thin circular progress ring with optional centered content. */
export function Ring({
  value,
  size = 40,
  stroke = 4,
  tone = "brand",
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  tone?: Tone;
  children?: React.ReactNode;
}): JSX.Element {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, value)));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_COLOR[tone]}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 240ms cubic-bezier(.2,0,0,1)" }}
        />
      </svg>
      {children !== undefined && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
