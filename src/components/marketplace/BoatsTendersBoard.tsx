import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  MapPin,
  MessageCircle,
  Pause,
  Pencil,
  Phone,
  Play,
  Search,
  Ship,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import { useMarketplaceMobileSheet } from "@/components/marketplace/useMarketplaceMobileSheet";

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

const REGIONS: RegionFilter[] = ["all", "Didim", "Göcek", "Marmaris", "Bodrum", "Fethiye"];

/**
 * Boats & tenders board — same Design C desk as spare parts
 * (masthead + left rail / mobile sheet), theme-aware via `.thalvo-desk`.
 */
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
  const mobileSheet = useMarketplaceMobileSheet();
  const [region, setRegion] = useState<RegionFilter>("all");
  const [hull, setHull] = useState<HullFilter>("all");
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [sort, setSort] = useState<SortId>("listed");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [selected, setSelected] = useState<BoatListing | null>(null);
  const locale = i18n.resolvedLanguage ?? "tr";

  const all = extraListings;
  const mine = useMemo(() => all.filter((b) => isOwnListing(b, ownerId)), [all, ownerId]);

  useEffect(() => {
    if (!filtersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

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

  const hullCounts = useMemo(() => {
    const map = new Map<HullType, number>();
    for (const b of all) {
      if (!isLiveListing(b) && !isOwnListing(b, ownerId)) continue;
      map.set(b.hull, (map.get(b.hull) ?? 0) + 1);
    }
    return HULL_TYPES.map((h) => ({ id: h, count: map.get(h) ?? 0 })).filter((h) => h.count > 0);
  }, [all, ownerId]);

  const regionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of all) {
      if (!isLiveListing(b) && !isOwnListing(b, ownerId)) continue;
      map.set(b.region, (map.get(b.region) ?? 0) + 1);
    }
    return REGIONS.filter((r) => r !== "all").map((r) => ({
      id: r,
      count: map.get(r) ?? 0,
    }));
  }, [all, ownerId]);

  const activeFilterCount =
    (hull !== "all" ? 1 : 0) + (region !== "all" ? 1 : 0) + (mineOnly ? 1 : 0) + (query.trim() ? 1 : 0);

  const clearAll = () => {
    setHull("all");
    setRegion("all");
    setMineOnly(false);
    setQuery("");
  };

  const selectedLive = selected ? all.find((b) => b.id === selected.id) ?? selected : null;
  const liveCount = all.filter((b) => isLiveListing(b) || isOwnListing(b, ownerId)).length;

  const filterBody = (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--desk-muted)]">
          {t("boats.scope")}
        </p>
        <ul className="mt-2 space-y-0.5">
          <li>
            <RailRow
              active={!mineOnly}
              label={t("boats.all_listings")}
              count={liveCount}
              onClick={() => setMineOnly(false)}
            />
          </li>
          <li>
            <RailRow
              active={mineOnly}
              label={t("boats.mine")}
              count={mine.length}
              onClick={() => setMineOnly(true)}
            />
          </li>
        </ul>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--desk-muted)]">
          {t("boats.hull")}
        </p>
        <ul className="mt-2 space-y-0.5">
          <li>
            <RailRow
              active={hull === "all"}
              label={t("boats.hull_all")}
              count={liveCount}
              onClick={() => setHull("all")}
            />
          </li>
          {hullCounts.map((g) => (
            <li key={g.id}>
              <RailRow
                active={hull === g.id}
                label={t(`boats.hull_${g.id}`)}
                count={g.count}
                onClick={() => setHull(g.id)}
              />
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--desk-muted)]">
          {t("boats.region")}
        </p>
        <ul className="mt-2 space-y-0.5">
          <li>
            <RailRow
              active={region === "all"}
              label={t("marketplace.all_categories")}
              count={liveCount}
              onClick={() => setRegion("all")}
            />
          </li>
          {regionCounts.map((g) => (
            <li key={g.id}>
              <RailRow
                active={region === g.id}
                label={g.id}
                count={g.count}
                onClick={() => setRegion(g.id)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <div className="thalvo-desk space-y-3">
      {mine.length > 0 && (
        <section className="rounded-2xl border border-[var(--desk-border)] bg-[var(--desk-paper)] p-3 shadow-[var(--desk-shadow)] sm:p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--desk-muted)]">
              {t("boats.mine")}
            </p>
            <p className="text-[11px] text-[var(--desk-subtle)]">{t("boats.manage_hint")}</p>
          </div>
          <ul className="mt-2 space-y-2">
            {mine.map((boat) => (
              <li
                key={boat.id}
                className="flex flex-col gap-2 rounded-xl border border-[var(--desk-border)] bg-[var(--desk-input)] p-3 sm:flex-row sm:items-center"
              >
                <button type="button" onClick={() => setSelected(boat)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-[var(--desk-ink)]">{boat.title}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--desk-muted)]">
                    {formatListingPrice(boat.price, boat.currency, locale)} · {boat.marina}
                  </p>
                </button>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <StatusBadge
                    tone={isLiveListing(boat) ? "success" : "warning"}
                    className="!normal-case !tracking-normal"
                  >
                    {t(isLiveListing(boat) ? "boats.live" : "boats.paused")}
                  </StatusBadge>
                  <OwnerActions boat={boat} onEdit={() => onEdit(boat)} onSetStatus={onSetStatus} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="-mx-1 space-y-4 rounded-2xl bg-[var(--desk-canvas)] p-3 sm:mx-0 sm:p-4">
        <header className="rounded-2xl border border-[var(--desk-border)] bg-[var(--desk-paper)] px-4 py-4 shadow-[var(--desk-shadow)] sm:px-6 sm:py-5">
          <nav className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--desk-muted)]">
            <span>{t("marketplace.title")}</span>
            <span>/</span>
            <span className="font-semibold text-[var(--desk-ink)]">{t("marketplace.category.boats")}</span>
          </nav>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--desk-muted)]">
                {t("boats.board_eyebrow")}
              </p>
              <h2 className="thalvo-desk-title mt-1 text-2xl tracking-tight text-[var(--desk-ink)] sm:text-3xl">
                {t("marketplace.category.boats")}
              </h2>
              <p className="mt-1 max-w-xl text-[13px] text-[var(--desk-muted)]">{t("boats.day_lede")}</p>
            </div>
            <div className="flex w-full max-w-md gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--desk-subtle)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("boats.search_placeholder")}
                  className="h-11 w-full rounded-xl border border-[var(--desk-border)] bg-[var(--desk-input)] pl-10 pr-10 text-sm text-[var(--desk-ink)] outline-none placeholder:text-[var(--desk-subtle)] focus:border-[var(--desk-active)]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--desk-subtle)] hover:bg-[var(--desk-chip)]"
                    aria-label={t("marketplace.catalog.clear_search")}
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              {mobileSheet ? (
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--desk-accent)] px-3 text-[11px] font-bold uppercase tracking-wide text-[var(--desk-accent-fg)]"
                >
                  <SlidersHorizontal className="size-3.5" />
                  {t("marketplace.catalog.filters")}
                  {activeFilterCount > 0 ? (
                    <span className="rounded bg-[var(--desk-active)] px-1.5 text-[10px] text-[var(--desk-active-ink)]">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setRailOpen((v) => !v)}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--desk-border)] bg-[var(--desk-paper)] px-3 text-[11px] font-bold uppercase tracking-wide text-[var(--desk-ink)]"
                >
                  <SlidersHorizontal className="size-3.5" />
                  {railOpen ? t("marketplace.catalog.hide_rail") : t("marketplace.catalog.filters")}
                </button>
              )}
            </div>
          </div>
        </header>

        <div
          className={
            "grid gap-4 " + (!mobileSheet && railOpen ? "lg:grid-cols-[240px_minmax(0,1fr)]" : "")
          }
        >
          {!mobileSheet && railOpen && (
            <aside className="rounded-2xl border border-[var(--desk-border)] bg-[var(--desk-paper)] p-4 shadow-[var(--desk-shadow)]">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-[var(--desk-ink)]">{t("marketplace.catalog.filters")}</p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[11px] font-semibold text-[var(--desk-muted)]"
                  >
                    {t("marketplace.catalog.clear_all")}
                  </button>
                )}
              </div>
              {filterBody}
            </aside>
          )}

          <div className="min-w-0 space-y-3">
            <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 no-scrollbar">
              <Chip
                active={hull === "all" && !mineOnly}
                onClick={() => {
                  setHull("all");
                  setMineOnly(false);
                }}
              >
                {t("boats.all_listings")} · {liveCount}
              </Chip>
              {hullCounts.map((g) => (
                <Chip
                  key={g.id}
                  active={hull === g.id}
                  onClick={() => setHull(g.id === hull ? "all" : g.id)}
                >
                  {t(`boats.hull_${g.id}`)} · {g.count}
                </Chip>
              ))}
              <Chip active={mineOnly} onClick={() => setMineOnly((v) => !v)}>
                {t("boats.mine")} · {mine.length}
              </Chip>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {mineOnly ? (
                  <FilterChip label={t("boats.mine")} onRemove={() => setMineOnly(false)} />
                ) : null}
                {hull !== "all" ? (
                  <FilterChip label={t(`boats.hull_${hull}`)} onRemove={() => setHull("all")} />
                ) : null}
                {region !== "all" ? (
                  <FilterChip label={region} onRemove={() => setRegion("all")} />
                ) : null}
                {query.trim() ? (
                  <FilterChip label={`“${query.trim()}”`} onRemove={() => setQuery("")} />
                ) : null}
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] font-semibold text-[var(--desk-muted)] underline-offset-2 hover:underline"
                >
                  {t("marketplace.catalog.clear_all")}
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-2xl border border-[var(--desk-border)] bg-[var(--desk-paper)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <p className="text-[13px] font-semibold text-[var(--desk-muted)]">
                {t("boats.result_count", { count: visible.length })}
              </p>
              <label className="inline-flex items-center gap-2 text-[12px] text-[var(--desk-muted)]">
                <ChevronDown className="size-3.5" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortId)}
                  className="h-9 rounded-lg border border-[var(--desk-border)] bg-[var(--desk-paper)] px-2 text-[12px] font-semibold text-[var(--desk-ink)] outline-none"
                >
                  {(["listed", "price_asc", "price_desc", "year", "length"] as const).map((id) => (
                    <option key={id} value={id}>
                      {t(`boats.sort_${id}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {visible.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--desk-border)] bg-[var(--desk-paper)] px-4 py-12 text-center">
                <Ship className="mx-auto size-8 text-[var(--desk-subtle)]" />
                <p className="mt-3 text-sm font-semibold text-[var(--desk-ink)]">
                  {t(mineOnly ? "boats.empty_mine" : "boats.empty")}
                </p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="mt-2 text-[12px] font-semibold text-[var(--desk-ink)]"
                  >
                    {t("marketplace.catalog.clear_all")}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((boat) => (
                  <BoatDeskCard
                    key={boat.id}
                    boat={boat}
                    locale={locale}
                    owned={isOwnListing(boat, ownerId)}
                    onOpen={() => setSelected(boat)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {mobileSheet && (
          <div
            className={
              "fixed inset-0 z-50 transition-[visibility] duration-200 " +
              (filtersOpen ? "visible" : "invisible pointer-events-none")
            }
          >
            <button
              type="button"
              className={
                "absolute inset-0 bg-[var(--desk-overlay)] transition-opacity " +
                (filtersOpen ? "opacity-100" : "opacity-0")
              }
              aria-label={t("marketplace.catalog.close_filters")}
              onClick={() => setFiltersOpen(false)}
            />
            <aside
              className={
                "absolute inset-x-0 bottom-0 flex max-h-[min(88dvh,40rem)] flex-col rounded-t-3xl border border-b-0 border-[var(--desk-border)] bg-[var(--desk-paper)] shadow-2xl transition-transform duration-300 pb-[env(safe-area-inset-bottom)] " +
                (filtersOpen ? "translate-y-0" : "translate-y-full")
              }
            >
              <div className="flex flex-col items-center pt-2">
                <span className="mb-1 h-1 w-10 rounded-full bg-[var(--desk-border)]" />
              </div>
              <div className="flex items-center justify-between border-b border-[var(--desk-border)] px-4 py-3">
                <p className="text-sm font-bold text-[var(--desk-ink)]">{t("marketplace.catalog.filters")}</p>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="grid size-9 place-items-center rounded-lg border border-[var(--desk-border)] text-[var(--desk-muted)]"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{filterBody}</div>
              <div className="space-y-2 border-t border-[var(--desk-border)] p-4">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="h-10 w-full rounded-xl border border-[var(--desk-border)] text-[12px] font-semibold text-[var(--desk-muted)]"
                  >
                    {t("marketplace.catalog.clear_all")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--desk-accent)] text-sm font-bold text-[var(--desk-accent-fg)]"
                >
                  {t("marketplace.catalog.apply_filters", { count: visible.length })}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>

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

function RailRow({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-[13px] " +
        (active
          ? "bg-[var(--desk-accent)] font-semibold text-[var(--desk-accent-fg)]"
          : "text-[var(--desk-ink)] hover:bg-[var(--desk-chip)]")
      }
    >
      <span className="truncate">{label}</span>
      <span className={active ? "text-[var(--desk-accent-fg)]/60" : "text-[var(--desk-subtle)]"}>{count}</span>
    </button>
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
        "h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-semibold " +
        (active
          ? "border-[var(--desk-accent)] bg-[var(--desk-accent)] text-[var(--desk-accent-fg)]"
          : "border-[var(--desk-border)] bg-[var(--desk-chip)] text-[var(--desk-muted)] hover:border-[var(--desk-subtle)]")
      }
    >
      {children}
    </button>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex h-7 max-w-full items-center gap-1 rounded-lg border border-[var(--desk-border)] bg-[var(--desk-paper)] px-2 text-[11px] font-semibold text-[var(--desk-ink)]"
    >
      <span className="truncate">{label}</span>
      <X className="size-3 shrink-0 text-[var(--desk-subtle)]" />
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
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--desk-border)] bg-[var(--desk-input)] px-2.5 text-[11px] font-semibold text-[var(--desk-ink)]"
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
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--desk-border)] px-2.5 text-[11px] font-semibold text-[var(--desk-muted)]"
      >
        {live ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        {t(live ? "boats.pause" : "boats.resume")}
      </button>
    </>
  );
}

function BoatDeskCard({
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
  const cover = boat.photos?.[0];
  const facts = [
    { label: t("boats.year"), value: String(boat.year) },
    { label: t("boats.loa"), value: `${boat.loaM.toFixed(1)} m` },
    { label: t("boats.hours"), value: `${boat.engineHours} h` },
  ];

  return (
    <button type="button" onClick={onOpen} className="w-full text-left">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--desk-border)] bg-[var(--desk-paper)] shadow-[var(--desk-shadow)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5">
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--desk-input)]">
          {cover ? (
            <img src={cover} alt={boat.title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${HUE[boat.hue]}`} />
          )}
          <div className="thalvo-on-dark absolute left-2 top-2 flex flex-col gap-1">
            <span className="rounded border border-white/20 bg-black/45 px-2 py-0.5 text-[10px] font-bold text-white">
              {listingClassLabel(boat, t)}
            </span>
            {owned ? (
              <span className="rounded border border-white/20 bg-black/45 px-2 py-0.5 text-[10px] font-bold text-white">
                {t(isLiveListing(boat) ? "boats.yours" : "boats.paused")}
              </span>
            ) : null}
          </div>
          <div className="thalvo-on-dark absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 py-2">
            <p className="truncate text-[12px] font-medium text-white">{boat.marina}</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--desk-muted)]">
            {boat.region}
            <span className="mx-1 text-[var(--desk-subtle)]">·</span>
            {boat.flag}
          </p>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-[14px] font-semibold leading-snug text-[var(--desk-ink)]">
            {boat.title}
          </h3>
          <dl className="grid grid-cols-3 gap-1 border-y border-[var(--desk-border)] py-2">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[10px] text-[var(--desk-subtle)]">{fact.label}</dt>
                <dd className="mt-0.5 truncate text-[12px] font-semibold tabular-nums text-[var(--desk-ink)]">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-auto flex items-end justify-between gap-2 pt-1">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--desk-subtle)]">
                {t("boats.asking_price")}
              </p>
              <p className="text-lg font-bold tabular-nums text-[var(--desk-price)]">
                {formatListingPrice(boat.price, boat.currency, locale)}
              </p>
              <p className="truncate text-[10px] text-[var(--desk-muted)]">{boat.seller}</p>
            </div>
            <span className="inline-flex h-10 items-center rounded-xl bg-[var(--desk-accent)] px-3 text-[11px] font-bold uppercase text-[var(--desk-accent-fg)]">
              {t("boats.view_listing")}
            </span>
          </div>
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
    <div
      className="thalvo-desk fixed inset-0 z-[100] flex items-end justify-center bg-[var(--desk-overlay)] backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-[var(--desk-border)] bg-[var(--desk-paper)] shadow-2xl sm:rounded-3xl"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <ListingPlate
            boat={boat}
            photoUrl={photos[photoIndex]}
            className="relative h-56 w-full overflow-hidden bg-[var(--desk-input)] sm:h-72"
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
                  (index === photoIndex ? "border-[var(--desk-price)]" : "border-[var(--desk-border)]")
                }
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="space-y-5 p-5">
          <div>
            <h3 className="thalvo-desk-title text-[26px] leading-snug tracking-tight text-[var(--desk-ink)]">
              {boat.title}
            </h3>
            <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums tracking-tight text-[var(--desk-price)]">
              {formatListingPrice(boat.price, boat.currency, locale)}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-[var(--desk-muted)]">
              <MapPin className="size-3.5 text-[var(--desk-price)]" />
              {boat.marina}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-border)]">
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
            <p className="text-[13px] leading-relaxed text-[var(--desk-ink)]/85">{boat.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {publicEquipment(boat.equipment).map((eq) => (
              <StatusBadge key={eq} tone="info" className="!normal-case !tracking-normal">
                {t(`boats.eq.${slug(eq)}`, { defaultValue: eq })}
              </StatusBadge>
            ))}
          </div>
          <div className="rounded-xl border border-[var(--desk-border)] bg-[var(--desk-input)] px-4 py-3">
            <p className="text-[11px] text-[var(--desk-subtle)]">{t("boats.seller")}</p>
            <p className="mt-0.5 text-[15px] font-medium text-[var(--desk-ink)]">{boat.seller}</p>
          </div>
          {owned && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--desk-active)] px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--desk-active-ink)]"
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
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--desk-border)] px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--desk-ink)]"
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
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--desk-border)] bg-[var(--desk-input)] text-[14px] font-semibold text-[var(--desk-ink)]"
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
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--desk-border)] text-[14px] font-medium text-[var(--desk-ink)]"
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
    <div className={className ?? "relative h-44 overflow-hidden bg-[var(--desk-input)]"}>
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
            : "linear-gradient(180deg, transparent 58%, rgba(7,20,34,0.55))",
        }}
      />
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
          <p className={cover ? "text-[13px] font-medium text-white" : "mt-2 text-[12px] text-white/70"}>
            {boat.marina}
          </p>
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--desk-paper)] px-3 py-2.5">
      <dt className="text-[11px] text-[var(--desk-subtle)]">{label}</dt>
      <dd className="mt-0.5 text-[14px] font-medium text-[var(--desk-ink)]">{value}</dd>
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
