/**
 * AuthPassageBackdrop — cold-night passage for /auth.
 *
 * Motifs (decorative only, no real chart / place / live data):
 *   Piri Reis portolan echo · seyir ışıkları · distant beacon · dalga · yıldız
 *
 * The beacon is a far-shore lantern (glow + water wash), not a cartoon tower.
 * Pure CSS + SVG. Respects prefers-reduced-motion.
 */

const CSS = `
.ap-root{position:absolute;inset:0;overflow:hidden;contain:strict;background:#000}
.ap-layer{position:absolute;inset:0;pointer-events:none}
.ap-sky{
  background:
    radial-gradient(70% 55% at 50% 120%, rgba(12,48,78,.5), transparent 58%),
    linear-gradient(180deg,#000 0%,#040912 44%,#091421 70%,#02060c 100%);
}
.ap-piri{
  opacity:.2;
  background:
    radial-gradient(45% 35% at 22% 30%, rgba(217,184,106,.12), transparent 70%),
    radial-gradient(40% 30% at 78% 55%, rgba(125,211,252,.07), transparent 72%);
  animation:ap-drift 80s ease-in-out infinite alternate;
}
/* Far-shore lantern — soft bloom, no rotating cone */
.ap-lantern-bloom{
  left:22%; top:54%; width:min(52vw,420px); height:min(38vw,280px);
  margin-left:calc(min(52vw,420px) / -2); margin-top:calc(min(38vw,280px) / -2);
  background:
    radial-gradient(ellipse 42% 28% at 50% 48%, rgba(252,211,77,.22), transparent 70%),
    radial-gradient(ellipse 70% 55% at 50% 52%, rgba(245,185,66,.08), transparent 72%);
  animation:ap-lantern 7.5s ease-in-out infinite;
}
.ap-lantern-wash{
  left:0; right:0; top:52%; height:28%;
  background:linear-gradient(90deg,
    transparent 0%,
    transparent 8%,
    rgba(245,185,66,.045) 18%,
    rgba(245,185,66,.09) 22%,
    rgba(245,185,66,.04) 32%,
    transparent 48%,
    transparent 100%);
  animation:ap-wash 9s ease-in-out infinite;
  filter:blur(0.2px);
}
.ap-star{animation:ap-twinkle 5.2s ease-in-out infinite}
.ap-star2{animation-duration:6.6s;animation-delay:-2s}
.ap-star3{animation-duration:5.8s;animation-delay:-3.4s}
.ap-nav{animation:ap-nav 6s ease-in-out infinite}
.ap-nav2{animation-duration:7.2s;animation-delay:-2.8s}
.ap-wave{animation:ap-swell 12s ease-in-out infinite}
@keyframes ap-drift{from{transform:translate3d(-1%,0,0)}to{transform:translate3d(1%,.5%,0)}}
@keyframes ap-lantern{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.03)}}
@keyframes ap-wash{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes ap-twinkle{0%,100%{opacity:.22}50%{opacity:.9}}
@keyframes ap-nav{0%,100%{opacity:.3}50%{opacity:.92}}
@keyframes ap-swell{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-2px,0)}}
@media (prefers-reduced-motion: reduce){
  .ap-piri,.ap-lantern-bloom,.ap-lantern-wash,.ap-star,.ap-star2,.ap-star3,.ap-nav,.ap-nav2,.ap-wave{animation:none!important}
  .ap-lantern-bloom,.ap-lantern-wash{opacity:.75}
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
            <stop offset="45%" stopColor="#D9B86A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ap-coast" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9FB8C8" stopOpacity="0" />
            <stop offset="40%" stopColor="#9FB8C8" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#D9B86A" stopOpacity="0.1" />
          </linearGradient>
          <radialGradient id="ap-lamp" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF4C8" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#F5B942" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#F5B942" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Quiet portolan rhumb — chart geometry, not a sunburst */}
        <g stroke="url(#ap-rhumb)" strokeWidth="0.55" fill="none" opacity="0.45">
          <path d="M88 228L340 52" />
          <path d="M88 228L372 148" />
          <path d="M88 228L318 292" />
          <path d="M88 228L210 36" />
        </g>

        {/* Invented coast line */}
        <g fill="none" stroke="url(#ap-coast)" strokeWidth="1">
          <path d="M-20 216C48 196 96 232 154 214S260 168 330 196S408 226 440 214" />
          <path
            d="M-20 244C58 222 108 262 168 244S278 192 348 226S416 256 440 246"
            opacity="0.55"
          />
        </g>

        {/* Stars */}
        <g fill="#F8F1DC">
          <circle className="ap-star" cx="52" cy="38" r="1" />
          <circle className="ap-star2" cx="124" cy="24" r="0.85" />
          <circle className="ap-star3" cx="182" cy="52" r="1.1" />
          <circle className="ap-star" cx="252" cy="30" r="0.75" />
          <circle className="ap-star2" cx="308" cy="58" r="1" />
          <circle className="ap-star3" cx="352" cy="22" r="0.85" />
          <circle className="ap-star" cx="376" cy="84" r="0.65" />
          <circle className="ap-star2" cx="90" cy="72" r="0.65" />
          <circle className="ap-star3" cx="214" cy="18" r="0.9" />
        </g>

        {/* Seyir ışıkları — small, chart-like, not festive */}
        <g>
          <circle className="ap-nav" cx="292" cy="262" r="5.5" fill="#ef4444" fillOpacity="0.1" />
          <circle className="ap-nav" cx="292" cy="262" r="1.6" fill="#f87171" />
          <circle className="ap-nav2" cx="322" cy="248" r="5.5" fill="#22c55e" fillOpacity="0.1" />
          <circle className="ap-nav2" cx="322" cy="248" r="1.6" fill="#4ade80" />
        </g>

        {/*
          Distant beacon — lamp only on the horizon.
          No tower silhouette (those read as clipart).
        */}
        <g transform="translate(88 214)">
          <ellipse cx="0" cy="2" rx="28" ry="10" fill="url(#ap-lamp)" opacity="0.55" />
          <circle cx="0" cy="0" r="2.4" fill="#FFF4C8" />
          <circle cx="0" cy="0" r="1.1" fill="#fff" fillOpacity="0.9" />
        </g>
      </svg>

      <div className="ap-layer ap-lantern-bloom" style={{ position: "absolute" }} />
      <div className="ap-layer ap-lantern-wash" style={{ position: "absolute", inset: "auto 0" }} />

      {/* Wave band */}
      <svg
        className="ap-layer ap-wave"
        style={{ top: "auto", height: "40%", bottom: 0 }}
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        focusable="false"
      >
        <path d="M0 62q50-18 100 0t100 0t100 0t100 0v98H0Z" fill="#07131e" opacity="0.94" />
        <path
          d="M0 78q50-15 100 0t100 0t100 0t100 0"
          fill="none"
          stroke="#F5B942"
          strokeOpacity="0.26"
          strokeWidth="1.1"
        />
        <path
          d="M0 98q50-12 100 0t100 0t100 0t100 0"
          fill="none"
          stroke="#7dd3fc"
          strokeOpacity="0.1"
        />
        <path
          d="M0 118q50-10 100 0t100 0t100 0t100 0"
          fill="none"
          stroke="#F5B942"
          strokeOpacity="0.12"
        />
      </svg>
    </div>
  );
}
