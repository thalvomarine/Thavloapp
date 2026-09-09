import { StatusBadge } from "@/components/core/StatusBadge";
import type { StatusTone } from "@/types/marine";
import {
  PAYMENT_STATUS_LABEL_KEY,
  PAYMENT_STATUS_TONE,
  PAYOUT_STATUS_LABEL_KEY,
  PAYOUT_STATUS_TONE,
  type PaymentIntentStatus,
  type PayoutStatus,
} from "@/lib/payments";
import { ShieldCheck, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PaymentProps {
  status: PaymentIntentStatus;
  className?: string;
}

/** PaymentStatusBadge — canonical pill for a payment_intents row. */
export function PaymentStatusBadge({ status, className }: PaymentProps) {
  const { t } = useTranslation();
  return (
    <StatusBadge
      tone={PAYMENT_STATUS_TONE[status] as StatusTone}
      icon={<ShieldCheck className="size-3" />}
      className={className}
    >
      {t(PAYMENT_STATUS_LABEL_KEY[status])}
    </StatusBadge>
  );
}

interface PayoutProps {
  status: PayoutStatus;
  className?: string;
}

/** PayoutStatusBadge — canonical pill for a provider_payouts row. */
export function PayoutStatusBadge({ status, className }: PayoutProps) {
  const { t } = useTranslation();
  return (
    <StatusBadge
      tone={PAYOUT_STATUS_TONE[status] as StatusTone}
      icon={<Wallet className="size-3" />}
      className={className}
    >
      {t(PAYOUT_STATUS_LABEL_KEY[status])}
    </StatusBadge>
  );
}
