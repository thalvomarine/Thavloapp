import { MoneyAmount } from "@/components/core/MoneyAmount";
import { computeCommission } from "@/lib/payments";

interface Props {
  gross: number;
  rate?: number;
  className?: string;
}

/**
 * CommissionBreakdown — inline 3-row breakdown showing gross → fee → net.
 * Reusable across captain, provider, and admin surfaces.
 */
export function CommissionBreakdown({ gross, rate, className = "" }: Props) {
  const b = computeCommission(gross, rate);
  const pct = Math.round(b.rate * 100);
  return (
    <div className={"rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12px] space-y-1.5 " + className}>
      <Row label="Provider gross" value={b.gross} />
      <Row label={`THALVO service fee (${pct}%)`} value={-b.fee} muted />
      <div className="border-t border-white/10 pt-1.5">
        <Row label="Provider net" value={b.net} bold accent />
      </div>
    </div>
  );
}

function Row({ label, value, muted, bold, accent }: { label: string; value: number; muted?: boolean; bold?: boolean; accent?: boolean }) {
  return (
    <div className={"flex items-center justify-between " + (muted ? "text-white/50" : "text-white/80")}>
      <span>{label}</span>
      <MoneyAmount
        value={value}
        className={bold ? "text-sm" : ""}
        muted={muted}
        tone={accent ? "gold" : "default"}
      />
    </div>
  );
}
