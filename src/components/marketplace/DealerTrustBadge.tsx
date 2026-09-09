import { BadgeCheck, Store } from "lucide-react";
import { toneFromScore } from "@/lib/trust";

interface Props {
  verified?: boolean;
  name?: string | null;
  marina?: string | null;
  /** Optional 0..100 dealer trust score (null = building). */
  score?: number | null;
  className?: string;
}

const SCORE_TONE: Record<string, string> = {
  reliable: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  building: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  watch:    "text-amber-300 border-amber-400/30 bg-amber-400/10",
  risk:     "text-rose-300 border-rose-500/30 bg-rose-500/10",
};

/** DealerTrustBadge — dealer identity + verification + optional score. */
export function DealerTrustBadge({ verified = true, name, marina, score, className = "" }: Props) {
  const tone = toneFromScore(score ?? null);
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 text-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] " +
        className
      }
    >
      <Store className="size-2.5 text-white/50" />
      <span className="text-white/80 truncate max-w-[120px]">{name ?? "Dealer"}</span>
      {marina && <span className="text-white/40">· {marina}</span>}
      {verified && (
        <span className="inline-flex items-center gap-0.5 text-sky-300">
          <BadgeCheck className="size-2.5" />
        </span>
      )}
      {score != null && (
        <span className={"ml-1 rounded-full border px-1.5 py-[1px] tabular-nums " + SCORE_TONE[tone]}>
          {score}
        </span>
      )}
    </span>
  );
}
