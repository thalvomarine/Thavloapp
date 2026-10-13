import piriUrl from "@/assets/thalvo-piri-chart-bg.jpg";

/**
 * THALVO-exclusive hero atmosphere inspired by Piri Reis portolan charts.
 * Decorative only — invented coastlines; not a navigational chart.
 * Chart artwork (including the compass rose) lives in the JPG — no SVG sunburst overlay.
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
    </div>
  );
}
