import piriUrl from "@/assets/thalvo-piri-chart-bg.jpg";

/**
 * THALVO-exclusive hero atmosphere inspired by Piri Reis portolan charts.
 * Decorative only — invented coastlines and rhumb geometry; not a navigational chart.
 */
export function PiriChartBackdrop({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
    >
      <img
        src={piriUrl}
        alt=""
        className="landing-hero-img absolute inset-0 size-full object-cover object-center"
      />
      {/* Keep headlines readable without flattening the chart */}
      <div className="absolute inset-0 bg-[#06101c]/42" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#06101c]/75 via-transparent to-[#06101c]/92" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#06101c]/35 via-transparent to-[#06101c]/25" />

      {/* Sharp vector rhumb + rose layer (THALVO ink) */}
      <svg
        className="absolute inset-0 size-full opacity-[0.55]"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <radialGradient id="piri-rose" cx="78%" cy="72%" r="42%">
            <stop offset="0%" stopColor="#F5B942" stopOpacity="0.28" />
            <stop offset="55%" stopColor="#C9A227" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#00F0FF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#piri-rose)" />

        {/* Rhumb rays from a portolan rose (lower-right) */}
        <g
          stroke="#D4AF37"
          strokeOpacity="0.22"
          strokeWidth="0.9"
          fill="none"
          transform="translate(1240 640)"
        >
          {Array.from({ length: 32 }, (_, i) => {
            const a = (i * Math.PI) / 16;
            const x2 = Math.cos(a) * 520;
            const y2 = Math.sin(a) * 520;
            return <line key={i} x1="0" y1="0" x2={x2} y2={y2} />;
          })}
          <circle r="56" stroke="#F5B942" strokeOpacity="0.35" />
          <circle r="34" stroke="#00F0FF" strokeOpacity="0.18" />
          <circle r="8" fill="#F5B942" fillOpacity="0.35" stroke="none" />
          {/* 8-point rose tips */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <path
              key={deg}
              d="M0 -58 L6 -28 L0 -34 L-6 -28 Z"
              fill="#F5B942"
              fillOpacity="0.28"
              transform={`rotate(${deg})`}
              stroke="none"
            />
          ))}
        </g>

        {/* Secondary rose — upper left, quieter */}
        <g
          stroke="#00F0FF"
          strokeOpacity="0.12"
          strokeWidth="0.7"
          fill="none"
          transform="translate(220 200)"
        >
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i * Math.PI) / 8;
            return (
              <line key={i} x1="0" y1="0" x2={Math.cos(a) * 280} y2={Math.sin(a) * 280} />
            );
          })}
          <circle r="28" stroke="#D4AF37" strokeOpacity="0.2" />
        </g>
      </svg>
    </div>
  );
}
