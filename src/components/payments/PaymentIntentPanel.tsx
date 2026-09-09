import { GlassPanel } from "@/components/mission/GlassPanel";
import { MoneyAmount } from "@/components/core/MoneyAmount";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { centsToUnits, type PaymentIntentStatus } from "@/lib/payments";
import { ShieldCheck } from "lucide-react";

export interface PaymentIntentRow {
  id: string;
  status: PaymentIntentStatus;
  amount_cents: number;
  currency: string;
  provider: string;
  external_ref: string | null;
  secured_at: string | null;
  released_at: string | null;
  created_at: string;
}

interface Props {
  intent: PaymentIntentRow | null;
  className?: string;
}

function statusCopy(status: PaymentIntentStatus): string {
  switch (status) {
    case "released": return "Released to provider";
    case "secured":  return "Held in escrow";
    case "refunded": return "Refunded";
    case "failed":   return "Payment failed";
    default:         return "Payment pending";
  }
}

/**
 * PaymentIntentPanel — money hero for the mission.
 * Copy is deliberately short and legally safe: "Held in escrow" / "Released".
 * Demo-mode footnote is rendered once, small, and never as a warning block.
 */
export function PaymentIntentPanel({ intent, className = "" }: Props) {
  if (!intent) {
    return (
      <GlassPanel className={"space-y-2 " + className}>
        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          <ShieldCheck className="size-3" /> Payment
        </div>
        <p className="text-[13px] text-white/70 leading-relaxed">
          Accepting an offer secures the funds in THALVO escrow.
        </p>
      </GlassPanel>
    );
  }

  const simulated = intent.provider === "simulated";

  return (
    <GlassPanel className={"space-y-4 " + className}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          <ShieldCheck className="size-3" /> Payment
        </span>
        <PaymentStatusBadge status={intent.status} />
      </div>

      <div>
        <MoneyAmount
          value={centsToUnits(intent.amount_cents)}
          currency={intent.currency}
          className="text-3xl leading-none tracking-tight"
        />
        <p className="mt-2 text-[12px] text-white/60">{statusCopy(intent.status)}</p>
      </div>

      {simulated && (
        <p className="text-[10px] text-white/35 leading-relaxed">
          Demo mode — no real funds move in this test environment.
        </p>
      )}
    </GlassPanel>
  );
}
