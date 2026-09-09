import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { MoneyAmount } from "@/components/core/MoneyAmount";
import { PaymentStatusBadge, PayoutStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { centsToUnits, type PaymentIntentStatus, type PayoutStatus } from "@/lib/payments";
import { AlertCircle, Banknote, ShieldCheck, Wallet } from "lucide-react";

export interface AdminPaymentIntentRow {
  id: string;
  job_id: string;
  status: PaymentIntentStatus;
  amount_cents: number;
  provider: string;
  created_at: string;
}

export interface AdminPayoutRow {
  id: string;
  job_id: string;
  status: PayoutStatus;
  amount_cents: number;
  provider_id: string;
  created_at: string;
}

export interface AdminCommissionRow {
  id: string;
  job_id: string;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  created_at: string;
}

interface Props {
  intents: AdminPaymentIntentRow[];
  payouts: AdminPayoutRow[];
  commissions: AdminCommissionRow[];
  providerConnected?: boolean;
}

/**
 * AdminPaymentOpsPanel — /app/admin payment ops surface.
 *
 * Presents pending / secured / released intents, provider payouts owed,
 * commission recorded, and any failed intents. Manual admin actions
 * (release, refund, dispute, mark-paid) are UI-disabled until the real
 * payment provider is wired in — see TODO(payments-provider).
 */
export function AdminPaymentOpsPanel({ intents, payouts, commissions, providerConnected = false }: Props) {
  const { t } = useTranslation();
  const secured = intents.filter((i) => i.status === "secured");
  const pending = intents.filter((i) => i.status === "pending" || i.status === "created");
  const released = intents.filter((i) => i.status === "released");
  const failed = intents.filter((i) => i.status === "failed" || i.status === "refunded");

  const heldCents = secured.reduce((s, i) => s + Number(i.amount_cents), 0);
  const releasedCents = released.reduce((s, i) => s + Number(i.amount_cents), 0);
  const commissionCents = commissions.reduce((s, c) => s + Number(c.fee_cents), 0);
  const payoutOwedCents = payouts
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((s, p) => s + Number(p.amount_cents), 0);

  return (
    <GlassPanel padded={false}>
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60 flex items-center gap-1.5">
          <Banknote className="size-3.5" /> {t("admin.payops.title")}
        </p>
        <span
          className={
            "text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border " +
            (providerConnected
              ? "text-emerald-300 bg-emerald-400/10 border-emerald-400/25"
              : "text-amber-300 bg-amber-400/10 border-amber-400/25")
          }
        >
          {providerConnected ? t("admin.payops.provider_live") : t("admin.payops.test_mode")}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.05]">
        <Cell label={t("admin.payops.held")}   value={centsToUnits(heldCents)}       tone="text-sky-300" />
        <Cell label={t("admin.payops.owed")}  value={centsToUnits(payoutOwedCents)} tone="text-amber-300" />
        <Cell label={t("admin.payops.released")}      value={centsToUnits(releasedCents)}   tone="text-emerald-300" />
        <Cell label={t("admin.payops.commission")}    value={centsToUnits(commissionCents)} tone="text-emerald-200" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
        <IntentList title={t("admin.payops.pending_intents")}  icon={<AlertCircle className="size-3.5" />} rows={[...pending, ...failed].slice(0, 6)} />
        <IntentList title={t("admin.payops.secured_intents")} icon={<ShieldCheck className="size-3.5" />} rows={secured.slice(0, 6)} />
      </div>

      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60 flex items-center gap-1.5">
            <Wallet className="size-3.5" /> {t("admin.payops.payouts_pending")}
          </p>
        </div>
        {payouts.length === 0 ? (
          <p className="text-[11px] text-white/60 px-1 py-2">{t("admin.payops.no_payouts")}</p>
        ) : (
          <ul className="space-y-1 max-h-[180px] overflow-y-auto">
            {payouts.slice(0, 12).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] text-[11px]">
                <span className="text-white/50 tabular-nums font-mono">{p.job_id.slice(0, 8)}</span>
                <span className="flex-1 text-white/70 truncate">{t("admin.payops.provider_short", { id: p.provider_id.slice(0, 8) })}</span>
                <MoneyAmount value={centsToUnits(p.amount_cents)} className="text-[11px]" />
                <PayoutStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-white/[0.06] p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-2">{t("admin.payops.operator_actions")}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <ActionButton label={t("admin.payops.action_verify")} disabled={!providerConnected} title={t("admin.payops.disabled_hint")} />
          <ActionButton label={t("admin.payops.action_release")} disabled={!providerConnected} title={t("admin.payops.disabled_hint")} />
          <ActionButton label={t("admin.payops.action_refund")} disabled={!providerConnected} title={t("admin.payops.disabled_hint")} />
          <ActionButton label={t("admin.payops.action_payout")} disabled={!providerConnected} title={t("admin.payops.disabled_hint")} />
        </div>
        {!providerConnected && (
          <p className="mt-2 text-[10px] text-white/60 leading-relaxed">
{t("admin.payops.test_mode_note")}
          </p>
        )}
      </div>
    </GlassPanel>
  );
}

function Cell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">{label}</p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${tone}`}>
        <MoneyAmount value={value} className={tone} />
      </p>
    </div>
  );
}

function IntentList({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: AdminPaymentIntentRow[] }) {
  const { t } = useTranslation();
  return (
    <div className="p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-1.5 flex items-center gap-1.5">
        {icon} {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-[11px] text-white/60 py-2">{t("admin.payops.none")}</p>
      ) : (
        <ul className="space-y-1 max-h-[160px] overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-white/[0.04] text-[11px]">
              <span className="text-white/50 tabular-nums font-mono">{r.job_id.slice(0, 8)}</span>
              <MoneyAmount value={centsToUnits(r.amount_cents)} className="ml-auto text-[11px]" />
              <PaymentStatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActionButton({ label, disabled, title }: { label: string; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? title : undefined}
      className="h-9 rounded-lg border border-white/10 bg-white/[0.03] text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70 hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  );
}
