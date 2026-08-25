export type Tone = "governed" | "partial" | "ready" | "brand";

const TONE_COLOR: Record<Tone, string> = {
  governed: "#16865B",
  partial: "#A66616",
  ready: "#CBD5E1",
  brand: "#2563EB",
};

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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E9F0" strokeWidth={stroke} />
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
