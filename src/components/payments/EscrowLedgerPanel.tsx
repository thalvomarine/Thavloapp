import { GlassPanel } from "@/components/mission/GlassPanel";
import { SectionHeader } from "@/components/core/SectionHeader";
import { MoneyAmount } from "@/components/core/MoneyAmount";
import { EmptyState } from "@/components/core/EmptyState";
import { ESCROW_KIND_LABEL_KEY, centsToUnits, type EscrowTransactionKind } from "@/lib/payments";
import { useTranslation } from "react-i18next";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";

export interface EscrowLedgerRow {
  id: string;
  kind: EscrowTransactionKind;
  amount_cents: number;
  currency: string;
  notes?: string | null;
  created_at: string;
}

interface Props {
  rows: EscrowLedgerRow[];
  title?: string;
  className?: string;
}

/**
 * EscrowLedgerPanel — append-only view of every escrow movement for a job.
 * Data lives in `public.escrow_transactions`. RLS restricts to captain,
 * provider, and admin.
 */
export function EscrowLedgerPanel({ rows, title, className = "" }: Props) {
  const { t } = useTranslation();
  return (
    <GlassPanel padded={false} className={className}>
      <div className="p-4 border-b border-white/10">
        <SectionHeader label={title ?? t("payments.ledger_title")} />
      </div>
      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Wallet className="size-5" />}
            title={t("payments.ledger_empty_title")}
            body={t("payments.ledger_empty_body")}
          />
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {rows.map((r) => {
            const inflow = r.kind === "secure" || r.kind === "extra_secure";
            return (
              <li key={r.id} className="px-4 py-3 flex items-start gap-3">
                <span
                  className={
                    "mt-0.5 size-7 rounded-full grid place-items-center border " +
                    (inflow
                      ? "text-sky-300 bg-sky-400/10 border-sky-400/25"
                      : "text-emerald-300 bg-emerald-400/10 border-emerald-400/25")
                  }
                >
                  {inflow ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white">{t(ESCROW_KIND_LABEL_KEY[r.kind])}</p>
                  {r.notes && <p className="text-[11px] text-white/50 mt-0.5">{r.notes}</p>}
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 mt-0.5">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <MoneyAmount value={centsToUnits(r.amount_cents)} currency={r.currency} />
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
  );
}
