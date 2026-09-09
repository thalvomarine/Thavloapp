import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";

/**
 * Persistent reminder that communication + payment for this order
 * must stay inside THALVO. Pairs with the anti-leak system from Phase 8.
 */
export function OrderSecurityNotice({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className={
        "rounded-2xl border border-emerald-400/20 bg-emerald-400/5 text-emerald-100 flex items-start gap-2 " +
        (compact ? "p-2.5" : "p-3")
      }
    >
      <ShieldCheck className="size-4 shrink-0 mt-0.5 text-emerald-300" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{t("order_security.title")}</p>
        <p className="text-[11px] text-emerald-100/70 leading-snug">
          {t("order_security.body")}
        </p>
      </div>
    </div>
  );
}
