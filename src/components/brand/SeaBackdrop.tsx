/**
 * SeaBackdrop — purely decorative brand atmosphere.
 *
 * Abstract nautical-chart texture: soft depth contours, a low swell pattern and
 * one very slow drifting sheen. It is deliberately non-representational.
 *
 * It contains NO pins, markers, icons, place names, labels, counts, numbers,
 * provider/job positions or any simulated activity, and it does not depict any
 * real coastline. It makes no claim about the state of the platform.
 *
 * Not related to (and must not be replaced by) MockMap.
 */

type SeaBackdropProps = {
  /** Calmer preset — used behind the auth form. */
  subtle?: boolean;
  /** Manual override for the layer opacity (0–1). Wins over `subtle`. */
  opacity?: number;
  /** Fades the layer out towards the bottom, so content below stays crisp. */
  fadeBottom?: boolean;
  /**
   * `chart` adds finer abstract nautical-chart geometry (graticule, extra depth
   * contours, a compass rose). Still purely decorative: no pin, marker, label,
   * coordinate, vessel or real place is depicted.
   */
  variant?: "default" | "chart";
  className?: string;
};

const CSS = `
.sb-root{position:absolute;inset:0;overflow:hidden;contain:strict}
.sb-layer{position:absolute;inset:0}
.sb-sheen{
  background:radial-gradient(60% 45% at 30% 18%,rgba(56,189,248,.16),transparent 70%),
             radial-gradient(45% 40% at 78% 8%,rgba(45,212,191,.10),transparent 72%);
  animation:sb-drift 64s ease-in-out infinite alternate;
}
.sb-sweep{
  background:conic-gradient(from 0deg at 50% 28%,transparent 0deg,rgba(125,211,252,.09) 14deg,transparent 40deg,transparent 360deg);
  animation:sb-sweep 48s linear infinite;
  transform-origin:50% 28%;
}
.sb-fade{
  -webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 42%,transparent 100%);
  mask-image:linear-gradient(to bottom,#000 0%,#000 42%,transparent 100%);
}
@keyframes sb-drift{
  from{transform:translate3d(-1.5%,-1%,0) scale(1.02)}
  to{transform:translate3d(1.5%,1%,0) scale(1.06)}
}
@keyframes sb-sweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
/* Decorative pulses — atmosphere only, they represent nothing. */
@keyframes sb-pulse{0%,100%{opacity:.18}50%{opacity:.75}}
@keyframes sb-nudge{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(4px,-6px,0)}}
@keyframes sb-beam{0%,100%{opacity:0}45%{opacity:0}55%{opacity:.13}}
.sb-l{animation:sb-pulse 8s ease-in-out infinite,sb-nudge 90s ease-in-out infinite alternate}
.sb-l1{animation-duration:6.5s,84s;animation-delay:-1.2s,-9s}
.sb-l2{animation-duration:9s,102s;animation-delay:-4s,-22s}
.sb-l3{animation-duration:7.4s,96s;animation-delay:-2.6s,-40s}
.sb-l4{animation-duration:10.5s,110s;animation-delay:-6.1s,-15s}
.sb-l5{animation-duration:8.2s,88s;animation-delay:-3.3s,-55s}
.sb-beam{animation:sb-beam 26s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){
  .sb-sheen,.sb-sweep,.sb-l,.sb-beam{animation:none!important}
}
`;

export function SeaBackdrop({
  subtle,
  opacity,
  fadeBottom,
  variant = "default",
  className,
}: SeaBackdropProps) {
  const alpha = opacity ?? (subtle ? 0.38 : 0.7);
  const chart = variant === "chart";

  return (
    <div
      aria-hidden="true"
      className={`sb-root pointer-events-none select-none${fadeBottom ? " sb-fade" : ""}${
        className ? ` ${className}` : ""
      }`}
      style={{ opacity: alpha }}
    >
      <style>{CSS}</style>

      <div className="sb-layer sb-sheen" />

      <svg
        className="sb-layer h-full w-full"
        viewBox="0 0 400 400"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <linearGradient id="sb-line" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.08" />
          </linearGradient>
          <pattern id="sb-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M40 0H0V40"
              fill="none"
              stroke="#7dd3fc"
              strokeOpacity="0.07"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* chart grid */}
        <rect width="400" height="400" fill="url(#sb-grid)" />

        {/* abstract depth contours — concentric, invented, not a coastline */}
        <g fill="none" stroke="url(#sb-line)" strokeWidth="1.1" strokeLinecap="round">
          <path d="M-40 118C40 88 92 148 168 122S300 62 452 104" />
          <path d="M-40 152C46 122 96 182 172 156S302 96 452 138" />
          <path d="M-40 190C52 158 100 220 178 194S306 132 452 176" />
          <path d="M-40 232C58 198 106 262 184 236S310 172 452 218" strokeOpacity="0.7" />
          <path d="M-40 278C64 242 112 308 190 282S316 216 452 264" strokeOpacity="0.5" />
        </g>

        {/* low swell */}
        <g fill="none" stroke="#2dd4bf" strokeOpacity="0.16" strokeWidth="1">
          <path d="M-20 330q25 -12 50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0" />
          <path d="M-20 352q25 -12 50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0" />
          <path d="M-20 374q25 -12 50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0" />
        </g>

        {chart && (
          <>
            {/* graticule — evenly spaced abstract meridians/parallels */}
            <g stroke="#9FB8C8" strokeOpacity="0.09" strokeWidth="0.6">
              {[50, 100, 150, 200, 250, 300, 350].map((v) => (
                <line key={`gx-${v}`} x1={v} y1="0" x2={v} y2="400" />
              ))}
              {[50, 100, 150, 200, 250, 300, 350].map((v) => (
                <line key={`gy-${v}`} x1="0" y1={v} x2="400" y2={v} />
              ))}
            </g>

            {/* finer secondary depth contours */}
            <g
              fill="none"
              stroke="#D9B86A"
              strokeOpacity="0.14"
              strokeWidth="0.8"
              strokeDasharray="5 7"
            >
              <path d="M-40 135C42 105 94 165 170 139S301 79 452 121" />
              <path d="M-40 210C55 178 103 241 181 215S308 152 452 197" />
              <path d="M-40 255C61 220 109 285 187 259S313 194 452 241" />
            </g>

            {/* compass rose — abstract geometry only, no cardinal letters */}
            <g
              transform="translate(320 320)"
              fill="none"
              stroke="#D9B86A"
              strokeOpacity="0.22"
              strokeWidth="0.8"
            >
              <circle r="34" />
              <circle r="22" strokeOpacity="0.14" />
              <circle r="6" strokeOpacity="0.3" />
              <path d="M0 -40V40M-40 0H40" strokeOpacity="0.18" />
              <path d="M-28 -28L28 28M28 -28L-28 28" strokeOpacity="0.1" />
              <path d="M0 -34L7 0L0 34L-7 0Z" strokeOpacity="0.3" />
            </g>

            {/*
              Abstract lighthouse silhouettes — chart ornament echoing the crest.
              Purely decorative: no label, no name, no real place.
            */}
            <g fill="#9FB8C8" fillOpacity="0.12">
              <path d="M64 300h10l-2-34h-6l-2 34Zm3-38h4l-1-8h-2l-1 8Z" />
              <path d="M244 92h8l-2-27h-4l-2 27Zm3-30h2l-1-7h-1l-1 7Z" />
              <path d="M356 214h9l-2-30h-5l-2 30Zm3-33h3l-1-7h-1l-1 7Z" />
            </g>
            {/* Faint, very slow beam. Kept extremely low contrast. */}
            <g className="sb-beam" fill="#D9B86A" fillOpacity="0.5">
              <path d="M69 258l40-16v32l-40-16Z" />
            </g>

            {/*
              Decorative pulsing points. Atmosphere only — they are not pins,
              markers, vessels, providers or any live data, and carry no text.
            */}
            <g>
              <circle
                className="sb-l sb-l1"
                cx="88"
                cy="176"
                r="8"
                fill="#22c55e"
                fillOpacity="0.1"
              />
              <circle className="sb-l sb-l1" cx="88" cy="176" r="2.2" fill="#4ade80" />
              <circle
                className="sb-l sb-l2"
                cx="168"
                cy="248"
                r="8"
                fill="#ef4444"
                fillOpacity="0.1"
              />
              <circle className="sb-l sb-l2" cx="168" cy="248" r="2.2" fill="#f87171" />
              <circle
                className="sb-l sb-l3"
                cx="272"
                cy="146"
                r="8"
                fill="#22c55e"
                fillOpacity="0.1"
              />
              <circle className="sb-l sb-l3" cx="272" cy="146" r="2" fill="#4ade80" />
              <circle
                className="sb-l sb-l4"
                cx="318"
                cy="232"
                r="8"
                fill="#ef4444"
                fillOpacity="0.1"
              />
              <circle className="sb-l sb-l4" cx="318" cy="232" r="2" fill="#f87171" />
              <circle
                className="sb-l sb-l5"
                cx="128"
                cy="96"
                r="7"
                fill="#22c55e"
                fillOpacity="0.1"
              />
              <circle className="sb-l sb-l5" cx="128" cy="96" r="1.8" fill="#4ade80" />
            </g>
          </>
        )}
      </svg>

      <div className="sb-layer sb-sweep" />
    </div>
  );
}
