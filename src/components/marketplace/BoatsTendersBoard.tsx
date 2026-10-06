import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MapPin, MessageCircle, Pause, Pencil, Phone, Play, Search, Ship, X } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusBadge } from "@/components/core";
import {
  HULL_TYPES,
  engineLabel,
  formatListingPrice,
  isLiveListing,
  isOwnListing,
  telHref,
  whatsappHref,
  type BoatListing,
  type HullType,
} from "@/lib/boat-listings";
import { requestMapFocus } from "@/lib/map-focus-bus";
import { publicEquipment, readListingType } from "@/lib/marine-catalog";

const HUE: Record<BoatListing["hue"], string> = {
  navy: "from-[#0B192C] via-[#123154] to-[#1a4a6e]",
  teal: "from-[#07101C] via-[#0d3a44] to-[#146b6b]",
  gold: "from-[#0B192C] via-[#3a2e16] to-[#8a6a2a]",
  slate: "from-[#07101C] via-[#1c2a3a] to-[#3d5368]",
  wine: "from-[#0B192C] via-[#3a1824] to-[#6b2a3a]",
};

type RegionFilter = "all" | string;
type HullFilter = "all" | HullType;
type SortId = "listed" | "price_asc" | "price_desc" | "year" | "length";

export function BoatsTendersBoard({
  extraListings = [],
  ownerId,
  onEdit,
  onSetStatus,
}: {
  extraListings?: BoatListing[];
  ownerId: string;
  onEdit: (boat: BoatListing) => void;
  onSetStatus: (id: string, status: "live" | "paused") => void;
}) {
  const { t, i18n } = useTranslation();
  const [region, setRegion] = useState<RegionFilter>("all");
  const [hull, setHull] = useState<HullFilter>("all");
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [sort, setSort] = useState<SortId>("listed");
  const [selected, setSelected] = useState<BoatListing | null>(null);
  const locale = i18n.resolvedLanguage ?? "tr";

  const all = extraListings;
  const mine = useMemo(() => all.filter((b) => isOwnListing(b, ownerId)), [all, ownerId]);

  const listings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((b) => {
      const own = isOwnListing(b, ownerId);
      if (!isLiveListing(b) && !own) return false;
      if (mineOnly && !own) return false;
      if (region !== "all" && b.region !== region) return false;
      if (hull !== "all" && b.hull !== hull) return false;
      if (!q) return true;
      const hay = `${b.title} ${b.marina} ${b.region} ${b.engineBrand} ${b.seller}`.toLowerCase();
      return hay.includes(q);
    });
  }, [all, hull, mineOnly, ownerId, query, region]);

  const visible = useMemo(() => {
    const rows = [...listings];
    if (sort === "price_asc") rows.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") rows.sort((a, b) => b.price - a.price);
    else if (sort === "year") rows.sort((a, b) => b.year - a.year);
    else if (sort === "length") rows.sort((a, b) => b.loaM - a.loaM);
    return rows;
  }, [listings, sort]);

  const regions: RegionFilter[] = ["all", "Didim", "Göcek", "Marmaris", "Bodrum", "Fethiye"];
  const selectedLive = selected ? all.find((b) => b.id === selected.id) ?? selected : null;

  return (
    <div className="space-y-3">
      {mine.length > 0 && (
        <GlassPanel className="!p-3 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/85">
              {t("boats.mine")}
            </p>
            <p className="text-[11px] text-white/45">{t("boats.manage_hint")}</p>
          </div>
          <ul className="space-y-2">
            {mine.map((boat) => (
              <li
                key={boat.id}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center"
              >
                <button type="button" onClick={() => setSelected(boat)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-white">{boat.title}</p>
                  <p className="mt-0.5 text-[11px] text-white/50">
                    {formatListingPrice(boat.price, boat.currency, locale)} · {boat.marina}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge tone={isLiveListing(boat) ? "success" : "warning"} className="!normal-case !tracking-normal">
                    {t(isLiveListing(boat) ? "boats.live" : "boats.paused")}
                  </StatusBadge>
                  <OwnerActions
                    boat={boat}
                    onEdit={() => onEdit(boat)}
                    onSetStatus={onSetStatus}
                  />
                </div>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}

      <GlassPanel className="!p-4 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.22em] text-amber-200/80 uppercase">
              {t("boats.board_eyebrow")}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {t("boats.result_count", { count: visible.length })}
            </p>
          </div>
          <label className="shrink-0">
            <span className="sr-only">{t("boats.sort_listed")}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortId)}
              className="h-10 rounded-lg border border-white/10 bg-[#071422] px-2 text-[13px] text-white outline-none"
            >
              {(["listed", "price_asc", "price_desc", "year", "length"] as const).map((id) => (
                <option key={id} value={id}>{t(`boats.sort_${id}`)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("boats.search_placeholder")}
            className="h-12 w-full rounded-xl border border-white/10 bg-[#071422] pl-10 pr-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-amber-200/50"
          />
        </div>
        <div className="flex w-full min-w-0 gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar">
          <Chip active={!mineOnly} onClick={() => setMineOnly(false)}>{t("boats.all_listings")}</Chip>
          <Chip active={mineOnly} onClick={() => setMineOnly(true)}>{t("boats.mine")}</Chip>
          <Chip active={hull === "all"} onClick={() => setHull("all")}>{t("boats.hull_all")}</Chip>
          {HULL_TYPES.map((h) => (
            <Chip key={h} active={hull === h} onClick={() => setHull(h)}>{t(`boats.hull_${h}`)}</Chip>
          ))}
        </div>
        <div className="flex w-full min-w-0 gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar">
          {regions.map((r) => (
            <Chip key={r} active={region === r} onClick={() => setRegion(r)}>
              {r === "all" ? t("marketplace.all_categories") : r}
            </Chip>
          ))}
        </div>
      </GlassPanel>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#0c1b30] px-6 py-14 text-center">
          <Ship className="mx-auto size-8 text-amber-200/50" />
          <p className="mt-3 text-sm text-white/60">{t(mineOnly ? "boats.empty_mine" : "boats.empty")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((boat) => (
            <li key={boat.id}>
              <BoatListingCard
                boat={boat}
                locale={locale}
                owned={isOwnListing(boat, ownerId)}
                onOpen={() => setSelected(boat)}
              />
            </li>
          ))}
        </ul>
      )}

      {selectedLive && (
        <BoatDetailSheet
          boat={selectedLive}
          locale={locale}
          owned={isOwnListing(selectedLive, ownerId)}
          onClose={() => setSelected(null)}
          onEdit={() => {
            onEdit(selectedLive);
            setSelected(null);
          }}
          onSetStatus={(status) => onSetStatus(selectedLive.id, status)}
        />
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "h-8 shrink-0 rounded-full border px-3 text-[12px] font-medium transition-colors " +
        (active
          ? "border-amber-200/70 bg-amber-200/15 text-amber-100"
          : "border-white/10 bg-transparent text-white/60 hover:border-white/25 hover:text-white")
      }
    >
      {children}
    </button>
  );
}

function OwnerActions({
  boat,
  onEdit,
  onSetStatus,
}: {
  boat: BoatListing;
  onEdit: () => void;
  onSetStatus: (id: string, status: "live" | "paused") => void;
}) {
  const { t } = useTranslation();
  const live = isLiveListing(boat);
  return (
    <>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-2.5 text-[11px] font-semibold text-cyan-100"
      >
        <Pencil className="size-3.5" />
        {t("boats.edit_listing")}
      </button>
      <button
        type="button"
        onClick={() => {
          const next = live ? "paused" : "live";
          onSetStatus(boat.id, next);
          toast.success(t(next === "paused" ? "boats.paused_toast" : "boats.resumed_toast"));
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 text-[11px] font-semibold text-white/80"
      >
        {live ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        {t(live ? "boats.pause" : "boats.resume")}
      </button>
    </>
  );
}

function ListingPlate({
  boat,
  badge,
  className,
  photoUrl,
}: {
  boat: BoatListing;
  badge?: string;
  className?: string;
  photoUrl?: string;
}) {
  const { t } = useTranslation();
  const cover = photoUrl ?? boat.photos?.[0];
  return (
    <div className={className ?? "relative h-44 overflow-hidden bg-[#071422] sm:h-auto sm:w-[38%] sm:min-h-[176px] sm:shrink-0"}>
      {cover ? (
        <img src={cover} alt={boat.title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${HUE[boat.hue]}`} />
      )}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: cover
            ? "linear-gradient(180deg, rgba(7,20,34,0.15), transparent 28%, transparent 55%, rgba(7,20,34,0.72))"
            : "linear-gradient(180deg, transparent 58%, rgba(7,20,34,0.55)), repeating-linear-gradient(90deg, transparent, transparent 22px, rgba(255,255,255,0.05) 23px)",
          opacity: cover ? 1 : 0.4,
        }}
      />
      {!cover && <div className="absolute inset-x-6 bottom-[38%] h-px bg-amber-100/25" />}
      <div className="relative flex h-full flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-100/80">
            {listingClassLabel(boat, t)}
          </p>
          {badge ? (
            <span className="rounded-full border border-white/20 bg-black/30 px-2 py-0.5 text-[10px] font-medium text-white/90">
              {badge}
            </span>
          ) : null}
        </div>
        <div>
          {!cover && (
            <p className="text-[32px] font-light leading-none tabular-nums tracking-tight text-white">
              {boat.loaM.toFixed(1)}
              <span className="ml-1 text-sm font-normal text-white/55">m</span>
            </p>
          )}
          <p className={cover ? "text-[13px] font-medium text-white" : "mt-2 text-[12px] text-white/70"}>{boat.marina}</p>
        </div>
      </div>
    </div>
  );
}

function BoatListingCard({
  boat,
  locale,
  owned,
  onOpen,
}: {
  boat: BoatListing;
  locale: string;
  owned: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const facts = [
    { label: t("boats.year"), value: String(boat.year) },
    { label: t("boats.loa"), value: `${boat.loaM.toFixed(1)} m` },
    { label: t("boats.cabins"), value: String(boat.cabins) },
    { label: t("boats.hours"), value: `${boat.engineHours} h` },
  ];
  return (
    <button type="button" onClick={onOpen} className="w-full text-left">
      <article className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1b30] transition-colors hover:border-amber-200/35 sm:flex-row">
        <ListingPlate
          boat={boat}
          badge={owned ? t(isLiveListing(boat) ? "boats.yours" : "boats.paused") : undefined}
        />
        <div className="flex min-w-0 flex-1 flex-col px-4 py-4 sm:py-5">
          <h3 className="text-[17px] font-medium leading-snug tracking-tight text-white">{boat.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-white/50">
            <MapPin className="size-3.5 text-amber-200/80" />
            {boat.region}
            <span className="text-white/25">·</span>
            {boat.flag}
          </p>
          <p className="mt-3 text-[26px] font-semibold leading-none tabular-nums tracking-tight text-amber-100">
            {formatListingPrice(boat.price, boat.currency, locale)}
          </p>
          <dl className="mt-4 grid grid-cols-4 border-y border-white/10">
            {facts.map((fact) => (
              <div key={fact.label} className="px-1 py-2.5 first:pl-0">
                <dt className="text-[10px] text-white/40">{fact.label}</dt>
                <dd className="mt-0.5 truncate text-[13px] font-medium tabular-nums text-white">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[12px] text-white/40">{boat.seller}</p>
        </div>
      </article>
    </button>
  );
}

function BoatDetailSheet({
  boat,
  locale,
  owned,
  onClose,
  onEdit,
  onSetStatus,
}: {
  boat: BoatListing;
  locale: string;
  owned: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSetStatus: (status: "live" | "paused") => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = boat.photos ?? [];
  useEffect(() => {
    setIsMounted(true);
  }, []);
  useEffect(() => {
    setPhotoIndex(0);
  }, [boat.id]);

  if (!isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="thalvo-dark max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#071422] shadow-2xl sm:rounded-3xl"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <ListingPlate
            boat={boat}
            photoUrl={photos[photoIndex]}
            className="relative h-56 w-full overflow-hidden bg-[#071422] sm:h-72"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-white/20 bg-black/40 text-white"
          >
            <X className="size-4" />
          </button>
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-5 pt-3">
            {photos.map((url, index) => (
              <button
                key={url}
                type="button"
                onClick={() => setPhotoIndex(index)}
                className={
                  "h-14 w-20 shrink-0 overflow-hidden rounded-lg border " +
                  (index === photoIndex ? "border-amber-200" : "border-white/10")
                }
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="space-y-5 p-5">
          <div>
            <h3 className="text-[22px] font-medium leading-snug tracking-tight text-white">{boat.title}</h3>
            <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums tracking-tight text-amber-100">
              {formatListingPrice(boat.price, boat.currency, locale)}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-white/55">
              <MapPin className="size-3.5 text-amber-200/80" />
              {boat.marina}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10">
            <Spec label={t("boats.year")} value={String(boat.year)} />
            <Spec label={t("boats.hull")} value={listingClassLabel(boat, t)} />
            <Spec label={t("boats.loa")} value={`${boat.loaM.toFixed(2)} m`} />
            <Spec label={t("boats.beam")} value={boat.beamM ? `${boat.beamM.toFixed(2)} m` : "—"} />
            <Spec label={t("boats.draft")} value={boat.draftM ? `${boat.draftM.toFixed(2)} m` : "—"} />
            <Spec label={t("boats.engine")} value={engineLabel(boat)} />
            <Spec label={t("boats.hours")} value={`${boat.engineHours} h`} />
            <Spec label={t("boats.fuel")} value={t(`boats.fuel_${boat.fuel}`)} />
            <Spec label={t("boats.cabins_berths")} value={`${boat.cabins} / ${boat.berths}`} />
            <Spec label={t("boats.cruise")} value={boat.cruiseKn ? `${boat.cruiseKn} kn` : "—"} />
            <Spec label={t("boats.fuel_tank")} value={boat.fuelTankL != null ? `${boat.fuelTankL} L` : "—"} />
            <Spec label={t("boats.water_tank")} value={boat.waterTankL != null ? `${boat.waterTankL} L` : "—"} />
            <Spec label={t("boats.flag")} value={boat.flag} />
          </dl>
          {boat.description && (
            <p className="text-[13px] leading-relaxed text-white/80">{boat.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {publicEquipment(boat.equipment).map((eq) => (
              <StatusBadge key={eq} tone="info" className="!normal-case !tracking-normal">
                {t(`boats.eq.${slug(eq)}`, { defaultValue: eq })}
              </StatusBadge>
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] text-white/40">{t("boats.seller")}</p>
            <p className="mt-0.5 text-[15px] font-medium text-white">{boat.seller}</p>
          </div>
          {owned && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-900"
              >
                <Pencil className="size-3.5" />
                {t("boats.edit_listing")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = isLiveListing(boat) ? "paused" : "live";
                  onSetStatus(next);
                  toast.success(t(next === "paused" ? "boats.paused_toast" : "boats.resumed_toast"));
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/85"
              >
                {isLiveListing(boat) ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {t(isLiveListing(boat) ? "boats.pause" : "boats.resume")}
              </button>
            </div>
          )}
          {!owned && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href={whatsappHref(boat.sellerPhone)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[14px] font-semibold text-[#0a192f]"
              >
                <MessageCircle className="size-3.5" />
                {t("boats.contact_whatsapp")}
              </a>
              <a
                href={telHref(boat.sellerPhone)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-amber-200/30 bg-amber-200/10 text-[14px] font-semibold text-amber-50"
              >
                <Phone className="size-3.5" />
                {t("boats.contact_phone")}
              </a>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              requestMapFocus({ lat: boat.lat, lng: boat.lng, zoom: 14, label: boat.marina });
              onClose();
              void navigate({ to: "/app" });
            }}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-[14px] font-medium text-white/85"
          >
            <MapPin className="size-3.5" />
            {t("boats.view_on_map")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0c1b30] px-3 py-2.5">
      <dt className="text-[11px] text-white/40">{label}</dt>
      <dd className="mt-0.5 text-[14px] font-medium text-white">{value}</dd>
    </div>
  );
}

function listingClassLabel(boat: BoatListing, t: (key: string) => string): string {
  const id = readListingType(boat.equipment);
  return id ? t(`vessel.type_${id}`) : t(`boats.hull_${boat.hull}`);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
