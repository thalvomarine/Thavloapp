import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { useProfile, useSessionUser } from "@/lib/session";
import { formatTL, harborDistanceKm } from "@/lib/filter";
import { useCart } from "@/lib/cart";
import { MarketplaceShell } from "@/components/marketplace/MarketplaceShell";
import { PartCard, type PartCardData } from "@/components/marketplace/PartCard";
import { CartSheet } from "@/components/marketplace/CartSheet";
import { FloatingCartBar } from "@/components/marketplace/FloatingCartBar";
import { BoatsTendersBoard } from "@/components/marketplace/BoatsTendersBoard";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { GEO_OPTIONS, getFix, type GeoFailure } from "@/lib/geolocation";
import { askThalvoAi } from "@/lib/thalvo-ai.functions";
import { CreateBoatListingSheet } from "@/components/marketplace/CreateBoatListingSheet";
import {
  loadUserBoatListings,
  persistUserBoatListings,
  type BoatListing,
} from "@/lib/boat-listings";
import { Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/marketplace")({
  ssr: false,
  component: MarketplacePage,
});

const CATEGORY_TO_PROBLEM: Record<string, string[]> = {
  Filters: ["Motor arıza", "Fuel"],
  Impellers: ["Impeller", "Pompa"],
  Oils: ["Motor", "Yağ"],
  Anodes: ["Anot", "Korozyon"],
  Belts: ["Kayış", "Belt"],
};

interface Part {
  id: string; name: string; sku: string | null; brand: string; category: string;
  price: number; stock: number; marina: string | null; image_url: string | null;
  marina_lat: number | null; marina_lng: number | null; compatibility: string[] | null;
  supplier: { business_name: string | null; full_name: string; home_marina: string | null; home_lat: number | null; home_lng: number | null } | null;
}

function MarketplacePage() {
  const { user, loading } = useSessionUser();
  if (loading) return <ThalvoLoader />;
  if (!user) return null;
  return (
    <AppShell userId={user.id}>
      <Marketplace userId={user.id} />
    </AppShell>
  );
}

function Marketplace({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { profile } = useProfile(userId);
  const [parts, setParts] = useState<Part[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geoFailure, setGeoFailure] = useState<GeoFailure | null>(null);
  const [vessel, setVessel] = useState<{ engine_model: string | null; vessel_type: string | null } | null>(null);
  const [activeSosCategories, setActiveSosCategories] = useState<string[]>([]);
  const [aiTarget, setAiTarget] = useState<Part | null>(null);
  const [marketCategory, setMarketCategory] = useState<MarketCategory>("boats");
  const [cartOpen, setCartOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [userBoats, setUserBoats] = useState<BoatListing[]>(() => loadUserBoatListings());
  const cart = useCart();

  const loadParts = () => {
    supabase.from("parts_catalog")
      .select("*, supplier:profiles!supplier_id(business_name, full_name, home_marina, home_lat, home_lng)")
      .eq("active", true).order("created_at", { ascending: false })
      .then(({ data }) => setParts((data as never) ?? []));
  };


  useEffect(() => {
    loadParts();

    supabase.from("vessels").select("engine_model, vessel_type").eq("owner_id", userId).limit(1).maybeSingle()
      .then(({ data }) => setVessel((data as never) ?? null));
    // Active SOS-derived categories — flag parts that may resolve open missions.
    supabase.from("jobs").select("problem_category, status").eq("client_id", userId)
      .in("status", ["Pending", "Accepted", "EnRoute", "OnSite", "PartsPending", "InProgress"])
      .then(({ data }) => setActiveSosCategories(((data as never[]) ?? []).map((j: { problem_category: string }) => j.problem_category)));
    void getFix(GEO_OPTIONS).then((res) => {
      if (res.ok) setMe({ lat: res.fix.lat, lng: res.fix.lng });
      else setGeoFailure(res.failure);
    });
  }, [userId]);

  const categories = useMemo(() => {
    const set = new Set(parts.map((p) => p.category));
    return Array.from(set);
  }, [parts]);

  const isEmergencyPart = (p: Part) => {
    const problems = CATEGORY_TO_PROBLEM[p.category] ?? [];
    return activeSosCategories.some((sos) => problems.some((needle) => sos.toLowerCase().includes(needle.toLowerCase())));
  };

  const categoryLabel = (raw: string): string => {
    const key = `dealer.categories.${raw}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
    // Fallback: prettify snake_case / kebab-case → Title Case
    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || raw;
  };

  const enriched: PartCardData[] = useMemo(() => {
    return parts
      .filter((p) => {
        if (category && p.category !== category) return false;
        if (q) {
          const s = q.toLowerCase();
          return p.name.toLowerCase().includes(s) || p.brand.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || (p.compatibility ?? []).some((c) => c.toLowerCase().includes(s));
        }
        return true;
      })
      .map((p) => {
        const sLat = p.supplier?.home_lat ?? p.marina_lat;
        const sLng = p.supplier?.home_lng ?? p.marina_lng;
        const km = me && sLat != null && sLng != null ? harborDistanceKm(me.lat, me.lng, Number(sLat), Number(sLng)) : null;
        const mins = km != null ? Math.max(15, Math.round((km / 25) * 60) + 10) : null;
        // If dealer is at same marina as captain, offer pickup mode.
        const sameMarina = km != null && km < 0.5;
        return {
          id: p.id, name: p.name, brand: p.brand, category: p.category, sku: p.sku,
          categoryLabel: categoryLabel(p.category),
          imageUrl: p.image_url, price: Number(p.price), stock: p.stock,
          compatibility: p.compatibility,
          dealerName: p.supplier?.business_name ?? p.supplier?.full_name ?? null,
          dealerVerified: true,
          marina: p.marina ?? p.supplier?.home_marina,
          deliveryMode: sameMarina ? "marina_pickup" : "service_boat",
          deliveryMinutes: mins,
          distanceKm: km,
          emergencyCompatible: isEmergencyPart(p),
        } satisfies PartCardData;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, category, q, me, activeSosCategories, t]);


  const addToCart = (p: PartCardData) => {
    cart.add({ part_id: p.id, name: p.name, price: p.price, image_url: p.imageUrl ?? null, brand: p.brand });
    toast.success(t("marketplace.added_to_cart", { name: p.name }));
  };

  const notifyMe = (p: PartCardData) => {
    toast.success(t("marketplace.product.notify_toast", { name: p.name }));
  };

  return (
    <MarketplaceShell
      eyebrow={t("marketplace.eyebrow")}
      title={t("marketplace.title")}
      right={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMarketCategory("boats");
              setCreateOpen(true);
            }}
            className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-cyan-400 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-900 shadow-[0_0_18px_rgba(0,240,255,0.25)]"
          >
            <Plus className="size-4 shrink-0" />
            {t("boats.create_listing")}
          </button>
          {marketCategory === "spare_parts" && (
            <StatusChip tone={me ? "info" : geoFailure ? "warning" : "neutral"}>
              {me
                ? `${profile?.home_marina ?? t("marketplace.vessel_fallback")}`
                : geoFailure
                  ? t(geoFailure.messageKey, { defaultValue: geoFailure.defaultMessage })
                  : t("marketplace.locating")}
            </StatusChip>
          )}
        </div>
      }
    >
      <MarketCategoryBar active={marketCategory} onSelect={setMarketCategory} />

      {marketCategory === "boats" ? (
        <BoatsTendersBoard extraListings={userBoats} />
      ) : (
        <>
          {activeSosCategories.length > 0 && (
            <GlassPanel className="!p-3 flex items-center gap-2">
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-70" />
                <span className="relative size-1.5 rounded-full bg-rose-400" />
              </span>
              <p className="text-[11px] text-white/70">
                {t("marketplace.sos_banner", { tag: "§§TAG§§" }).split("§§TAG§§").flatMap((chunk, i, arr) => [
                  chunk,
                  i < arr.length - 1 ? <span key={i} className="text-rose-300 font-semibold">{t("marketplace.sos_tag")}</span> : null,
                ])}
              </p>
            </GlassPanel>
          )}

          <GlassPanel className="!p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("marketplace.search_placeholder")}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40 text-sm outline-none focus:border-sky-400/60"
              />
            </div>
            <div className="flex w-full min-w-0 max-w-full gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar">
              <FilterPill active={category === ""} onClick={() => setCategory("")}>{t("marketplace.all_categories")}</FilterPill>
              {categories.map((c) => (
                <FilterPill key={c} active={category === c} onClick={() => setCategory(c)}>{categoryLabel(c)}</FilterPill>
              ))}
            </div>
          </GlassPanel>

          {enriched.length === 0 ? (
            <GlassPanel className="text-center">
              <p className="text-sm text-white/60">{t("marketplace.no_parts_match")}</p>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 gap-3 pb-24">
              {enriched.map((p) => (
                <PartCard
                  key={p.id}
                  part={p}
                  vesselEngine={vessel?.engine_model}
                  vesselType={vessel?.vessel_type}
                  currencyFormat={(n) => formatTL(n)}
                  onAdd={addToCart}
                  onNotify={notifyMe}
                  onAskAi={() => setAiTarget(parts.find((x) => x.id === p.id) ?? null)}
                />
              ))}
            </div>
          )}

          {aiTarget && (
            <AiPartSheet
              part={aiTarget}
              vesselEngine={vessel?.engine_model ?? null}
              vesselType={vessel?.vessel_type ?? null}
              onClose={() => setAiTarget(null)}
            />
          )}
        </>
      )}

      <FloatingCartBar onOpen={() => setCartOpen(true)} />
      {cartOpen && <CartSheet onClose={() => setCartOpen(false)} onCatalogReload={loadParts} />}
      <CreateBoatListingSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        sellerName={profile?.full_name?.trim() || t("boats.private_seller")}
        listingCount={userBoats.length}
        onCreated={(listing) => {
          setUserBoats((prev) => {
            const next = [listing, ...prev];
            persistUserBoatListings(next);
            return next;
          });
        }}
      />
    </MarketplaceShell>
  );
}


type MarketCategory = "boats" | "spare_parts";

const MARKET_CATEGORIES: MarketCategory[] = ["boats", "spare_parts"];

function MarketCategoryBar({ active, onSelect }: { active: MarketCategory; onSelect: (c: MarketCategory) => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="grid w-full min-w-0 max-w-full grid-cols-2 gap-1.5"
      role="tablist"
      aria-label={t("marketplace.category.label")}
    >
      {MARKET_CATEGORIES.map((c) => {
        const selected = c === active;
        return (
          <button
            key={c}
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(c)}
            className={
              "h-10 px-2.5 rounded-xl text-[11px] font-semibold leading-tight border transition-colors " +
              (selected
                ? "bg-white text-slate-900 border-white shadow-sm"
                : "bg-white/5 border-white/10 text-white/75 hover:bg-white/10")
            }
          >
            {t(`marketplace.category.${c}`)}
          </button>
        );
      })}
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] border transition-colors " +
        (active ? "bg-sky-400 text-slate-900 border-sky-300" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10")
      }
    >
      {children}
    </button>
  );
}

function AiPartSheet({ part, vesselEngine, vesselType, onClose }: { part: Part; vesselEngine: string | null; vesselType: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const ask = useServerFn(askThalvoAi);
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const run = async () => {
      try {
        const compat = (part.compatibility ?? []).join(", ") || "universal";
        const vessel = [vesselType, vesselEngine].filter(Boolean).join(" · ") || "not provided";
        const prompt = `Marketplace part: ${part.brand} ${part.name} (OEM ${part.sku ?? "n/a"}), category ${part.category}, listed compatibility: ${compat}. Captain's vessel: ${vessel}.
Answer in three short bullets (max 2 sentences each):
1) What this part does.
2) Which marine problem it may solve.
3) Whether it likely fits the captain's vessel (if data suggests otherwise, say so plainly).`;
        const res = await ask({ data: { messages: [{ role: "user", content: prompt }], lang: i18n.resolvedLanguage?.startsWith("tr") ? "tr" : "en" } });
        setText(res.text);
      } catch {
        setText(t("marketplace.ai_unavailable"));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [part.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="thalvo-dark w-full max-w-md rounded-3xl bg-[oklch(0.18_0.02_250)] border border-white/10 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 flex items-start justify-between gap-3 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="size-8 rounded-lg bg-sky-400/15 border border-sky-400/30 grid place-items-center text-sky-300">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">{t("marketplace.ai_thalvo")}</p>
              <p className="text-sm font-semibold text-white truncate">{part.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-lg text-white/60 hover:bg-white/10">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4 min-h-[140px]">
          {loading ? (
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Loader2 className="size-4 animate-spin" /> {t("marketplace.ai_consulting")}
            </div>
          ) : (
            <p className="text-[13px] text-white/85 whitespace-pre-wrap leading-relaxed">{text}</p>
          )}
        </div>
      </div>
    </div>
  );
}
