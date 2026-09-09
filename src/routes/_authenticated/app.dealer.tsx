import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { useProfile, useSessionUser } from "@/lib/session";
import { formatTL } from "@/lib/filter";
import { MarketplaceShell } from "@/components/marketplace/MarketplaceShell";
import { DealerStockPanel, type DealerStockRow } from "@/components/marketplace/DealerStockPanel";
import { DealerOrderQueue, type DealerOrderRow } from "@/components/orders/DealerOrderQueue";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { Loader2, Plus, Store, X, Package } from "lucide-react";
import { toast } from "sonner";
import type { OrderStatus } from "@/lib/orders";
import { ImageUploader } from "@/components/ImageUploader";

export const Route = createFileRoute("/_authenticated/app/dealer")({
  ssr: false,
  component: DealerPage,
});

const BRANDS = ["Yamaha", "Volvo Penta", "Yanmar", "Mercury", "Suzuki", "Cummins", "MAN"];
// Stable enum values persisted in parts_catalog.category (text column).
// Labels are resolved via i18n at render time (dealer.categories.<value>).
const CATEGORY_VALUES = [
  "engine_parts", "outboard_parts", "inboard_parts", "propellers", "fuel_system",
  "electrical", "batteries", "navigation_electronics", "pumps", "steering_system",
  "anchoring", "deck_hardware", "safety_equipment", "plumbing", "paint_maintenance",
  "rib_inflatable_parts", "trailer_parts", "filters_oils", "accessories", "other",
] as const;
const CUSTOM_CATEGORY_SENTINEL = "__custom__";
// Values are enums for future logistics persistence — labels come from i18n at render time.
const DELIVERY_MODE_KEYS = ["marina_pickup", "service_boat"] as const;

interface Row {
  id: string; name: string; sku: string | null; brand: string; category: string;
  price: number; stock: number; marina: string | null; image_url: string | null;
  compatibility: string[] | null;
}

function DealerPage() {
  const { user, loading } = useSessionUser();
  const { profile, loading: pl } = useProfile(user?.id);
  if (loading || pl) return <ThalvoLoader />;
  if (!user || !profile) return null;
  const isDealer = profile.role === "Supplier";
  return (
    <AppShell userId={user.id}>
      {isDealer ? (
        <DealerConsole userId={user.id} businessName={profile.business_name} marina={profile.home_marina} />
      ) : (
        <NotDealer />
      )}
    </AppShell>
  );
}

function NotDealer() {
  const { t } = useTranslation();
  return (
    <MarketplaceShell eyebrow={t("dealer.eyebrow")} title={t("dealer.title")}>
      <GlassPanel className="text-center">
        <Store className="mx-auto size-8 text-white/40 mb-2" />
        <p className="text-sm text-white/70 font-semibold">{t("dealer.access_only_title")}</p>
        <p className="text-[12px] text-white/50 mt-1">{t("dealer.access_only_body")}</p>
      </GlassPanel>
    </MarketplaceShell>
  );
}

function DealerConsole({ userId, businessName, marina }: { userId: string; businessName: string | null; marina: string | null }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [orders, setOrders] = useState<DealerOrderRow[]>([]);
  const [tab, setTab] = useState<"orders" | "inventory">("orders");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(0);

  const load = () => supabase.from("parts_catalog").select("*").eq("supplier_id", userId).order("created_at", { ascending: false })
    .then(({ data }) => setRows((data as never) ?? []));
  const loadOrders = () =>
    supabase
      .from("part_orders")
      .select(
        "id,status,created_at,total,subtotal,commission,delivery_marina,delivery_method,delivery_eta_minutes,delivery_location_label,notes,dealer_note,items:part_order_items(id,qty,unit_price,name_snapshot)"
      )
      .eq("dealer_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const mapped = ((data as never as (DealerOrderRow & { status: string })[]) ?? []).map((o) => ({
          ...o,
          status: o.status as OrderStatus,
        }));
        setOrders(mapped);
      });
  useEffect(() => { void load(); void loadOrders(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  // Realtime — new orders for this dealer surface a toast + badge without reload.
  useEffect(() => {
    const channel = supabase
      .channel(`dealer-orders-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "part_orders", filter: `dealer_id=eq.${userId}` },
        () => {
          toast.success(t("dealer.new_order_toast_title"), {
            description: t("dealer.new_order_toast_body"),
          });
          setUnread((n) => n + 1);
          void loadOrders();
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Clear local unread when dealer is viewing the Orders tab.
  useEffect(() => { if (tab === "orders") setUnread(0); }, [tab]);


  const totalStock = rows.reduce((s, r) => s + r.stock, 0);
  const lowSkus = rows.filter((r) => r.stock > 0 && r.stock <= 3).length;
  const outSkus = rows.filter((r) => r.stock <= 0).length;

  const displayRows: DealerStockRow[] = rows.map((r) => ({
    id: r.id, name: r.name, brand: r.brand, category: r.category, sku: r.sku,
    price: Number(r.price), stock: r.stock, imageUrl: r.image_url,
    compatibility: r.compatibility, marina: r.marina,
  }));

  const adjustStock = async (row: DealerStockRow, delta: number) => {
    const target = Math.max(0, row.stock + delta);
    const { error } = await supabase.from("parts_catalog").update({ stock: target }).eq("id", row.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, stock: target } : r)));
  };

  const remove = async (row: DealerStockRow) => {
    if (!confirm(t("dealer.confirm_remove", { name: row.name }))) return;
    const { error } = await supabase.from("parts_catalog").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(t("dealer.sku_removed"));
    void load();
  };

  const edit = (row: DealerStockRow) => {
    const original = rows.find((r) => r.id === row.id);
    if (original) {
      setEditing(original);
      setShowForm(true);
    }
  };

  const activeOrders = orders.filter((o) =>
    ["Submitted", "DealerReview", "Paid", "Confirmed", "Preparing", "OutForDelivery"].includes(o.status)
  ).length;

  return (
    <MarketplaceShell
      eyebrow="THALVO · Dealer Console"
      title={businessName ?? "Inventory"}
      right={<StatusChip tone="info">{marina ?? "Marina not set"}</StatusChip>}
    >
      <div className="grid grid-cols-4 gap-2">
        <StatMini label="Active" value={String(activeOrders)} tone={activeOrders > 0 ? "warning" : "neutral"} />
        <StatMini label="SKUs" value={String(rows.length)} />
        <StatMini label="Units" value={String(totalStock)} />
        <StatMini label="Low / out" value={`${lowSkus} / ${outSkus}`} tone={lowSkus + outSkus > 0 ? "warning" : "neutral"} />
      </div>

      <div className="flex gap-1.5 -mx-1 px-1">
        <TabPill active={tab === "orders"} onClick={() => setTab("orders")} icon={<Package className="size-3.5" />} badge={unread > 0 ? (unread > 9 ? "9+" : String(unread)) : null}>
          Orders
        </TabPill>
        <TabPill active={tab === "inventory"} onClick={() => setTab("inventory")} icon={<Store className="size-3.5" />}>
          Inventory
        </TabPill>
      </div>


      {tab === "orders" ? (
        <DealerOrderQueue rows={orders} currency={(n) => formatTL(n)} onReload={() => void loadOrders()} />
      ) : (
        <>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="w-full h-11 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-900 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="size-4" /> Add spare part
          </button>

          <DealerStockPanel
            rows={displayRows}
            currencyFormat={(n) => formatTL(n)}
            onEdit={edit}
            onDelete={remove}
            onAdjustStock={adjustStock}
          />
        </>
      )}

      {showForm && (
        <PartForm
          existing={editing}
          userId={userId}
          defaultMarina={marina}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); void load(); }}
          busy={busy}
          setBusy={setBusy}
        />
      )}
    </MarketplaceShell>
  );

}

function StatMini({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warning" }) {
  return (
    <GlassPanel className="!p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className={"text-lg font-semibold mt-1 tabular-nums " + (tone === "warning" ? "text-amber-300" : "text-white")}>{value}</p>
    </GlassPanel>
  );
}

function TabPill({ active, onClick, icon, children, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode; badge?: string | null }) {
  return (
    <button
      onClick={onClick}
      className={
        "h-9 px-3 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] border transition-colors inline-flex items-center gap-1.5 " +
        (active
          ? "bg-sky-400 text-slate-900 border-sky-300"
          : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10")
      }
    >
      {icon}
      {children}
      {badge && (
        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}


function PartForm({
  existing, userId, defaultMarina, onClose, onSaved, busy, setBusy,
}: {
  existing: Row | null; userId: string; defaultMarina: string | null;
  onClose: () => void; onSaved: () => void; busy: boolean; setBusy: (b: boolean) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(existing?.name ?? "");
  const [brand, setBrand] = useState(existing?.brand ?? BRANDS[0]);
  const existingCategory = existing?.category ?? "";
  const isKnownCategory = (CATEGORY_VALUES as readonly string[]).includes(existingCategory);
  const [categoryChoice, setCategoryChoice] = useState<string>(
    existingCategory ? (isKnownCategory ? existingCategory : CUSTOM_CATEGORY_SENTINEL) : CATEGORY_VALUES[0]
  );
  const [customCategory, setCustomCategory] = useState<string>(
    existingCategory && !isKnownCategory ? existingCategory : ""
  );
  const [sku, setSku] = useState(existing?.sku ?? "");
  const [altSku, setAltSku] = useState("");
  const [compat, setCompat] = useState((existing?.compatibility ?? []).join(", "));
  const [price, setPrice] = useState(existing ? String(existing.price) : "");
  const [stock, setStock] = useState(existing ? String(existing.stock) : "1");
  const [marina, setMarina] = useState(existing?.marina ?? defaultMarina ?? "");
  const [image, setImage] = useState(existing?.image_url ?? "");
  const [deliveryMode, setDeliveryMode] = useState<string>(DELIVERY_MODE_KEYS[1]);
  // TODO(logistics): persist deliveryMode + altSku when parts_catalog has those columns.

  const save = async () => {
    if (!name || !price) return toast.error(t("dealer.name_price_required"));
    const resolvedCategory =
      categoryChoice === CUSTOM_CATEGORY_SENTINEL ? customCategory.trim() : categoryChoice;
    if (!resolvedCategory) return toast.error(t("dealer.name_price_required"));
    setBusy(true);
    const payload = {
      name, brand, category: resolvedCategory, sku: sku || null,
      compatibility: compat ? compat.split(",").map((s) => s.trim()).filter(Boolean) : null,
      price: Number(price), stock: Number(stock) || 0,
      marina: marina || null, image_url: image || null,
      supplier_id: userId, active: true,
    };
    const q = existing
      ? supabase.from("parts_catalog").update(payload).eq("id", existing.id)
      : supabase.from("parts_catalog").insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? t("dealer.sku_updated") : t("dealer.sku_added"));
    onSaved();
  };

  const deliveryLabel = (m: string) =>
    m === "marina_pickup" ? t("dealer.delivery_marina_pickup") : t("dealer.delivery_service_boat");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="thalvo-dark w-full max-w-md rounded-3xl bg-[oklch(0.18_0.02_250)] border border-white/10 shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <p className="text-sm font-semibold text-white">{existing ? t("dealer.edit_part") : t("dealer.add_part")}</p>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-lg text-white/60 hover:bg-white/10">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <Field label={t("dealer.field_name")}>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("dealer.field_brand")}>
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className={inputCls}>
                {BRANDS.map((b) => <option key={b} value={b} className="bg-slate-900">{b}</option>)}
              </select>
            </Field>
            <Field label={t("dealer.field_category")}>
              <select
                value={categoryChoice}
                onChange={(e) => setCategoryChoice(e.target.value)}
                className={inputCls}
              >
                {CATEGORY_VALUES.map((c) => (
                  <option key={c} value={c} className="bg-slate-900">
                    {t(`dealer.categories.${c}`)}
                  </option>
                ))}
                <option value={CUSTOM_CATEGORY_SENTINEL} className="bg-slate-900">
                  {t("dealer.custom_category")}
                </option>
              </select>
              {categoryChoice === CUSTOM_CATEGORY_SENTINEL && (
                <input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder={t("dealer.custom_category_placeholder")}
                  className={inputCls + " mt-2"}
                />
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("dealer.field_oem")}>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} />
            </Field>
            <Field label={t("dealer.field_alt")}>
              <input value={altSku} onChange={(e) => setAltSku(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label={t("dealer.field_compat")}>
            <input value={compat} onChange={(e) => setCompat(e.target.value)} placeholder="Yamaha F250, Volvo D2-75" className={inputCls} />
            <p className="text-[10px] text-white/40 mt-1">{t("dealer.field_compat_hint")}</p>
            {compat.trim() && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {compat.split(",").map((s) => s.trim()).filter(Boolean).map((chip, i) => (
                  <span
                    key={`${chip}-${i}`}
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("dealer.field_price")}>
              <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
            </Field>
            <Field label={t("dealer.field_stock")}>
              <input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label={t("dealer.field_marina")}>
            <input value={marina} onChange={(e) => setMarina(e.target.value)} className={inputCls} />
          </Field>
          <Field label={t("dealer.field_delivery")}>
            <select value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value)} className={inputCls}>
              {DELIVERY_MODE_KEYS.map((m) => <option key={m} value={m} className="bg-slate-900">{deliveryLabel(m)}</option>)}
            </select>
            <p className="text-[10px] text-white/40 mt-1">{t("dealer.delivery_hint")}</p>
          </Field>
          <Field label={t("dealer.field_image")}>
            <ImageUploader value={image} onChange={setImage} userId={userId} />
            <details className="mt-2">
              <summary className="text-[10px] uppercase tracking-[0.14em] text-white/40 cursor-pointer">
                {t("dealer.field_image_advanced", "Advanced: paste URL")}
              </summary>
              <input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://…"
                className={inputCls + " mt-2"}
              />
            </details>
          </Field>
        </div>
        <div className="p-4 border-t border-white/10 flex gap-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-white/10 text-white/70 text-sm font-semibold">{t("common.cancel")}</button>
          <button onClick={save} disabled={busy} className="flex-1 h-11 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-900 text-sm font-semibold inline-flex items-center justify-center gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {existing ? t("dealer.save") : t("dealer.add_sku")}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full h-10 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40 px-3 text-sm outline-none focus:border-sky-400/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50 mb-1">{label}</span>
      {children}
    </label>
  );
}
