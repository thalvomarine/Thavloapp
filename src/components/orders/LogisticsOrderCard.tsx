import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { FulfillmentStatusBadge } from "@/components/orders/FulfillmentStatusBadge";
import { labelKeyForDelivery, type OrderStatus } from "@/lib/orders";
import { Anchor, Clock, MapPin, Package, Store } from "lucide-react";
import type { ReactNode } from "react";

export interface LogisticsOrder {
  id: string;
  status: OrderStatus;
  createdAt: string;
  dealerName: string | null;
  marina: string | null;
  vesselName?: string | null;
  deliveryMethod: string | null;
  deliveryEtaMinutes: number | null;
  deliveryLocationLabel: string | null;
  itemCount: number;
  total: number;
  currency: (n: number) => string;
  onOpen?: () => void;
  right?: ReactNode;
}

/**
 * Compact captain-side card summarising a fulfillment order.
 * Dealer views can reuse it (buyer PII intentionally omitted).
 */
export function LogisticsOrderCard(p: LogisticsOrder) {
  const { t } = useTranslation();
  const created = new Date(p.createdAt);
  const eta = p.deliveryEtaMinutes;

  return (
    <GlassPanel className="!p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            {t("orders.order_prefix")} · {p.id.slice(0, 6).toUpperCase()}
          </p>
          <p className="text-[11px] text-white/60">
            {created.toLocaleDateString(undefined, { day: "2-digit", month: "short" })} ·{" "}
            {created.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <FulfillmentStatusBadge status={p.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Row icon={<Store className="size-3.5" />} label={p.dealerName ?? t("orders.dealer_fallback")} />
        <Row icon={<MapPin className="size-3.5" />} label={p.marina ?? t("orders.marina_tbd")} />
        <Row
          icon={<Anchor className="size-3.5" />}
          label={t(labelKeyForDelivery(p.deliveryMethod))}
        />
        <Row
          icon={<Clock className="size-3.5" />}
          label={eta ? t("orders.eta_short", { min: eta }) : t("orders.eta_pending")}
        />
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
        <p className="text-[11px] text-white/60 inline-flex items-center gap-1.5">
          <Package className="size-3.5" />
          {t(p.itemCount === 1 ? "orders.parts_count_one" : "orders.parts_count_other", { count: p.itemCount })}
          {p.vesselName ? <span className="text-white/40"> · ⚓ {p.vesselName}</span> : null}
        </p>
        <p className="text-sm font-semibold text-white tabular-nums">{p.currency(p.total)}</p>
      </div>

      {(p.onOpen || p.right) && (
        <div className="flex items-center justify-between gap-2 pt-1">
          {p.onOpen ? (
            <button
              onClick={p.onOpen}
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300 hover:text-sky-200"
            >
              {t("orders.open_tracking")}
            </button>
          ) : <span />}
          {p.right}
        </div>
      )}
    </GlassPanel>
  );
}

function Row({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-white/70 truncate">
      <span className="text-white/40">{icon}</span>
      <span className="truncate">{label}</span>
    </p>
  );
}
