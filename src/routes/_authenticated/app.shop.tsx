import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GEO_OPTIONS, getFix } from "@/lib/geolocation";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessionUser } from "@/lib/session";
import { harborDistanceKm } from "@/lib/filter";
import { useCart } from "@/lib/cart";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { Search, ShoppingCart, Package, MapPin, Store, Clock } from "lucide-react";
import { toast } from "sonner";
import { CockpitHeader } from "@/components/core/CockpitHeader";
import { StatusBadge } from "@/components/core/StatusBadge";
import { MoneyAmount } from "@/components/core/MoneyAmount";
import { EmptyState } from "@/components/core/EmptyState";
import { CartSheet } from "@/components/marketplace/CartSheet";


export const Route = createFileRoute("/_authenticated/app/shop")({
  ssr: false,
  component: ShopPage,
});

const BRANDS = ["Yamaha", "Volvo Penta", "Yanmar", "Mercury", "Suzuki"];
const CATEGORIES = ["Filters", "Impellers", "Oils", "Anodes", "Belts"];

interface Part {
  id: string; name: string; sku: string | null; brand: string; category: string;
  price: number; stock: number; marina: string | null; image_url: string | null;
  marina_lat: number | null; marina_lng: number | null;
  supplier: { business_name: string | null; full_name: string; home_marina: string | null; home_lat: number | null; home_lng: number | null } | null;
}

function ShopPage() {
  const { user, loading } = useSessionUser();
  if (loading) return <ThalvoLoader />;
  if (!user) return null;
  return (
    <AppShell userId={user.id}>
      <Shop />
    </AppShell>
  );
}

function Shop() {
  const { t } = useTranslation();
  const [parts, setParts] = useState<Part[]>([]);
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const cart = useCart();

  const loadParts = () => {
    supabase.from("parts_catalog")
      .select("*, supplier:profiles!supplier_id(business_name, full_name, home_marina, home_lat, home_lng)")
      .eq("active", true).order("created_at", { ascending: false })
      .then(({ data }) => setParts((data as never) ?? []));
  };

  useEffect(() => {
    loadParts();
    void getFix(GEO_OPTIONS).then((res) => {
      if (res.ok) setMe({ lat: res.fix.lat, lng: res.fix.lng });
    });
  }, []);

  const filtered = useMemo(() => {
    return parts.filter((p) => {
      if (brand && p.brand !== brand) return false;
      if (category && p.category !== category) return false;
      if (q) {
        const s = q.toLowerCase();
        return p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.brand.toLowerCase().includes(s);
      }
      return true;
    });
  }, [parts, brand, category, q]);

  const etaFor = (p: Part) => {
    const sLat = p.supplier?.home_lat ?? p.marina_lat;
    const sLng = p.supplier?.home_lng ?? p.marina_lng;
    if (!me || sLat == null || sLng == null) return null;
    const km = harborDistanceKm(me.lat, me.lng, Number(sLat), Number(sLng));
    if (km == null) return null;
    // ~25 km/h service boat + 10min prep
    const mins = Math.max(15, Math.round((km / 25) * 60) + 10);
    return { km, mins };
  };

  return (
    <div className="space-y-4">
      <CockpitHeader
        eyebrow="THALVO · Marketplace"
        title={t("shop.title")}
        subtitle={t("shop.subtitle")}
        actions={
          <button onClick={() => setCartOpen(true)}
            className="relative size-11 grid place-items-center rounded-2xl bg-sky-500/20 border border-sky-400/40 text-sky-100 hover:bg-sky-500/30 transition-colors">
            <ShoppingCart className="size-5" />
            {cart.count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full amber-gradient text-warning-foreground text-[10px] font-black grid place-items-center">
                {cart.count}
              </span>
            )}
          </button>
        }
      />

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("shop.search")}
          className="w-full h-11 pl-9 pr-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 text-sm outline-none focus:border-sky-400/60" />
      </div>

      <div className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain no-scrollbar pb-1">
        <Pill active={!brand} onClick={() => setBrand("")}>{t("shop.all_brands")}</Pill>
        {BRANDS.map((b) => <Pill key={b} active={brand === b} onClick={() => setBrand(brand === b ? "" : b)}>{b}</Pill>)}
      </div>
      <div className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain no-scrollbar pb-1">
        <Pill active={!category} onClick={() => setCategory("")}>{t("shop.all_categories")}</Pill>
        {CATEGORIES.map((c) => <Pill key={c} active={category === c} onClick={() => setCategory(category === c ? "" : c)}>{c}</Pill>)}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-panel rounded-2xl">
          <EmptyState
            icon={<Package className="size-4" />}
            title={t("shop_cart.no_parts_title")}
            body={t("shop_cart.no_parts_body")}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => {
            const eta = etaFor(p);
            const supplierName = p.supplier?.business_name || p.supplier?.full_name || t("shop.local_supplier");
            const supplierMarina = p.supplier?.home_marina ?? p.marina ?? "—";
            return (
              <article key={p.id}
                className="glass-panel rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-24 object-cover" />}
                <div className="p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/80">{p.brand}</p>
                  <p className="text-sm font-semibold text-white line-clamp-2 leading-tight">{p.name}</p>

                  <div className="pt-1 space-y-0.5 border-t border-white/10">
                    <p className="text-[10px] text-white/70 inline-flex items-center gap-1 truncate max-w-full">
                      <Store className="size-3 shrink-0" /> <span className="truncate">{supplierName}</span>
                    </p>
                    <p className="text-[10px] text-white/40 inline-flex items-center gap-1 truncate max-w-full">
                      <MapPin className="size-3 shrink-0" /> <span className="truncate">{supplierMarina}</span>
                    </p>
                    {eta && (
                      <StatusBadge tone="warning" icon={<Clock className="size-3" />}>
                        {eta.mins} {t("common.min")} · {eta.km.toFixed(0)} {t("common.km")}
                      </StatusBadge>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <MoneyAmount value={Number(p.price)} className="text-sm" />
                    <StatusBadge tone={p.stock > 0 ? "success" : "danger"}>
                      {p.stock > 0 ? t("shop.in_stock") : t("shop.out_of_stock")}
                    </StatusBadge>
                  </div>
                  <button disabled={p.stock === 0}
                    onClick={() => { cart.add({ part_id: p.id, name: p.name, price: Number(p.price), image_url: p.image_url, brand: p.brand }); toast.success(t("shop.add_to_cart")); }}
                    className="mt-1 w-full h-9 rounded-xl amber-gradient text-warning-foreground text-xs font-black uppercase tracking-wider disabled:opacity-40">
                    {t("shop.add_to_cart")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}


      {cartOpen && <CartSheet onClose={() => setCartOpen(false)} onCatalogReload={loadParts} />}
    </div>
  );
}


function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={"shrink-0 px-4 h-9 rounded-full text-xs font-black uppercase tracking-wider border " +
      (active ? "marine-gradient text-white border-transparent" : "bg-card text-foreground border-border")}>
      {children}
    </button>
  );
}



