import { Wrench, Anchor } from "lucide-react";

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "mechanic" | "diver";
  highlighted?: boolean;
}

export interface JobPin {
  id: string;
  lat: number;
  lng: number;
  marina: string;
}

interface Props {
  providers: MapPin[];
  jobs?: JobPin[];
  overridePositions?: Record<string, { lat: number; lng: number }>;
  className?: string;
}

export function MockMap({ providers, jobs = [], overridePositions, className = "" }: Props) {
  // M9.2 — evaluate providers and jobs independently so a single real-degree
  // job cannot distort legacy-normalized provider positions (and vice versa).
  // Each group projects through its own bounding box, then values are clamped
  // to [0, 100] so no marker can render off-canvas or with NaN/Infinity CSS.
  const providerPoints = providers
    .map((p) => {
      const pos = overridePositions?.[p.id] ?? { lat: p.lat, lng: p.lng };
      return { lat: pos.lat, lng: pos.lng };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const jobPoints = jobs
    .map((j) => ({ lat: j.lat, lng: j.lng }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  const clamp01 = (v: number) => Math.min(100, Math.max(0, v));

  const buildProjector = (points: { lat: number; lng: number }[]) => {
    const hasRealDegrees = points.some((p) => Math.abs(p.lat) > 1 || Math.abs(p.lng) > 1);
    if (!hasRealDegrees) {
      return (lat: number, lng: number) => ({
        top: clamp01(lat * 100),
        left: clamp01(lng * 100),
      });
    }
    if (points.length === 0) {
      return () => ({ top: 50, left: 50 });
    }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const padLat = Math.max((maxLat - minLat) * 0.25, 0.005);
    const padLng = Math.max((maxLng - minLng) * 0.25, 0.005);
    minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng;
    const spanLat = maxLat - minLat;
    const spanLng = maxLng - minLng;
    return (lat: number, lng: number) => {
      const top = spanLat === 0 ? 50 : ((maxLat - lat) / spanLat) * 100;
      const left = spanLng === 0 ? 50 : ((lng - minLng) / spanLng) * 100;
      return { top: clamp01(top), left: clamp01(left) };
    };
  };

  const projectProvider = buildProjector(providerPoints);
  const projectJob = buildProjector(jobPoints);



  return (
    <div
      className={
        "relative w-full overflow-hidden rounded-2xl border border-border " +
        "bg-[radial-gradient(ellipse_at_top_left,oklch(0.92_0.04_200),oklch(0.78_0.08_220)_60%,oklch(0.55_0.1_240))] " +
        "aspect-[16/10] " +
        className
      }
    >
      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 60" preserveAspectRatio="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <path
            key={i}
            d={`M0 ${10 + i * 7} Q 25 ${6 + i * 7} 50 ${10 + i * 7} T 100 ${10 + i * 7}`}
            stroke="white"
            strokeOpacity="0.35"
            strokeWidth="0.25"
            fill="none"
          />
        ))}
      </svg>
      <div className="absolute -top-8 -right-10 w-44 h-44 rounded-full bg-[oklch(0.78_0.08_90)]/80 blur-sm" />
      <div className="absolute -bottom-12 -left-12 w-52 h-40 rounded-full bg-[oklch(0.72_0.07_100)]/80 blur-sm" />

      {providers.map((m) => {
        const isDiver = m.kind === "diver";
        const pos = overridePositions?.[m.id] ?? { lat: m.lat, lng: m.lng };
        const { top, left } = projectProvider(pos.lat, pos.lng);
        return (
          <div
            key={m.id}
            className="absolute -translate-x-1/2 -translate-y-full transition-all duration-1000 ease-linear"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <div className={"flex flex-col items-center " + (m.highlighted ? "scale-110" : "")}>
              <div
                className={
                  "h-9 w-9 grid place-items-center rounded-full text-white shadow-[var(--shadow-marine)] " +
                  (m.highlighted
                    ? (isDiver ? "aqua-gradient ring-4 ring-white/70" : "teal-gradient ring-4 ring-white/70")
                    : (isDiver ? "aqua-gradient" : "marine-gradient"))
                }
              >
                {isDiver ? <Anchor className="size-4" /> : <Wrench className="size-4" />}
              </div>
              <div className={"w-1 h-2 " + (isDiver ? "bg-aqua" : "bg-deep")} />
              <span className={"mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded " + (isDiver ? "text-white bg-aqua" : "text-deep bg-white/85")}>
                {m.name.split(" ")[0]}
              </span>
            </div>
          </div>
        );
      })}

      {jobs.map((j) => {
        const { top, left } = projectJob(j.lat, j.lng);
        return (
          <div
            key={j.id}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 grid place-items-center rounded-full bg-destructive text-white shadow-[var(--shadow-marine)] animate-pulse">
                🚨
              </div>
              <span className="mt-0.5 text-[10px] font-semibold text-white bg-destructive px-1.5 py-0.5 rounded">
                {j.marina}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
