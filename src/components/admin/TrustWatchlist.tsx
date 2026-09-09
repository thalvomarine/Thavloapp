import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { ShieldAlert } from "lucide-react";
import { computeTrust, labelFromTone, type TrustTone } from "@/lib/trust";

export interface TrustWatchRow {
  id: string;
  name: string;
  rating: number | null;
  jobs_completed: number | null;
  /** `null` when verification could not be read — rendered as unknown, never as false. */
  verified?: boolean | null;
}

const TONE: Record<TrustTone, "success" | "info" | "warning" | "danger"> = {
  reliable: "success", building: "info", watch: "warning", risk: "danger",
};

/** TrustWatchlist — providers whose trust posture needs attention. */
export function TrustWatchlist({ providers }: { providers: TrustWatchRow[] }) {
  const { t } = useTranslation();
  const enriched = providers
    .map((p) => ({
      ...p,
      report: computeTrust({
        rating: p.rating, jobsCompleted: p.jobs_completed, verified: p.verified ?? undefined,
      }),
    }))
    .filter((p) => p.report.tone === "watch" || p.report.tone === "risk" || p.report.score == null)
    .slice(0, 8);

  return (
    <GlassPanel padded={false}>
      <div className="p-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5">
          <ShieldAlert className="size-3.5" /> {t("admin.trust.title")}
        </p>
        <p className="text-sm font-semibold text-white mt-0.5">
          {t("admin.trust.need_review", { count: enriched.length })}
        </p>
      </div>
      <ul className="divide-y divide-white/[0.05] max-h-[220px] overflow-y-auto">
        {enriched.length === 0 && (
          <li className="p-4 text-center text-[11px] text-white/60">{t("admin.trust.all_clear")}</li>
        )}
        {enriched.map((p) => (
          <li key={p.id} className="px-4 py-2.5 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-white truncate">{p.name}</p>
              <p className="text-[10px] text-white/60">
                {t("admin.trust.summary", { count: p.jobs_completed ?? 0, rating: p.rating?.toFixed(1) ?? "—" })}
                {p.verified == null && ` · ${t("admin.trust.verification_unknown")}`}
              </p>
            </div>
            <div className="text-right">
              <StatusChip tone={TONE[p.report.tone]}>
                {p.report.score ?? "—"} · {labelFromTone(p.report.tone)}
              </StatusChip>
            </div>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
