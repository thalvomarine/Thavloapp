import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Lock, Wallet, AlertCircle } from "lucide-react";
import { GlassPanel } from "./GlassPanel";
import { StatusChip } from "./StatusChip";

export type EscrowUiState =
  | "awaiting"        // no offer accepted yet
  | "pending"         // captain selecting offer / payment authorization
  | "secured"         // funds held by THALVO
  | "extras_pending"  // extra parts awaiting captain approval
  | "released"        // completed, paid out
  | "cancelled";

interface Props {
  state: EscrowUiState;
  amountLabel: string;         // formatted currency
  providerName?: string | null;
  commissionLabel?: string | null;
  onSecure?: () => void;
  onApproveExtras?: () => void;
  extrasLabel?: string;
  children?: ReactNode;
  className?: string;
}

const STATE_META: Record<EscrowUiState, { chipKey: string; titleKey: string; bodyKey: string; tone: "neutral" | "info" | "success" | "warning" | "danger"; icon: ReactNode }> = {
  awaiting: {
    chipKey: "escrow.state.awaiting_chip", titleKey: "escrow.state.awaiting_title", bodyKey: "escrow.state.awaiting_body",
    tone: "neutral", icon: <Wallet className="size-4" />,
  },
  pending: {
    chipKey: "escrow.state.pending_chip", titleKey: "escrow.state.pending_title", bodyKey: "escrow.state.pending_body",
    tone: "warning", icon: <Lock className="size-4" />,
  },
  secured: {
    chipKey: "escrow.state.secured_chip", titleKey: "escrow.state.secured_title", bodyKey: "escrow.state.secured_body",
    tone: "info", icon: <ShieldCheck className="size-4" />,
  },
  extras_pending: {
    chipKey: "escrow.state.extras_chip", titleKey: "escrow.state.extras_title", bodyKey: "escrow.state.extras_body",
    tone: "warning", icon: <AlertCircle className="size-4" />,
  },
  released: {
    chipKey: "escrow.state.released_chip", titleKey: "escrow.state.released_title", bodyKey: "escrow.state.released_body",
    tone: "success", icon: <ShieldCheck className="size-4" />,
  },
  cancelled: {
    chipKey: "escrow.state.cancelled_chip", titleKey: "escrow.state.cancelled_title", bodyKey: "escrow.state.cancelled_body",
    tone: "danger", icon: <AlertCircle className="size-4" />,
  },
};

/**
 * EscrowPanel — MarineOS transactional summary.
 * Language is intentionally careful: "Secure funds", "Held by THALVO",
 * "Release after completion". Avoids "bank" or "guaranteed".
 * TODO(payments): wire real Stripe Connect hold/capture on onSecure().
 */
export function EscrowPanel({
  state, amountLabel, providerName, commissionLabel,
  onSecure, onApproveExtras, extrasLabel, children, className = "",
}: Props) {
  const { t } = useTranslation();
  const meta = STATE_META[state];
  return (
    <GlassPanel className={"space-y-4 " + className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusChip tone={meta.tone} icon={meta.icon}>
            {t(meta.chipKey)}
          </StatusChip>
          <p className="mt-2 text-sm font-semibold text-white">{t(meta.titleKey)}</p>
          <p className="mt-1 text-[12px] text-white/60 leading-relaxed">{t(meta.bodyKey)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{t("escrow.pool_label")}</p>
          <p className="text-2xl font-semibold text-white tabular-nums tracking-tight mt-0.5">{amountLabel}</p>
          {providerName && <p className="text-[11px] text-white/50 mt-0.5 truncate max-w-[140px]">{providerName}</p>}
        </div>
      </div>

      {state === "pending" && onSecure && (
        <button
          type="button"
          onClick={onSecure}
          className="w-full h-12 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-900 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
        >
          <ShieldCheck className="size-4" />
          {t("escrow.secure_cta")}
        </button>
      )}

      {state === "extras_pending" && onApproveExtras && (
        <button
          type="button"
          onClick={onApproveExtras}
          className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
        >
          <ShieldCheck className="size-4" />
          {t("escrow.approve_extra", { label: extrasLabel ?? t("escrow.approve_extra_fallback") })}
        </button>
      )}

      {state === "released" && commissionLabel && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/60 flex justify-between">
          <span className="uppercase tracking-[0.14em] font-semibold text-white/40">{t("escrow.commission_label")}</span>
          <span className="tabular-nums text-white/80 font-semibold">{commissionLabel}</span>
        </div>
      )}

      {children}
    </GlassPanel>
  );
}
