import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { SectionHeader } from "@/components/core/SectionHeader";
import { MoneyAmount } from "@/components/core/MoneyAmount";
import { PayoutStatusBadge } from "./PaymentStatusBadge";
import { centsToUnits, type PayoutStatus } from "@/lib/payments";
import { Wallet } from "lucide-react";

export interface ProviderPayoutRow {
  id: string;
  status: PayoutStatus;
  amount_cents: number;
  currency: string;
  requested_at: string;
  completed_at: string | null;
  external_ref: string | null;
}

interface Props {
  payout: ProviderPayoutRow | null;
  expectedNet?: number | null;
  feeAmount?: number | null;
  className?: string;
}

/**
 * ProviderPayoutPanel — provider-facing view of what THALVO owes them
 * for a mission. Copy makes it explicit that funds only move after the
 * captain confirms mission completion.
 */
export function ProviderPayoutPanel({ payout, expectedNet, feeAmount, className = "" }: Props) {
  const { t } = useTranslation();
  const amount = payout ? centsToUnits(payout.amount_cents) : expectedNet ?? 0;
  const statusHint =
    payout?.status === "completed"
      ? t("payout.completed")
      : payout?.status === "processing"
        ? t("payout.processing")
        : payout
          ? t("payout.pending")
          : t("payout.awaiting");
  return (
    <GlassPanel className={"space-y-3 " + className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionHeader label={t("payout.title")} icon={<Wallet className="size-3.5" />} />
          <p className="text-[11px] text-white/50 mt-1">{statusHint}</p>
        </div>
        {payout && <PayoutStatusBadge status={payout.status} />}
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{t("payout.expected_net")}</p>
          <MoneyAmount value={amount} currency={payout?.currency} className="mt-1 text-base" />
        </div>
        {feeAmount != null && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{t("payout.thalvo_fee")}</p>
            <MoneyAmount value={feeAmount} muted currency={payout?.currency} className="mt-1 text-base" />
          </div>
        )}
      </div>

    </GlassPanel>
  );
}
