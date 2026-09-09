import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { FulfillmentStatusBadge } from "@/components/orders/FulfillmentStatusBadge";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { OrderSecurityNotice } from "@/components/orders/OrderSecurityNotice";
import {
  ctaKeyForNext,
  labelKeyForDelivery,
  nextDealerState,
  type OrderStatus,
} from "@/lib/orders";
import { Anchor, ChevronRight, Clock, MapPin, Package, XCircle } from "lucide-react";
import { toast } from "sonner";
import { emitEvent } from "@/lib/events";

export interface DealerOrderItem {
  id: string;
  qty: number;
  unit_price: number;
  name_snapshot: string;
}

export interface DealerOrderRow {
  id: string;
  status: OrderStatus;
  created_at: string;
  total: number;
  subtotal: number | null;
  commission: number;
  delivery_marina: string | null;
  delivery_method: string | null;
  delivery_eta_minutes: number | null;
  delivery_location_label: string | null;
  notes: string | null;
  dealer_note: string | null;
  items: DealerOrderItem[];
}

interface Props {
  rows: DealerOrderRow[];
  currency: (n: number) => string;
  onReload: () => void;
}

const GROUPS: { key: string; labelKey: string; match: OrderStatus[] }[] = [
  { key: "new", labelKey: "dealer.group_new", match: ["Submitted", "DealerReview", "Paid"] },
  { key: "active", labelKey: "dealer.group_active", match: ["Confirmed", "Preparing", "OutForDelivery"] },
  { key: "done", labelKey: "dealer.group_delivered", match: ["Delivered", "Completed"] },
  { key: "cancelled", labelKey: "dealer.group_cancelled", match: ["Cancelled"] },
];

export function DealerOrderQueue({ rows, currency, onReload }: Props) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("new");

  const grouped = useMemo(() => {
    const map: Record<string, DealerOrderRow[]> = {};
    for (const g of GROUPS) map[g.key] = [];
    for (const r of rows) {
      const g = GROUPS.find((x) => x.match.includes(r.status));
      if (g) map[g.key].push(r);
    }
    return map;
  }, [rows]);

  const active = grouped[tab] ?? [];

  return (
    <div className="space-y-3">
      <div className="flex w-full min-w-0 max-w-full gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar">
        {GROUPS.map((g) => {
          const count = grouped[g.key]?.length ?? 0;
          const on = tab === g.key;
          return (
            <button
              key={g.key}
              onClick={() => setTab(g.key)}
              className={
                "shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] border transition-colors inline-flex items-center gap-1.5 " +
                (on
                  ? "bg-sky-400 text-slate-900 border-sky-300"
                  : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10")
              }
            >
              {t(g.labelKey)}
              <span
                className={
                  "px-1.5 rounded-full text-[10px] tabular-nums " +
                  (on ? "bg-slate-900/20" : "bg-white/10")
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {active.length === 0 ? (
        <GlassPanel className="text-center">
          <p className="text-sm text-white/60">{t("dealer.queue_empty")}</p>
        </GlassPanel>
      ) : (
        <div className="space-y-2">
          {active.map((row) => (
            <DealerRow
              key={row.id}
              row={row}
              currency={currency}
              open={openId === row.id}
              onToggle={() => setOpenId((id) => (id === row.id ? null : row.id))}
              onReload={onReload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DealerRow({
  row,
  currency,
  open,
  onToggle,
  onReload,
}: {
  row: DealerOrderRow;
  currency: (n: number) => string;
  open: boolean;
  onToggle: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(row.dealer_note ?? "");
  const next = nextDealerState(row.status);
  const ctaKey = ctaKeyForNext(next);
  const created = new Date(row.created_at);

  const advance = async () => {
    if (!next) return;
    setBusy(true);
    const { error } = await supabase
      .from("part_orders")
      .update({ status: next })
      .eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    // M7: telemetry — TODO(server): move to an advance_order RPC.
    emitEvent({
      type: "order.status_advanced",
      subject_type: "order",
      subject_id: row.id,
      metadata: { from: row.status, to: next },
      severity: next === "Delivered" ? "success" : "info",
    });
    toast.success(t("dealer.advance_toast", { status: next }));
    onReload();
  };

  const cancel = async () => {
    if (!confirm(t("dealer.cancel_confirm"))) return;
    setBusy(true);
    const { error } = await supabase
      .from("part_orders")
      .update({ status: "Cancelled" })
      .eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("dealer.order_cancelled"));
    onReload();
  };

  const saveNote = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("part_orders")
      .update({ dealer_note: note || null })
      .eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("dealer.note_saved"));
  };

  return (
    <GlassPanel className="!p-3 space-y-3">
      <button className="w-full text-left" onClick={onToggle}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {t("orders.order_prefix")} · {row.id.slice(0, 6).toUpperCase()}
            </p>
            <p className="text-[11px] text-white/60">
              {created.toLocaleDateString(undefined, { day: "2-digit", month: "short" })} ·{" "}
              {created.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <FulfillmentStatusBadge status={row.status} />
            <ChevronRight
              className={"size-4 text-white/40 transition-transform " + (open ? "rotate-90" : "")}
            />
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/70">
          <p className="inline-flex items-center gap-1.5 truncate">
            <MapPin className="size-3.5 text-white/40" />
            {row.delivery_marina ?? t("orders.marina_tbd")}
          </p>
          <p className="inline-flex items-center gap-1.5 truncate">
            <Anchor className="size-3.5 text-white/40" />
            {t(labelKeyForDelivery(row.delivery_method))}
          </p>
          <p className="inline-flex items-center gap-1.5 truncate">
            <Clock className="size-3.5 text-white/40" />
            {row.delivery_eta_minutes ? t("orders.eta_short", { min: row.delivery_eta_minutes }) : t("orders.eta_pending")}
          </p>
          <p className="inline-flex items-center gap-1.5 truncate justify-self-end">
            <Package className="size-3.5 text-white/40" />
            {t("dealer.parts_x", { count: row.items.length })}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <StatusChip tone="info">{t("dealer.payout", { amount: currency(Number(row.total) - Number(row.commission)) })}</StatusChip>
          <p className="text-sm font-semibold text-white tabular-nums">{currency(Number(row.total))}</p>
        </div>
      </button>

      {open && (
        <div className="pt-1 space-y-3 border-t border-white/[0.06]">
          <OrderTimeline status={row.status} cancelled={row.status === "Cancelled"} />

          <ul className="rounded-xl border border-white/10 divide-y divide-white/5 text-[12px]">
            {row.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between p-2.5">
                <span className="text-white/80 truncate">
                  {it.qty}× {it.name_snapshot}
                </span>
                <span className="tabular-nums text-white/60">
                  {currency(Number(it.unit_price) * it.qty)}
                </span>
              </li>
            ))}
          </ul>

          {row.delivery_location_label && (
            <p className="text-[11px] text-white/60">
              <span className="text-white/40 uppercase tracking-[0.14em] mr-1.5">{t("orders.drop_off")}</span>
              {row.delivery_location_label}
            </p>
          )}

          {row.notes && (
            <p className="text-[11px] text-white/60">
              <span className="text-white/40 uppercase tracking-[0.14em] mr-1.5">{t("dealer.captain_notes")}</span>
              {row.notes}
            </p>
          )}

          <OrderSecurityNotice compact />

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {t("dealer.dealer_note_internal")}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={t("dealer.dealer_note_placeholder")}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 text-[12px] p-2 outline-none focus:border-sky-400/60"
            />
            <button
              onClick={saveNote}
              disabled={busy}
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300 hover:text-sky-200 disabled:opacity-40"
            >
              {t("dealer.save_note")}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {ctaKey && (
              <button
                onClick={advance}
                disabled={busy}
                className="h-10 px-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-900 font-semibold text-[12px] uppercase tracking-[0.14em] disabled:opacity-40"
              >
                {t(ctaKey)}
              </button>
            )}
            {row.status !== "Cancelled" && row.status !== "Completed" && (
              <button
                onClick={cancel}
                disabled={busy}
                className="h-10 px-3 rounded-2xl border border-rose-400/30 text-rose-200 text-[12px] uppercase tracking-[0.14em] hover:bg-rose-500/10 inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <XCircle className="size-3.5" /> {t("dealer.cancel_button")}
              </button>
            )}
          </div>

          <p className="text-[10px] text-white/40">
            {t("dealer.phase9_note")}
          </p>
        </div>
      )}
    </GlassPanel>
  );
}
