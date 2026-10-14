/**
 * AuthPassageBackdrop — cold-night passage for /auth.
 *
 * Motifs (decorative only, no real chart / place / live data):
 *   Piri Reis portolan echo · seyir ışıkları · deniz feneri · dalga · yıldız
 * Pure CSS + SVG. Respects prefers-reduced-motion.
 */

const CSS = `
.ap-root{position:absolute;inset:0;overflow:hidden;contain:strict;background:#000}
.ap-layer{position:absolute;inset:0;pointer-events:none}
.ap-sky{
  background:
    radial-gradient(70% 55% at 50% 120%, rgba(12,48,78,.55), transparent 58%),
    linear-gradient(180deg,#000 0%,#040912 42%,#0a1624 68%,#02060c 100%);
}
.ap-piri{
  opacity:.22;
  background:
    radial-gradient(45% 35% at 22% 30%, rgba(217,184,106,.14), transparent 70%),
    radial-gradient(40% 30% at 78% 55%, rgba(125,211,252,.08), transparent 72%);
  animation:ap-drift 72s ease-in-out infinite alternate;
}
.ap-beam{
  transform-origin:18% 58%;
  background:conic-gradient(from 210deg at 18% 58%, transparent 0deg, rgba(245,185,66,.11) 14deg, transparent 36deg);
  animation:ap-sweep 28s linear infinite;
}
.ap-star{animation:ap-twinkle 4.8s ease-in-out infinite}
.ap-star2{animation-duration:6.2s;animation-delay:-1.8s}
.ap-star3{animation-duration:5.4s;animation-delay:-3.1s}
.ap-nav{animation:ap-nav 5.5s ease-in-out infinite}
.ap-nav2{animation-duration:6.8s;animation-delay:-2.4s}
.ap-wave{animation:ap-swell 10s ease-in-out infinite}
@keyframes ap-drift{from{transform:translate3d(-1%,0,0)}to{transform:translate3d(1.2%,.6%,0)}}
@keyframes ap-sweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes ap-twinkle{0%,100%{opacity:.25}50%{opacity:.95}}
@keyframes ap-nav{0%,100%{opacity:.35}50%{opacity:.95}}
@keyframes ap-swell{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-3px,0)}}
@media (prefers-reduced-motion: reduce){
  .ap-piri,.ap-beam,.ap-star,.ap-star2,.ap-star3,.ap-nav,.ap-nav2,.ap-wave{animation:none!important}
}
`;

export function AuthPassageBackdrop({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`ap-root pointer-events-none select-none ${className}`.trim()}
    >
      <style>{CSS}</style>
      <div className="ap-layer ap-sky" />
      <div className="ap-layer ap-piri" />

      <svg
        className="ap-layer h-full w-full"
        viewBox="0 0 400 400"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <linearGradient id="ap-rhumb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D9B86A" stopOpacity="0" />
            <stop offset="45%" stopColor="#D9B86A" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ap-coast" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9FB8C8" stopOpacity="0" />
            <stop offset="35%" stopColor="#9FB8C8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#D9B86A" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {/* Piri Reis–style invented rhumb / portolan rays */}
        <g stroke="url(#ap-rhumb)" strokeWidth="0.7" fill="none" opacity="0.55">
          <path d="M72 248L360 40" />
          <path d="M72 248L380 160" />
          <path d="M72 248L340 300" />
          <path d="M72 248L200 20" />
          <path d="M72 248L20 80" />
        </g>

        {/* Abstract invented coast — not a real shoreline */}
        <g fill="none" stroke="url(#ap-coast)" strokeWidth="1.1">
          <path d="M-20 210C40 188 90 230 150 208S250 160 320 190S400 220 440 205" />
          <path d="M-20 240C50 215 100 260 165 238S270 185 340 220S410 250 440 240" opacity="0.7" />
        </g>

        {/* Stars */}
        <g fill="#F8F1DC">
          <circle className="ap-star" cx="48" cy="42" r="1.1" />
          <circle className="ap-star2" cx="118" cy="28" r="0.9" />
          <circle className="ap-star3" cx="176" cy="56" r="1.2" />
          <circle className="ap-star" cx="248" cy="34" r="0.8" />
          <circle className="ap-star2" cx="302" cy="62" r="1.1" />
          <circle className="ap-star3" cx="348" cy="26" r="0.9" />
          <circle className="ap-star" cx="372" cy="88" r="0.7" />
          <circle className="ap-star2" cx="86" cy="78" r="0.7" />
          <circle className="ap-star3" cx="210" cy="22" r="1" />
          {/* guiding star near the beam */}
          <path
            className="ap-star2"
            d="M292 96l1.6 3.4 3.7.4-2.8 2.6.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.8-2.6 3.7-.4Z"
            fill="#F5B942"
            opacity="0.85"
          />
        </g>

        {/* Seyir ışıkları — port (red) / starboard (green), atmosphere only */}
        <g>
          <circle className="ap-nav" cx="286" cy="268" r="7" fill="#ef4444" fillOpacity="0.12" />
          <circle className="ap-nav" cx="286" cy="268" r="2.1" fill="#f87171" />
          <circle className="ap-nav2" cx="318" cy="252" r="7" fill="#22c55e" fillOpacity="0.12" />
          <circle className="ap-nav2" cx="318" cy="252" r="2.1" fill="#4ade80" />
        </g>

        {/* Lighthouse on invented shore */}
        <g transform="translate(64 220)">
          <path d="M2 92h14l-2.5-68H4.5L2 92Z" fill="#9FB8C8" fillOpacity="0.42" />
          <path d="M5 18h8l-1-10H6L5 18Z" fill="#F5B942" fillOpacity="0.85" />
          <circle cx="9" cy="8" r="2.2" fill="#FCD34D" fillOpacity="0.9" />
        </g>
      </svg>

      <div className="ap-layer ap-beam" />

      {/* Wave band */}
      <svg
        className="ap-layer ap-wave"
        style={{ top: "auto", height: "42%", bottom: 0 }}
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        focusable="false"
      >
        <path d="M0 58q50-22 100 0t100 0t100 0t100 0v102H0Z" fill="#07131e" opacity="0.92" />
        <path
          d="M0 74q50-18 100 0t100 0t100 0t100 0"
          fill="none"
          stroke="#F5B942"
          strokeOpacity="0.32"
          strokeWidth="1.2"
        />
        <path
          d="M0 96q50-14 100 0t100 0t100 0t100 0"
          fill="none"
          stroke="#7dd3fc"
          strokeOpacity="0.12"
        />
        <path
          d="M0 118q50-12 100 0t100 0t100 0t100 0"
          fill="none"
          stroke="#F5B942"
          strokeOpacity="0.14"
        />
      </svg>
    </div>
  );
}
