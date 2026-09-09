import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { CheckoutModal } from "@/components/CheckoutModal";
import { formatTL } from "@/lib/filter";
import { useCart } from "@/lib/cart";
import { Trash2, Plus, Minus, Package } from "lucide-react";
import { DeliveryMethodSelector } from "@/components/orders/DeliveryMethodSelector";
import { OrderSecurityNotice } from "@/components/orders/OrderSecurityNotice";
import { toast } from "sonner";
import { emitEvent } from "@/lib/events";
import { sanitizeMultiline, sanitizePlainText } from "@/lib/sanitize";

interface Props {
  onClose: () => void;
  /** Called after an OUT_OF_STOCK checkout error so callers can refetch. */
  onCatalogReload?: () => void;
}

/**
 * CartSheet — shared marketplace cart drawer. Extracted from app.shop.tsx.
 * Behavior, styling, and checkout logic are unchanged.
 */
export function CartSheet({ onClose, onCatalogReload }: Props) {
  const { t } = useTranslation();
  const cart = useCart();
  const [marina, setMarina] = useState("Göcek");
  const [pay, setPay] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"marina_pickup" | "service_boat">("service_boat");
  const [dropOff, setDropOff] = useState("");
  const [notes, setNotes] = useState("");
  const [vessels, setVessels] = useState<{ id: string; boat_name: string | null }[]>([]);
  const [vesselId, setVesselId] = useState<string>("");
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase.from("vessels").select("id, boat_name:name").eq("owner_id", uid).then(({ data: v }) => {
        const rows = (v as never as { id: string; boat_name: string | null }[]) ?? [];
        setVessels(rows);
        if (rows[0]) setVesselId(rows[0].id);
      });
    });
  }, []);

  const etaMinutes = deliveryMethod === "marina_pickup" ? 30 : 90;

  const doCheckout = async () => {
    const { data, error } = await supabase.rpc("checkout_parts_cart", {
      _items: cart.items.map((i) => ({ part_id: i.part_id, qty: i.qty })),
      _delivery_marina: sanitizePlainText(marina, 80),
      _vessel_id: vesselId || null,
      _delivery_method: deliveryMethod,
      _delivery_eta_minutes: etaMinutes,
      _delivery_location_label: sanitizePlainText(dropOff, 120) || null,
      _notes: sanitizeMultiline(notes, 500) || null,
    });
    if (error) {
      if (/OUT_OF_STOCK/i.test(error.message)) {
        toast.error(t("shop.out_of_stock_toast"));
        onCatalogReload?.();
      } else {
        toast.error(error.message);
      }
      return;
    }
    const newOrderId = (data as string | null) ?? null;
    emitEvent({
      type: "order.submitted",
      subject_type: "order",
      subject_id: newOrderId,
      metadata: {
        item_count: cart.items.length,
        delivery_method: deliveryMethod,
        marina,
      },
    });
    cart.clear();
    toast.success(t("shop.order_placed"));
    setPay(false);
    setPlacedOrderId(newOrderId ?? "new");
  };

  if (placedOrderId) {
    return (
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="thalvo-dark w-full max-w-md rounded-3xl bg-[oklch(0.18_0.02_250)] border border-white/10 shadow-2xl p-6 space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-lg font-semibold text-white tracking-tight">{t("shop_cart.order_submitted")}</p>
          <p className="text-sm text-white/60 leading-relaxed">{t("shop_cart.order_submitted_body")}</p>
          <a href="/app/orders" className="block w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-900 text-sm font-semibold tracking-tight grid place-items-center transition-colors">
            {t("shop_cart.open_order_tracking")}
          </a>
          <button onClick={onClose} className="text-xs text-white/50 hover:text-white/70">{t("common.close")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="thalvo-dark flex max-h-[90dvh] w-full flex-col rounded-t-3xl border border-cyan-500/20 bg-[oklch(0.18_0.02_250)] shadow-2xl sm:mx-auto sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">{t("shop_cart.header_eyebrow")}</p>
            <p className="mt-0.5 text-base font-semibold text-white tracking-tight">{t("shop.cart")}</p>
          </div>
          <button onClick={onClose} className="text-xs text-white/50 hover:text-white/80 px-2 py-1">
            {t("common.close")}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {cart.items.length === 0 ? (
            <p className="text-center text-sm text-white/50 py-12">{t("shop.empty_cart")}</p>
          ) : (
            <>
              <ul className="space-y-2">
                {cart.items.map((i) => (
                  <li key={i.part_id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    {i.image_url ? (
                      <img src={i.image_url} alt="" className="size-14 rounded-xl object-cover border border-white/10" />
                    ) : (
                      <div className="size-14 rounded-xl border border-white/10 bg-white/5 grid place-items-center">
                        <Package className="size-5 text-white/30" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate leading-tight">{i.name}</p>
                      <p className="mt-0.5 text-xs text-white/50 tabular-nums">{formatTL(i.price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => cart.setQty(i.part_id, i.qty - 1)}
                        className="size-8 grid place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-white tabular-nums">{i.qty}</span>
                      <button
                        onClick={() => cart.setQty(i.part_id, i.qty + 1)}
                        className="size-8 grid place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => cart.remove(i.part_id)}
                      aria-label={t("common.remove")}
                      className="size-8 grid place-items-center rounded-full text-white/40 hover:text-rose-300 hover:bg-white/5 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">{t("shop_cart.delivery_method")}</label>
                  <div className="mt-2">
                    <DeliveryMethodSelector value={deliveryMethod} onChange={setDeliveryMethod} />
                  </div>
                </div>

                {vessels.length > 0 && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">{t("shop_cart.destination_vessel")}</label>
                    <select value={vesselId} onChange={(e) => setVesselId(e.target.value)}
                      className="mt-1.5 w-full h-11 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 outline-none focus:border-sky-400/60">
                      {vessels.map((v) => (
                        <option key={v.id} value={v.id} className="bg-slate-900">{v.boat_name ?? t("shop_cart.vessel_fallback")}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">{t("shop_cart.marina")}</label>
                  <input value={marina} onChange={(e) => setMarina(e.target.value)}
                    className="mt-1.5 w-full h-11 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 outline-none focus:border-sky-400/60" />
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    {deliveryMethod === "marina_pickup" ? t("shop_cart.pickup_point") : t("shop_cart.berth_label")}
                  </label>
                  <input value={dropOff} onChange={(e) => setDropOff(e.target.value)}
                    placeholder={deliveryMethod === "marina_pickup" ? t("shop_cart.pickup_placeholder") : t("shop_cart.berth_placeholder")}
                    className="mt-1.5 w-full h-11 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 placeholder:text-white/30 outline-none focus:border-sky-400/60" />
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">{t("shop_cart.operational_notes")}</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    placeholder={t("shop_cart.notes_placeholder")}
                    className="mt-1.5 w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm p-3 placeholder:text-white/30 outline-none focus:border-sky-400/60" />
                </div>

                <OrderSecurityNotice compact />
              </div>
            </>
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="border-t border-white/10 bg-[oklch(0.16_0.02_250)] px-5 py-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>{t("shop_cart.eta")}</span>
              <span className="tabular-nums">~{etaMinutes} {t("common.min")}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">{t("common.amount")}</span>
              <span className="text-2xl font-semibold text-white tabular-nums tracking-tight">{formatTL(cart.total)}</span>
            </div>
            <button
              onClick={() => setPay(true)}
              className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-900 text-sm font-semibold tracking-tight transition-colors"
            >
              {t("shop_cart.confirm_order")}
            </button>
            <p className="text-[10px] text-white/40 text-center leading-relaxed">{t("shop.commission_note")}</p>
          </div>
        )}
        {pay && (
          <CheckoutModal open amount={cart.total} title={t("shop.checkout")} subtitle={marina} tone="amber"
            cta={t("shop.checkout")} onClose={() => setPay(false)} onPaid={doCheckout} />
        )}
      </div>
    </div>
  );
}
