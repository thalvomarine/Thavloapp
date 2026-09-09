import { useEffect } from "react";
import { X } from "lucide-react";
import type { TrustReport } from "@/lib/trust";
import { TrustScoreCard } from "./TrustScoreCard";
import { TrustBreakdown } from "./TrustBreakdown";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
  report: TrustReport;
  subject: string;
}

/** TrustExplanationSheet — bottom sheet answering "Why this score?" */
export function TrustExplanationSheet({ open, onClose, report, subject }: Props) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="thalvo-dark thalvo-cockpit absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-white/10 p-4 space-y-4 sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[420px] sm:rounded-3xl sm:border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-sky-300/80">{t("trust.sheet.eyebrow")}</p>
            <h2 className="text-lg font-semibold text-white">{t("trust.sheet.title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="size-9 grid place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
        <TrustScoreCard report={report} subject={subject} />
        <TrustBreakdown report={report} />
        <p className="text-[10px] text-white/40 leading-relaxed">
          {t("trust.sheet.footer")}
        </p>
      </div>
    </div>
  );
}
