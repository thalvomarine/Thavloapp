import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { useSessionUser } from "@/lib/session";
import { formatTL } from "@/lib/filter";
import { MarketplaceShell } from "@/components/marketplace/MarketplaceShell";
import { FulfillmentStatusBadge } from "@/components/orders/FulfillmentStatusBadge";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { OrderSecurityNotice } from "@/components/orders/OrderSecurityNotice";
import { LogisticsOrderCard } from "@/components/orders/LogisticsOrderCard";
import { labelKeyForDelivery, type OrderStatus } from "@/lib/orders";
import { EmptyState, StatusBadge, MoneyAmount } from "@/components/core";
import { Anchor, Clock, MapPin, Package as PackageIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/orders")({
  ssr: false,
  component: OrdersPage,
});

interface OrderRow {
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
  vessel_id: string | null;
  dealer: { business_name: string | null; full_name: string | null } | null;
  vessel: { boat_name: string | null } | null;
  items: { id: string; qty: number; unit_price: number; name_snapshot: string }[];
}

function OrdersPage() {
  const { user, loading } = useSessionUser();
  if (loading) return <ThalvoLoader />;
  if (!user) return null;
  return (
    <AppShell userId={user.id}>
      <CaptainOrders userId={user.id} />
    </AppShell>
  );
}

function CaptainOrders({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("part_orders")
      .select(
        "id,status,created_at,total,subtotal,commission,delivery_marina,delivery_method,delivery_eta_minutes,delivery_location_label,notes,dealer_note,vessel_id,dealer:profiles!dealer_id(business_name,full_name),vessel:vessels!vessel_id(boat_name:name),items:part_order_items(id,qty,unit_price,name_snapshot)"
      )
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data as never as OrderRow[]) ?? []);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <ThalvoLoader />;

  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <MarketplaceShell
      eyebrow={t("orders.eyebrow")}
      title={t("orders.title")}
      right={<StatusBadge tone="info">{t("orders.total_count", { count: rows.length })}</StatusBadge>}
    >
      <OrderSecurityNotice />

      {rows.length === 0 ? (
        <EmptyState
          icon={<PackageIcon className="size-5" />}
          title={t("orders.no_orders_title")}
          body={t("orders.no_orders_body")}
          action={
            <Link
              to="/app/marketplace"
              className="inline-block h-10 px-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-900 font-semibold text-[12px] uppercase tracking-[0.14em] leading-10"
            >
              {t("orders.open_marketplace")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <LogisticsOrderCard
              key={r.id}
              id={r.id}
              status={r.status}
              createdAt={r.created_at}
              dealerName={r.dealer?.business_name ?? r.dealer?.full_name ?? null}
              marina={r.delivery_marina}
              vesselName={r.vessel?.boat_name ?? null}
              deliveryMethod={r.delivery_method}
              deliveryEtaMinutes={r.delivery_eta_minutes}
              deliveryLocationLabel={r.delivery_location_label}
              itemCount={r.items.length}
              total={Number(r.total)}
              currency={(n) => formatTL(n)}
              onOpen={() => setOpenId(r.id)}
            />
          ))}
        </div>
      )}

      {open && <OrderDetail order={open} onClose={() => setOpenId(null)} />}
    </MarketplaceShell>
  );
}

function OrderDetail({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="thalvo-dark w-full max-w-md rounded-3xl bg-[oklch(0.16_0.02_250)] border border-white/10 shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {t("orders.order_prefix")} · {order.id.slice(0, 6).toUpperCase()}
            </p>
            <p className="text-sm font-semibold text-white">
              {order.dealer?.business_name ?? order.dealer?.full_name ?? t("orders.dealer_fallback")}
            </p>
          </div>
          <FulfillmentStatusBadge status={order.status} />
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <OrderTimeline status={order.status} cancelled={order.status === "Cancelled"} />

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <Fact icon={<MapPin className="size-3.5" />} label={t("orders.field_marina")} value={order.delivery_marina ?? "—"} />
            <Fact icon={<Anchor className="size-3.5" />} label={t("orders.field_method")} value={t(labelKeyForDelivery(order.delivery_method))} />
            <Fact
              icon={<Clock className="size-3.5" />}
              label={t("orders.field_eta")}
              value={order.delivery_eta_minutes ? t("orders.eta_minutes", { min: order.delivery_eta_minutes }) : t("orders.eta_pending_word")}
            />
            <Fact
              icon={<PackageIcon className="size-3.5" />}
              label={t("orders.field_vessel")}
              value={order.vessel?.boat_name ?? "—"}
            />
          </div>

          {order.delivery_location_label && (
            <p className="text-[12px] text-white/70">
              <span className="text-white/40 uppercase tracking-[0.14em] text-[10px] mr-1.5">{t("orders.drop_off")}</span>
              {order.delivery_location_label}
            </p>
          )}

          <ul className="rounded-xl border border-white/10 divide-y divide-white/5 text-[12px]">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between p-2.5">
                <span className="text-white/80 truncate">
                  {it.qty}× {it.name_snapshot}
                </span>
                <span className="tabular-nums text-white/60">
                  {formatTL(Number(it.unit_price) * it.qty)}
                </span>
              </li>
            ))}
          </ul>

          {order.notes && (
            <p className="text-[12px] text-white/70">
              <span className="text-white/40 uppercase tracking-[0.14em] text-[10px] mr-1.5">{t("orders.your_notes")}</span>
              {order.notes}
            </p>
          )}

          {order.dealer_note && (
            <p className="text-[12px] text-emerald-100 bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-2.5">
              <span className="text-emerald-300 uppercase tracking-[0.14em] text-[10px] mr-1.5">{t("orders.dealer_note")}</span>
              {order.dealer_note}
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <span className="text-[11px] text-white/60">{t("orders.total")}</span>
            <MoneyAmount value={Number(order.total)} className="text-lg" />
          </div>

          <OrderSecurityNotice compact />
        </div>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full h-10 rounded-2xl bg-white/5 border border-white/10 text-white/80 text-[12px] uppercase tracking-[0.14em] hover:bg-white/10"
          >
            {t("orders.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
      <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
        <span className="text-white/50">{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-[12px] text-white truncate">{value}</p>
    </div>
  );
}
