import type { TrustReport } from "@/lib/trust";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { TrustScoreCard } from "./TrustScoreCard";
import { TrustBreakdown } from "./TrustBreakdown";
import { VerificationBadge } from "./VerificationBadge";
import { CheckCircle2, Compass, ShieldCheck, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Action {
  key: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

interface Props {
  report: TrustReport;
  subject: string;
  verified: boolean;
  extraStats?: { label: string; value: string }[];
  onAction?: (key: string) => void;
}

/** ReputationPanel — full operator reputation surface. Composable. */
export function ReputationPanel({ report, subject, verified, extraStats, onAction }: Props) {
  const { t } = useTranslation();

  const actions: Action[] = [
    { key: "profile",  label: t("trust.action.profile_label"),  hint: t("trust.action.profile_hint"),  icon: <Compass className="size-4" /> },
    { key: "certs",    label: t("trust.action.certs_label"),    hint: t("trust.action.certs_hint"),    icon: <Upload className="size-4" />, disabled: true },
    { key: "missions", label: t("trust.action.missions_label"), hint: t("trust.action.missions_hint"), icon: <CheckCircle2 className="size-4" /> },
    { key: "eta",      label: t("trust.action.eta_label"),      hint: t("trust.action.eta_hint"),      icon: <ShieldCheck className="size-4" /> },
  ];

  return (
    <div className="space-y-4">
      <TrustScoreCard
        report={report}
        subject={subject}
        right={<VerificationBadge verified={verified} />}
      />
      {extraStats && extraStats.length > 0 && (
        <GlassPanel padded={false}>
          <ul className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/[0.06]">
            {extraStats.map((s) => (
              <li key={s.label} className="p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{s.label}</p>
                <p className="text-lg font-semibold text-white tabular-nums mt-1">{s.value}</p>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}
      <TrustBreakdown report={report} />
      <GlassPanel padded={false}>
        <div className="p-4 border-b border-white/10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">{t("trust.actions_eyebrow")}</p>
          <p className="text-sm text-white/90 font-medium mt-1">{t("trust.actions_title")}</p>
        </div>
        <ul className="p-2">
          {actions.map((a) => (
            <li key={a.key}>
              <button
                onClick={() => onAction?.(a.key)}
                disabled={a.disabled}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="size-9 rounded-xl bg-white/5 border border-white/10 grid place-items-center text-sky-300 shrink-0">
                  {a.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-white/90">{a.label}</span>
                  <span className="block text-[11px] text-white/45">{a.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}
