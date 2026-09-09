import { GlassPanel } from "@/components/mission/GlassPanel";
import type { TrustReport } from "@/lib/trust";
import { TrustMetricRow } from "./TrustMetricRow";
import { useTranslation } from "react-i18next";

interface Props {
  report: TrustReport;
  title?: string;
}

/** TrustBreakdown — grid of TrustMetricRow. Reusable across provider + dealer. */
export function TrustBreakdown({ report, title }: Props) {
  const { t } = useTranslation();
  const live = report.metrics.filter((m) => m.score != null).length;
  const total = report.metrics.length;
  return (
    <GlassPanel padded={false}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
          {title ?? t("trust.breakdown.title")}
        </p>
        <span className="text-[10px] text-white/40">
          {t("trust.breakdown.signals_live", { live, total })}
        </span>
      </div>
      <div className="p-4 grid gap-2.5 sm:grid-cols-2">
        {report.metrics.map((m) => <TrustMetricRow key={m.key} metric={m} />)}
      </div>
    </GlassPanel>
  );
}
