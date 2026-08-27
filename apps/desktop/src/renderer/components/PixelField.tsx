/**
 * The pixel field flanking the drop zone.
 *
 * A fine engineered grid of 2px squares running from the card out to the window
 * edge, crossed by a slow band of light. Decoration only: `aria-hidden`,
 * `pointer-events-none`.
 *
 * Deliberately NOT a grid of animated elements. Drawing it with repeating
 * gradients and a mask means:
 *   - zero DOM nodes per square, so it costs nothing to render or animate;
 *   - it is responsive by construction — the grid fills whatever gap the window
 *     leaves between the card and its edge, at any width, with no measuring;
 *   - one band animates instead of hundreds of independent blinks, which is the
 *     difference between a texture and a christmas tree.
 *
 * Restraint is the whole design. The squares are 2px on a 9px pitch, the blue is
 * pulled well off the brand toward steel, nothing scales or bounces, and the
 * band takes fourteen seconds to cross — ambient, not asking to be watched.
 *
 * The band travels VERTICALLY on purpose. A horizontal sweep would have to cross
 * a gap whose width depends entirely on the window, so it would race on a narrow
 * one and crawl on a wide one; the height is the card's, which is stable.
 */

const CELL = 2; // square size in px
const PITCH = 9; // distance between square origins

const COLS = `repeating-linear-gradient(90deg, #000 0 ${CELL}px, transparent ${CELL}px ${PITCH}px)`;
const ROWS = `repeating-linear-gradient(180deg, #000 0 ${CELL}px, transparent ${CELL}px ${PITCH}px)`;

/** Columns ∩ rows = a grid of squares, painted by whatever sits underneath. */
const SQUARES = {
  WebkitMaskImage: `${COLS}, ${ROWS}`,
  WebkitMaskComposite: 'source-in',
  maskImage: `${COLS}, ${ROWS}`,
  maskComposite: 'intersect',
} as const;

/** Steel, not brand blue. The brand's chroma reads as a toy at this density. */
const STEEL = 'oklch(55% 0.07 255)';

export function PixelField({ side }: { side: 'left' | 'right' }) {
  const inward = side === 'left' ? 'to left' : 'to right';

  // Fades in ABSOLUTE units, never percentages: the element is a viewport wide
  // while only its last few hundred px are ever on screen, so a percentage ramp
  // would be measured against the wrong box and the grid would all but vanish
  // exactly where it is meant to be seen.
  //
  // The inward ramp has two stops rather than one. A single stop gives a flat
  // sheet of dots that reads as wallpaper; carrying the ramp on to 340px lets
  // the texture keep gaining depth all the way out to the window edge on a wide
  // window, while the 60% at 150px keeps it present on a narrow one.
  const fade = [
    `linear-gradient(${inward}, transparent 0, rgba(0,0,0,0.6) 150px, #000 340px)`,
    'linear-gradient(180deg, transparent 0, #000 76px, #000 calc(100% - 76px), transparent 100%)',
  ].join(', ');

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -inset-y-10 hidden w-screen overflow-hidden lg:block ${
        side === 'left' ? 'right-full' : 'left-full'
      }`}
      style={{
        WebkitMaskImage: fade,
        WebkitMaskComposite: 'source-in',
        maskImage: fade,
        maskComposite: 'intersect',
      }}
    >
      {/* The grid at rest: the texture that is there whether anything moves or not. */}
      <div className="absolute inset-0 opacity-20" style={{ ...SQUARES, backgroundColor: STEEL }} />

      {/* The band, lighting the same squares as it passes. Its own container
          carries the square mask so the band itself stays a plain gradient. */}
      <div className="absolute inset-0" style={SQUARES}>
        <div
          className="liq-sweep absolute inset-x-0 h-2/5"
          style={{
            backgroundImage: `linear-gradient(180deg, transparent 0%, ${STEEL} 50%, transparent 100%)`,
            // Half a period apart, so the two sides never pulse in unison.
            animationDelay: side === 'left' ? '0s' : '-7s',
          }}
        />
      </div>
    </div>
  );
}
