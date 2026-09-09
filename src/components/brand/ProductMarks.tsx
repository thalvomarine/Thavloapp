/**
 * THALVO product icon family.
 *
 * Shared grammar:
 *   • 32×32 viewBox
 *   • Stroke weight ≈ 1.15 (round caps, round joins)
 *   • Palette: gold #FFB020 (signal/accent) · steel #8AA4C4 (structure)
 *     · navy #0A192F (fills) · translucent white ring
 *   • Every mark reads cleanly from 20px (nav) to 512px (splash).
 *
 * Never mix in generic lucide/emoji strokes here — this file is a brand
 * asset, not an icon pack.
 */

const GOLD = "#FFB020";
const STEEL = "#8AA4C4";
const NAVY = "#0A192F";
const RING = "rgba(255,255,255,0.55)";

interface MarkProps {
  size?: number;
  className?: string;
  glint?: boolean;
}

function Frame({
  size = 24,
  className,
  children,
}: MarkProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* ── RESCUE ───────────────────────────────────────────────
   Emergency beacon: horizon ring, radiating signal arcs,
   gold pulse at the center. Not a siren, not a cross. */
export function RescueMark(props: MarkProps) {
  return (
    <Frame {...props}>
      <circle cx="16" cy="16" r="13.25" stroke={RING} strokeWidth="1.15" opacity="0.9" />
      {/* Outer signal arcs (upper hemisphere) */}
      <path
        d="M6.5 12.5 A10.5 10.5 0 0 1 25.5 12.5"
        stroke={STEEL}
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.65"
      />
      <path
        d="M9 14 A7.5 7.5 0 0 1 23 14"
        stroke={STEEL}
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* Signal mast */}
      <line x1="16" y1="16" x2="16" y2="24.5" stroke={STEEL} strokeWidth="1.15" strokeLinecap="round" />
      {/* Base plate */}
      <line x1="11.5" y1="24.5" x2="20.5" y2="24.5" stroke={STEEL} strokeWidth="1.15" strokeLinecap="round" />
      {/* Gold pulse */}
      <circle cx="16" cy="16" r="2.6" fill={GOLD} />
      <circle cx="16" cy="16" r="4.4" stroke={GOLD} strokeWidth="1.15" opacity="0.55" />
    </Frame>
  );
}

/* ── PASSPORT ─────────────────────────────────────────────
   Vessel silhouette merged with an ID plate. */
export function PassportMark(props: MarkProps) {
  return (
    <Frame {...props}>
      {/* Document plate */}
      <rect
        x="5.75"
        y="4.5"
        width="20.5"
        height="23"
        rx="3"
        stroke={STEEL}
        strokeWidth="1.15"
      />
      {/* Vessel silhouette (hull + deck) */}
      <path
        d="M9.5 13 L16 8.5 L22.5 13 Z"
        fill={NAVY}
        stroke={STEEL}
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path
        d="M10 15.5 H22 L20.5 18.5 H11.5 Z"
        fill={GOLD}
        stroke={GOLD}
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      {/* Waterline + identity rows */}
      <line x1="9" y1="21.25" x2="23" y2="21.25" stroke={STEEL} strokeWidth="1.15" strokeLinecap="round" opacity="0.55" />
      <line x1="9" y1="23.75" x2="19" y2="23.75" stroke={STEEL} strokeWidth="1.15" strokeLinecap="round" opacity="0.4" />
    </Frame>
  );
}

/* ── TRUST ────────────────────────────────────────────────
   Guiding star inside a subtle sextant ring. Not a shield. */
export function TrustMark(props: MarkProps) {
  return (
    <Frame {...props}>
      <circle cx="16" cy="16" r="13.25" stroke={RING} strokeWidth="1.15" opacity="0.85" />
      {/* Sextant arc (lower) */}
      <path
        d="M6.5 20 A10 10 0 0 0 25.5 20"
        stroke={STEEL}
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* North-star — 4-point */}
      <path
        d="M16 5.5 L18.6 15 L28 16 L18.6 17 L16 26.5 L13.4 17 L4 16 L13.4 15 Z"
        fill={GOLD}
      />
      {/* Inner pivot */}
      <circle cx="16" cy="16" r="1.2" fill={NAVY} stroke={GOLD} strokeWidth="0.9" />
    </Frame>
  );
}

/* ── MARKETPLACE ──────────────────────────────────────────
   Marine cargo container: corrugated plate with strap. */
export function MarketplaceMark(props: MarkProps) {
  return (
    <Frame {...props}>
      {/* Container body */}
      <rect
        x="4.5"
        y="9"
        width="23"
        height="15"
        rx="2"
        stroke={STEEL}
        strokeWidth="1.15"
      />
      {/* Corrugation ribs */}
      <g stroke={STEEL} strokeWidth="1.15" strokeLinecap="round" opacity="0.55">
        <line x1="9" y1="12" x2="9" y2="21" />
        <line x1="12.5" y1="12" x2="12.5" y2="21" />
        <line x1="19.5" y1="12" x2="19.5" y2="21" />
        <line x1="23" y1="12" x2="23" y2="21" />
      </g>
      {/* Gold shipping strap */}
      <line x1="4.5" y1="15.5" x2="27.5" y2="15.5" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" />
      {/* Lift hooks */}
      <path d="M10.5 9 V6.5 H14" stroke={STEEL} strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21.5 9 V6.5 H18" stroke={STEEL} strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
      {/* Waterline */}
      <line x1="4" y1="26.25" x2="28" y2="26.25" stroke={RING} strokeWidth="1.15" strokeLinecap="round" opacity="0.4" />
    </Frame>
  );
}

/* ── CONTROL TOWER ────────────────────────────────────────
   Harbor operations tower with radar dome + signal arcs. */
export function ControlTowerMark(props: MarkProps) {
  const { glint } = props;
  return (
    <Frame {...props}>
      {/* Ground line */}
      <line x1="3.5" y1="27.5" x2="28.5" y2="27.5" stroke={STEEL} strokeWidth="1.15" strokeLinecap="round" opacity="0.6" />
      {/* Tower base */}
      <path
        d="M11 27.5 L13 15 H19 L21 27.5 Z"
        stroke={STEEL}
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      {/* Cabin */}
      <rect
        x="11"
        y="10.5"
        width="10"
        height="5"
        rx="1"
        stroke={STEEL}
        strokeWidth="1.15"
      />
      {/* Radar dome (gold) */}
      <path d="M13 10.5 A3 3 0 0 1 19 10.5" fill={GOLD} />
      {/* Antenna */}
      <line x1="16" y1="7.5" x2="16" y2="5" stroke={GOLD} strokeWidth="1.15" strokeLinecap="round" />
      <circle cx="16" cy="4.5" r="0.9" fill={GOLD}>
        {glint && <animate attributeName="opacity" values="0.4;1;0.4" dur="2.2s" repeatCount="indefinite" />}
      </circle>
      {/* Signal arcs */}
      <path d="M7 6 A10 10 0 0 1 16 2" stroke={GOLD} strokeWidth="1.15" strokeLinecap="round" opacity="0.55" />
      <path d="M25 6 A10 10 0 0 0 16 2" stroke={GOLD} strokeWidth="1.15" strokeLinecap="round" opacity="0.55" />
    </Frame>
  );
}

/* ── ATLAS ────────────────────────────────────────────────
   Marine chart plate with isobath + waypoint. */
export function AtlasMark(props: MarkProps) {
  return (
    <Frame {...props}>
      {/* Chart plate */}
      <path
        d="M5 7 L12 5.5 L20 8 L27 6 V25 L20 27 L12 24.5 L5 26 Z"
        stroke={STEEL}
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      {/* Fold creases */}
      <line x1="12" y1="5.5" x2="12" y2="24.5" stroke={STEEL} strokeWidth="1.15" strokeLinecap="round" opacity="0.5" />
      <line x1="20" y1="8" x2="20" y2="27" stroke={STEEL} strokeWidth="1.15" strokeLinecap="round" opacity="0.5" />
      {/* Isobath / current curve */}
      <path
        d="M7 20 Q11 17 15 19 T25 18"
        stroke={STEEL}
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M7 23 Q11 20 15 22 T25 21"
        stroke={STEEL}
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.35"
      />
      {/* Gold waypoint */}
      <path
        d="M16.5 10 L19 15.5 L16.5 14.25 L14 15.5 Z"
        fill={GOLD}
      />
    </Frame>
  );
}
