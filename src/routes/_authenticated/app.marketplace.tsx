import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSessionUser } from "@/lib/session";
import { formatTL, harborDistanceKm } from "@/lib/filter";
import { useCart } from "@/lib/cart";
import { MarketplaceShell } from "@/components/marketplace/MarketplaceShell";
import { type PartCardData } from "@/components/marketplace/PartCard";
import { CartSheet } from "@/components/marketplace/CartSheet";
import { FloatingCartBar } from "@/components/marketplace/FloatingCartBar";
import { BoatsTendersBoard } from "@/components/marketplace/BoatsTendersBoard";
import { PartsCatalogBoard } from "@/components/marketplace/PartsCatalogBoard";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { GEO_OPTIONS, getFix, type GeoFailure } from "@/lib/geolocation";
import { askThalvoAi } from "@/lib/thalvo-ai.functions";
import { CreateBoatListingSheet } from "@/components/marketplace/CreateBoatListingSheet";
import {
  loadSharedBoatListings,
  saveBoatListing,
  setBoatListingStatus,
  type BoatListing,
} from "@/lib/boat-listings";
import { Loader2, Plus, Sparkles, X } from "lucide-react";
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
  filters_oils: ["Motor arıza", "Fuel", "Motor", "Yağ"],
  pumps: ["Impeller", "Pompa"],
  fuel_system: ["Motor arıza", "Fuel"],
  engine_parts: ["Motor", "Impeller"],
  outboard_parts: ["Motor", "Impeller"],
  inboard_parts: ["Motor"],
  electrical: ["Elektrik"],
  batteries: ["Elektrik", "Akü"],
  safety_equipment: ["Güvenlik"],
};

interface Part {
  id: string;
  name: string;
  sku: string | null;
  brand: string;
  category: string;
  price: number;
  stock: number;
  marina: string | null;
  image_url: string | null;
  marina_lat: number | null;
  marina_lng: number | null;
  compatibility: string[] | null;
  created_at?: string | null;
  supplier: {
    business_name: string | null;
    full_name: string;
    home_marina: string | null;
    home_lat: number | null;
    home_lng: number | null;
  } | null;
}

function MarketplacePage() {
  const routeUser = Route.useRouteContext().user;
  const { user: sessionUser } = useSessionUser();
  const user = sessionUser ?? routeUser;
  if (!user) return null;
  return <Marketplace userId={user.id} />;
}

function Marketplace({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { profile } = useProfile(userId);
  const [parts, setParts] = useState<Part[]>([]);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geoFailure, setGeoFailure] = useState<GeoFailure | null>(null);
  const [vessel, setVessel] = useState<{ engine_model: string | null; vessel_type: string | null } | null>(null);
  const [activeSosCategories, setActiveSosCategories] = useState<string[]>([]);
  const [aiTarget, setAiTarget] = useState<Part | null>(null);
  const [marketCategory, setMarketCategory] = useState<MarketCategory>("boats");
  const [cartOpen, setCartOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingBoat, setEditingBoat] = useState<BoatListing | null>(null);
  const [userBoats, setUserBoats] = useState<BoatListing[]>([]);

  const reloadBoats = () => {
    void loadSharedBoatListings(userId)
      .then((rows) => setUserBoats(rows))
      .catch((error: unknown) => {
        console.warn("[market] boat_listings unavailable", error);
        setUserBoats([]);
      });
  };

  useEffect(() => {
    reloadBoats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const cart = useCart();

  const loadParts = () => {
    supabase
      .from("parts_catalog")
      .select("*, supplier:profiles!supplier_id(business_name, full_name, home_marina, home_lat, home_lng)")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.warn("[market] parts_catalog unavailable", error.message);
        setParts((data as never) ?? []);
      });
  };

  useEffect(() => {
    loadParts();

    supabase
      .from("vessels")
      .select("engine_model, vessel_type")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setVessel((data as never) ?? null));

    supabase
      .from("jobs")
      .select("problem_category, status")
      .eq("client_id", userId)
      .in("status", ["Pending", "Accepted", "EnRoute", "OnSite", "PartsPending", "InProgress"])
      .then(({ data, error }) => {
        if (error) {
          console.warn("[market] jobs unavailable", error.message);
          setActiveSosCategories([]);
          return;
        }
        setActiveSosCategories(((data as never[]) ?? []).map((j: { problem_category: string }) => j.problem_category));
      });

    void getFix(GEO_OPTIONS).then((res) => {
      if (res.ok) setMe({ lat: res.fix.lat, lng: res.fix.lng });
      else setGeoFailure(res.failure);
    });
  }, [userId]);

  const isEmergencyPart = (p: Part) => {
    const problems = CATEGORY_TO_PROBLEM[p.category] ?? [];
    return activeSosCategories.some((sos) =>
      problems.some((needle) => sos.toLowerCase().includes(needle.toLowerCase())),
    );
  };

  const categoryLabel = (raw: string): string => {
    const key = `dealer.categories.${raw}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || raw;
  };

  const enriched: PartCardData[] = useMemo(() => {
    return parts.map((p) => {
      const sLat = p.supplier?.home_lat ?? p.marina_lat;
      const sLng = p.supplier?.home_lng ?? p.marina_lng;
      const km =
        me && sLat != null && sLng != null
          ? harborDistanceKm(me.lat, me.lng, Number(sLat), Number(sLng))
          : null;
      const mins = km != null ? Math.max(15, Math.round((km / 25) * 60) + 10) : null;
      const sameMarina = km != null && km < 0.5;
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        sku: p.sku,
        categoryLabel: categoryLabel(p.category),
        imageUrl: p.image_url,
        price: Number(p.price),
        stock: p.stock,
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
  }, [parts, me, activeSosCategories, t]);

  const addToCart = (p: PartCardData) => {
    cart.add({ part_id: p.id, name: p.name, price: p.price, image_url: p.imageUrl ?? null, brand: p.brand });
    toast.success(t("marketplace.added_to_cart", { name: p.name }));
  };

  const notifyMe = (p: PartCardData) => {
    toast.success(t("marketplace.product.notify_toast", { name: p.name }));
  };

  const sosBanner =
    activeSosCategories.length > 0 ? (
      <GlassPanel className="!p-3 flex items-center gap-2">
        <span className="relative flex size-1.5">
          <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-70" />
          <span className="relative size-1.5 rounded-full bg-rose-400" />
        </span>
        <p className="text-[11px] text-white/70">
          {t("marketplace.sos_banner", { tag: "§§TAG§§" })
            .split("§§TAG§§")
            .flatMap((chunk, i, arr) => [
              chunk,
              i < arr.length - 1 ? (
                <span key={i} className="text-rose-300 font-semibold">
                  {t("marketplace.sos_tag")}
                </span>
              ) : null,
            ])}
        </p>
      </GlassPanel>
    ) : null;

  return (
    <MarketplaceShell
      eyebrow={t("marketplace.eyebrow")}
      title={t("marketplace.title")}
      right={
        marketCategory === "boats" ? (
          <button
            type="button"
            onClick={() => {
              setEditingBoat(null);
              setCreateOpen(true);
            }}
            className="inline-flex h-11 min-w-0 w-full items-center justify-center gap-1.5 rounded-xl bg-[color:var(--mos-amber,#F5B942)] px-4 text-[13px] font-semibold text-[#0A192F] sm:w-auto"
          >
            <Plus className="size-4 shrink-0" />
            {t("boats.create_listing")}
          </button>
        ) : undefined
      }
      banner={
        !me ? (
          <div
            role="status"
            className="w-full min-w-0 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] font-semibold leading-snug text-amber-200"
          >
            {geoFailure
              ? t(geoFailure.messageKey, { defaultValue: geoFailure.defaultMessage })
              : t("marketplace.locating")}
          </div>
        ) : null
      }
    >
      <MarketCategoryBar active={marketCategory} onSelect={setMarketCategory} />

      {marketCategory === "boats" ? (
        <BoatsTendersBoard
          extraListings={userBoats}
          ownerId={userId}
          onEdit={(boat) => {
            setCreateOpen(false);
            setEditingBoat(boat);
          }}
          onSetStatus={(id, status) => {
            setUserBoats((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
            void setBoatListingStatus(id, userId, status).catch((error: unknown) => {
              console.warn("[market] boat status update failed", error);
              toast.error(t("boats.save_failed"));
              reloadBoats();
            });
          }}
        />
      ) : (
        <>
          <PartsCatalogBoard
            parts={enriched}
            rawParts={parts}
            currencyFormat={(n) => formatTL(n)}
            onAdd={addToCart}
            onNotify={notifyMe}
            onAskAi={(p) => setAiTarget(parts.find((x) => x.id === p.id) ?? null)}
            banner={sosBanner}
          />

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

      {marketCategory === "spare_parts" && !cartOpen && (
        <FloatingCartBar onOpen={() => setCartOpen(true)} />
      )}
      {cartOpen && <CartSheet onClose={() => setCartOpen(false)} onCatalogReload={loadParts} />}
      <CreateBoatListingSheet
        open={createOpen || editingBoat != null}
        onClose={() => {
          setCreateOpen(false);
          setEditingBoat(null);
        }}
        sellerName={profile?.full_name?.trim() || t("boats.private_seller")}
        listingCount={userBoats.length}
        ownerId={userId}
        editing={editingBoat}
        onSaved={async (listing) => {
          await saveBoatListing(listing, userId);
          setUserBoats((prev) => {
            const exists = prev.some((b) => b.id === listing.id);
            return exists ? prev.map((b) => (b.id === listing.id ? listing : b)) : [listing, ...prev];
          });
          setEditingBoat(null);
          setCreateOpen(false);
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
              "h-10 rounded-xl border px-2.5 text-[12px] font-semibold leading-tight transition-colors " +
              (selected
                ? "border-[var(--desk-accent)] bg-[var(--desk-accent)] text-[var(--desk-accent-fg)] shadow-sm"
                : "border-[var(--desk-border)] bg-[var(--desk-paper)] text-[var(--desk-muted)] hover:text-[var(--desk-ink)]")
            }
          >
            {t(`marketplace.category.${c}`)}
          </button>
        );
      })}
    </div>
  );
}

function AiPartSheet({
  part,
  vesselEngine,
  vesselType,
  onClose,
}: {
  part: Part;
  vesselEngine: string | null;
  vesselType: string | null;
  onClose: () => void;
}) {
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
        const res = await ask({
          data: {
            messages: [{ role: "user", content: prompt.slice(0, 4000) }],
            lang: i18n.resolvedLanguage?.startsWith("tr") ? "tr" : "en",
          },
        });
        setText(res.text);
      } catch (err: unknown) {
        const raw = err instanceof Error ? err.message : String(err);
        setText(
          raw.includes("ai_rate_limited")
            ? t("common.ai_rate_limited")
            : raw.includes("ai_too_long")
              ? t("common.ai_too_long")
              : t("marketplace.ai_unavailable"),
        );
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [part.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="thalvo-dark w-full max-w-md rounded-3xl bg-[oklch(0.18_0.02_250)] border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex items-start justify-between gap-3 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="size-8 rounded-lg bg-amber-400/15 border border-amber-400/30 grid place-items-center text-amber-300">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">{t("marketplace.ai_thalvo")}</p>
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
