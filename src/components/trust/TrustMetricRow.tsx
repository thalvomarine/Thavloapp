import type { TrustMetric } from "@/lib/trust";
import { toneFromScore } from "@/lib/trust";
import { useTranslation } from "react-i18next";

const BAR_TONE: Record<string, string> = {
  reliable: "bg-emerald-400",
  building: "bg-sky-400",
  watch:    "bg-amber-400",
  risk:     "bg-rose-400",
};

interface Props {
  metric: TrustMetric;
}

/** TrustMetricRow — a single row inside the breakdown list. */
export function TrustMetricRow({ metric }: Props) {
  const { t } = useTranslation();
  const tone = toneFromScore(metric.score);
  const bar = BAR_TONE[tone];

  const labelKey = `trust.metric.${metric.key}.label`;
  const detailKey = metric.placeholder
    ? `trust.metric.${metric.key}.detail_empty`
    : `trust.metric.${metric.key}.detail`;
  const label = t(labelKey, { defaultValue: metric.label });
  const detail = t(detailKey, {
    defaultValue: metric.detail,
    count: metric.count,
  });

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-white/90 truncate">{label}</p>
        <span className="text-xs font-semibold tabular-nums text-white/80">
          {metric.score == null ? (
            <span className="text-white/40 uppercase tracking-[0.14em] text-[10px]">
              {t("trust.metric.building_placeholder")}
            </span>
          ) : (
            `${metric.score}`
          )}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${bar}`}
          style={{ width: `${metric.score ?? 6}%`, opacity: metric.score == null ? 0.35 : 1 }}
        />
      </div>
      <p className="text-[11px] text-white/45 mt-1.5 leading-relaxed">{detail}</p>
    </div>
  );
}
