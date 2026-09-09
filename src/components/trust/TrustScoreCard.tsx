import { GlassPanel } from "@/components/mission/GlassPanel";
import type { TrustReport, TrustTone } from "@/lib/trust";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

const TONE: Record<TrustTone, { text: string; ring: string; glow: string }> = {
  reliable: { text: "text-emerald-300", ring: "stroke-emerald-400/80",  glow: "from-emerald-400/25" },
  building: { text: "text-sky-300",     ring: "stroke-sky-400/80",      glow: "from-sky-400/20" },
  watch:    { text: "text-amber-300",   ring: "stroke-amber-400/80",    glow: "from-amber-400/25" },
  risk:     { text: "text-rose-300",    ring: "stroke-rose-400/80",     glow: "from-rose-500/30" },
};

interface Props {
  report: TrustReport;
  subject?: string;
  right?: ReactNode;
}

/** TrustScoreCard — aviation-safety style aggregate readout. Reusable. */
export function TrustScoreCard({ report, subject, right }: Props) {
  const { t } = useTranslation();
  const tone = TONE[report.tone];
  const displayScore = report.score ?? 0;
  const circumference = 2 * Math.PI * 42;
  const dash = (displayScore / 100) * circumference;
  const resolvedSubject = subject ?? t("trust.card.subject_default");
  const buildingLines = t("trust.card.building_score").split("\n");

  return (
    <GlassPanel padded={false} className="overflow-hidden">
      <div className={`p-5 bg-gradient-to-br ${tone.glow} via-transparent to-transparent`}>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
              <circle cx="50" cy="50" r="42" strokeWidth="6" className="stroke-white/10 fill-none" />
              {report.score != null && (
                <circle
                  cx="50" cy="50" r="42" strokeWidth="6"
                  className={`${tone.ring} fill-none transition-[stroke-dasharray] duration-700`}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference}`}
                />
              )}
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              {report.score != null ? (
                <div className={`text-2xl font-semibold tabular-nums ${tone.text}`}>{report.score}</div>
              ) : (
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 text-center leading-tight">
                  {buildingLines.map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < buildingLines.length - 1 && <br />}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">{resolvedSubject}</p>
            <p className={`mt-1 text-lg font-semibold ${tone.text}`}>
              <ShieldCheck className="inline size-4 mr-1 -mt-0.5" />
              {t(`trust.tone.${report.tone}`)}
            </p>
            <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
              {report.hasSignal
                ? t("trust.card.hint_signal")
                : t("trust.card.hint_no_signal")}
            </p>
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      </div>
    </GlassPanel>
  );
}
