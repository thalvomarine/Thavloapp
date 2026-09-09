import { BadgeCheck, Star } from "lucide-react";

interface Props {
  rating?: number | null;
  verified?: boolean;
  jobs?: number | null;
  className?: string;
}

/**
 * ProviderTrustBadge — compact trust signal cluster for offer cards.
 * Reusable across offer lists, provider profiles, mission timeline.
 */
export function ProviderTrustBadge({ rating, verified = true, jobs, className = "" }: Props) {
  const r = typeof rating === "number" ? rating : 5;
  return (
    <div className={"inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] " + className}>
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-300 px-2 py-0.5">
        <Star className="size-2.5 fill-amber-300 text-amber-300" />
        {r.toFixed(1)}
      </span>
      {verified && (
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 text-sky-300 px-2 py-0.5">
          <BadgeCheck className="size-2.5" />
          Verified
        </span>
      )}
      {typeof jobs === "number" && jobs > 0 && (
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 text-white/70 px-2 py-0.5">
          {jobs} ops
        </span>
      )}
    </div>
  );
}
