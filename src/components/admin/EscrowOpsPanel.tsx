import { GlassPanel } from "@/components/mission/GlassPanel";
import { Wallet } from "lucide-react";
import { formatTL } from "@/lib/filter";

interface Props {
  heldEscrow: number;
  commissionToDate: number;
  providerPayoutToDate: number;
  recentEntries: Array<{ id: string; commission_amount: number; provider_payout: number; created_at: string }>;
}

const tl = (n: number) => formatTL(Math.round(n));

/**
 * EscrowOpsPanel — money-in-flight overview.
 * TODO(commission-realtime): once payment provider webhooks land, replace
 * derived numbers with settled totals from the ledger + payments table.
 */
export function EscrowOpsPanel({ heldEscrow, commissionToDate, providerPayoutToDate, recentEntries }: Props) {
  return (
    <GlassPanel padded={false}>
      <div className="p-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5">
          <Wallet className="size-3.5" /> Escrow & commission
        </p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-white/[0.05]">
        <Cell label="In escrow" value={tl(heldEscrow)} tone="text-sky-300" />
        <Cell label="Payouts" value={tl(providerPayoutToDate)} tone="text-white" />
        <Cell label="Commission" value={tl(commissionToDate)} tone="text-emerald-300" />
      </div>
      <div className="p-3 border-t border-white/[0.06]">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 px-1 mb-1.5">Recent ledger</p>
        <ul className="space-y-1 max-h-[160px] overflow-y-auto">
          {recentEntries.length === 0 && (
            <li className="text-[11px] text-white/40 px-1 py-2">Commission tracking ready — no entries yet.</li>
          )}
          {recentEntries.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.04] text-[11px]">
              <span className="text-white/50">{new Date(e.created_at).toLocaleDateString()}</span>
              <span className="text-white/80 tabular-nums">{tl(Number(e.provider_payout))}</span>
              <span className="text-emerald-300/80 tabular-nums">+{tl(Number(e.commission_amount))}</span>
            </li>
          ))}
        </ul>
      </div>
    </GlassPanel>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
