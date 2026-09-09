interface Props {
  size?: number;
  className?: string;
  /** Primary needle color (north). Defaults to THALVO gold. */
  north?: string;
  /** Secondary needle color (south). Defaults to soft steel. */
  south?: string;
  /** Ring color. */
  ring?: string;
  /** Whether the top star glints (used when a recommendation is available). */
  glint?: boolean;
}

/**
 * THALVO Compass — brand mark.
 * A geometric north-star needle set inside a thin horizon ring.
 * Not a chatbot. Not a generic compass. A guidance instrument.
 *
 * Reads cleanly from 20px (nav) to 512px (splash).
 */
export function CompassMark({
  size = 24,
  className,
  north = "#FFB020",
  south = "#8AA4C4",
  ring = "rgba(255,255,255,0.55)",
  glint = false,
}: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="none"
      aria-hidden="true"
    >
      {/* Outer horizon ring */}
      <circle cx="16" cy="16" r="13.25" stroke={ring} strokeWidth="1.15" opacity="0.9" />
      {/* Cardinal ticks */}
      <g stroke={ring} strokeWidth="1.15" strokeLinecap="round" opacity="0.7">
        <line x1="16" y1="1.75" x2="16" y2="3.75" />
        <line x1="16" y1="28.25" x2="16" y2="30.25" />
        <line x1="1.75" y1="16" x2="3.75" y2="16" />
        <line x1="28.25" y1="16" x2="30.25" y2="16" />
      </g>
      {/* Horizon line — the sea */}
      <line
        x1="5.5"
        y1="16"
        x2="26.5"
        y2="16"
        stroke={ring}
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.35"
      />
      {/* South blade (dim) */}
      <path d="M16 16 L12.6 18 L16 27 L19.4 18 Z" fill={south} opacity="0.55" />
      {/* North blade (star) — the guiding point */}
      <path d="M16 16 L12.6 14 L16 5 L19.4 14 Z" fill={north} />
      {/* Pivot */}
      <circle cx="16" cy="16" r="1.1" fill="#0A192F" stroke={north} strokeWidth="0.9" />
      {glint && (
        <circle cx="16" cy="5" r="1.6" fill={north} opacity="0.9">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2.2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}
