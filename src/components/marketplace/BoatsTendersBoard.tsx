import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MapPin, MessageCircle, Phone, Ship, X } from "lucide-react";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusBadge } from "@/components/core";
import {
  BOAT_LISTINGS,
  FEATURED_EQUIPMENT,
  engineLabel,
  formatListingPrice,
  telHref,
  whatsappHref,
  type BoatListing,
} from "@/lib/boat-listings";
import { requestMapFocus } from "@/lib/map-focus-bus";

const HUE: Record<BoatListing["hue"], string> = {
  navy: "from-[#0B192C] via-[#123154] to-[#1a4a6e]",
  teal: "from-[#07101C] via-[#0d3a44] to-[#146b6b]",
  gold: "from-[#0B192C] via-[#3a2e16] to-[#8a6a2a]",
  slate: "from-[#07101C] via-[#1c2a3a] to-[#3d5368]",
  wine: "from-[#0B192C] via-[#3a1824] to-[#6b2a3a]",
};

type RegionFilter = "all" | string;

export function BoatsTendersBoard({ extraListings = [] }: { extraListings?: BoatListing[] }) {
  const { t, i18n } = useTranslation();
  const [region, setRegion] = useState<RegionFilter>("all");
  const [selected, setSelected] = useState<BoatListing | null>(null);
  const locale = i18n.resolvedLanguage ?? "tr";

  const all = useMemo(() => [...extraListings, ...BOAT_LISTINGS], [extraListings]);

  const listings = useMemo(
    () => (region === "all" ? all : all.filter((b) => b.region === region)),
    [all, region],
  );

  const regions: RegionFilter[] = ["all", "Didim", "Göcek", "Marmaris", "Bodrum", "Fethiye"];

  return (
    <div className="space-y-3">
      <GlassPanel className="!p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/85">
          {t("boats.board_eyebrow")}
        </p>
        <div className="flex w-full min-w-0 max-w-full gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar">
          {regions.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              className={
                "h-8 shrink-0 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors " +
                (region === r
                  ? "border-amber-300 bg-amber-300 text-slate-900"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10")
              }
            >
              {r === "all" ? t("marketplace.all_categories") : r}
            </button>
          ))}
        </div>
      </GlassPanel>

      <ul className="space-y-3">
        {listings.map((boat) => (
          <li key={boat.id}>
            <BoatListingCard boat={boat} locale={locale} onOpen={() => setSelected(boat)} />
          </li>
        ))}
      </ul>

      {selected && (
        <BoatDetailSheet boat={selected} locale={locale} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function BoatListingCard({
  boat,
  locale,
  onOpen,
}: {
  boat: BoatListing;
  locale: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const featured = FEATURED_EQUIPMENT.filter((eq) => boat.equipment.includes(eq));
  return (
    <button type="button" onClick={onOpen} className="w-full text-left">
      <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a192f]/90 transition-colors hover:border-cyan-400/35">
        <div className={`relative h-36 bg-gradient-to-br ${HUE[boat.hue]}`}>
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_40%),linear-gradient(135deg,transparent_40%,rgba(0,240,255,0.12))]" />
          <Ship className="absolute bottom-3 left-3 size-8 text-white/25" />
          <span className="absolute right-3 top-3 rounded-full border border-amber-300/50 bg-[#0a192f]/80 px-2.5 py-1 text-[13px] font-semibold tabular-nums text-amber-200 backdrop-blur-md">
            {formatListingPrice(boat.price, boat.currency, locale)}
          </span>
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/35 px-2 py-1 text-[10px] font-semibold text-white/85 backdrop-blur-md">
            <MapPin className="size-3 text-amber-300" />
            {boat.marina}
          </span>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <h3 className="text-[15px] font-semibold text-white">{boat.title}</h3>
            <p className="mt-0.5 text-[11px] text-white/50">
              {t(`boats.hull_${boat.hull}`)} · {boat.region} · {boat.flag}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <SpecCell label={t("boats.year")} value={String(boat.year)} />
            <SpecCell label={t("boats.loa")} value={`${boat.loaM.toFixed(2)} m`} />
            <SpecCell label={t("boats.hull")} value={t(`boats.hull_${boat.hull}`)} />
            <SpecCell label={t("boats.engine")} value={`${boat.engineBrand} · ${boat.engineHours} h`} />
          </div>
          {featured.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {featured.map((eq) => (
                <StatusBadge key={eq} tone="info" className="!normal-case !tracking-normal">
                  {t(`boats.eq.${slug(eq)}`, { defaultValue: eq })}
                </StatusBadge>
              ))}
            </div>
          )}
        </div>
      </article>
    </button>
  );
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-1.5 py-1.5 text-center">
      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</p>
      <p className="mt-0.5 truncate text-[11px] font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function BoatDetailSheet({
  boat,
  locale,
  onClose,
}: {
  boat: BoatListing;
  locale: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="thalvo-dark max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-cyan-400/25 bg-[#0a192f] shadow-2xl sm:rounded-3xl"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`relative h-32 bg-gradient-to-br ${HUE[boat.hue]}`}>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-white/20 bg-black/40 text-white"
          >
            <X className="size-4" />
          </button>
          <span className="absolute bottom-3 left-3 rounded-full border border-amber-300/50 bg-[#0a192f]/80 px-2.5 py-1 text-sm font-semibold text-amber-200">
            {formatListingPrice(boat.price, boat.currency, locale)}
          </span>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{boat.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-white/60">
              <MapPin className="size-3.5 text-amber-300" />
              {boat.marina}
            </p>
          </div>
          <table className="w-full text-[12px]">
            <tbody>
              <TechRow label={t("boats.year")} value={String(boat.year)} />
              <TechRow label={t("boats.hull")} value={t(`boats.hull_${boat.hull}`)} />
              <TechRow label={t("boats.loa")} value={`${boat.loaM.toFixed(2)} m`} />
              <TechRow label={t("boats.beam")} value={boat.beamM ? `${boat.beamM.toFixed(2)} m` : "—"} />
              <TechRow label={t("boats.draft")} value={boat.draftM ? `${boat.draftM.toFixed(2)} m` : "—"} />
              <TechRow label={t("boats.engine")} value={engineLabel(boat)} />
              <TechRow label={t("boats.hours")} value={`${boat.engineHours} h`} />
              <TechRow label={t("boats.fuel")} value={t(`boats.fuel_${boat.fuel}`)} />
              <TechRow label={t("boats.cabins_berths")} value={`${boat.cabins} / ${boat.berths}`} />
              <TechRow label={t("boats.cruise")} value={boat.cruiseKn ? `${boat.cruiseKn} kn` : "—"} />
              <TechRow label={t("boats.fuel_tank")} value={boat.fuelTankL != null ? `${boat.fuelTankL} L` : "—"} />
              <TechRow label={t("boats.water_tank")} value={boat.waterTankL != null ? `${boat.waterTankL} L` : "—"} />
              <TechRow label={t("boats.flag")} value={boat.flag} />
            </tbody>
          </table>
          {boat.description && (
            <p className="text-[13px] leading-relaxed text-white/80">{boat.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {boat.equipment.map((eq) => (
              <StatusBadge key={eq} tone="info" className="!normal-case !tracking-normal">
                {t(`boats.eq.${slug(eq)}`, { defaultValue: eq })}
              </StatusBadge>
            ))}
          </div>
          <p className="text-[11px] text-white/45">
            {t("boats.seller")}: {boat.seller}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href={whatsappHref(boat.sellerPhone)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0a192f]"
            >
              <MessageCircle className="size-3.5" />
              {t("boats.contact_whatsapp")}
            </a>
            <a
              href={telHref(boat.sellerPhone)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-100"
            >
              <Phone className="size-3.5" />
              {t("boats.contact_phone")}
            </a>
            <button
              type="button"
              onClick={() => {
                requestMapFocus({ lat: boat.lat, lng: boat.lng, zoom: 14, label: boat.marina });
                onClose();
                void navigate({ to: "/app" });
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-100 sm:col-span-2"
            >
              <MapPin className="size-3.5" />
              {t("boats.view_on_map")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TechRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-white/[0.06]">
      <th className="py-1.5 text-left font-normal uppercase tracking-[0.12em] text-[10px] text-white/40">{label}</th>
      <td className="py-1.5 text-right font-medium text-white">{value}</td>
    </tr>
  );
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
