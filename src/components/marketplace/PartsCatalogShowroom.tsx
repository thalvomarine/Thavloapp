import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  ChevronLeft,
  Heart,
  PanelLeft,
  PanelLeftClose,
  Search,
  ShoppingCart,
  Ship,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type { PartCardData } from "@/components/marketplace/PartCard";
import { PART_CATEGORIES } from "@/lib/marine-catalog";
import { isNativeWebView } from "@/lib/native-history";

/** Web desktop: side drawer. Native app / narrow viewports: bottom sheet. */
function useFilterPresentation(): "side" | "bottom" {
  const [mode, setMode] = useState<"side" | "bottom">(() => {
    if (typeof window === "undefined") return "side";
    if (isNativeWebView()) return "bottom";
    return window.matchMedia("(max-width: 1023px)").matches ? "bottom" : "side";
  });

  useEffect(() => {
    if (isNativeWebView()) {
      setMode("bottom");
      return;
    }
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setMode(mq.matches ? "bottom" : "side");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return mode;
}

export type PartsSortId = "recommended" | "price_asc" | "price_desc" | "name" | "newest";

interface Props {
  parts: PartCardData[];
  rawParts: Array<{ id: string; created_at?: string | null }>;
  currencyFormat: (n: number) => string;
  onAdd: (p: PartCardData) => void;
  onNotify: (p: PartCardData) => void;
  onAskAi: (p: PartCardData) => void;
  banner?: ReactNode;
}

const FAVORITES_KEY = "thalvo-part-favorites";

function readFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((x): x is string => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeFavorites(ids: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota */
  }
}

function categoryLabelFn(t: (key: string) => string, raw: string): string {
  const key = `dealer.categories.${raw}`;
  const translated = t(key);
  if (translated && translated !== key) return translated;
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || raw;
}

function brandInitials(brand: string): string {
  const parts = brand.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Design B — Authorised dealer showroom + left filter drawer.
 */
export function PartsCatalogShowroom({
  parts,
  rawParts,
  currencyFormat,
  onAdd,
  onNotify,
  onAskAi,
  banner,
}: Props) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<PartsSortId>("recommended");
  const [view, setView] = useState<"grid" | "desk">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPresentation = useFilterPresentation();
  const [favorites, setFavorites] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : readFavorites(),
  );

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

  const closeFilters = () => setFiltersOpen(false);
  const openFilters = () => setFiltersOpen(true);

  const createdAtById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rawParts) {
      if (row.created_at) map.set(row.id, row.created_at);
    }
    return map;
  }, [rawParts]);

  const brandCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of parts) {
      const brand = (p.brand || "").trim();
      if (!brand) continue;
      if (category && p.category !== category) continue;
      map.set(brand, (map.get(brand) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
      .map(([brand, count]) => ({ brand, count }));
  }, [parts, category]);

  const groupCounts = useMemo(() => {
    const live = new Map<string, number>();
    for (const p of parts) {
      live.set(p.category, (live.get(p.category) ?? 0) + 1);
    }
    const known = PART_CATEGORIES.filter((c) => (live.get(c) ?? 0) > 0).map((c) => ({
      id: c,
      count: live.get(c) ?? 0,
    }));
    const extras = [...live.entries()]
      .filter(([id]) => !(PART_CATEGORIES as readonly string[]).includes(id))
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);
    return [...known, ...extras];
  }, [parts]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const brandSet = new Set(brands.map((b) => b.toLowerCase()));
    return parts.filter((p) => {
      if (category && p.category !== category) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (brandSet.size > 0 && !brandSet.has(p.brand.trim().toLowerCase())) return false;
      if (!needle) return true;
      const hay = [
        p.name,
        p.brand,
        p.sku ?? "",
        p.categoryLabel ?? p.category,
        ...(p.compatibility ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [parts, category, brands, inStockOnly, q]);

  const visible = useMemo(() => {
    const rows = [...filtered];
    if (sort === "price_asc") rows.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") rows.sort((a, b) => b.price - a.price);
    else if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    else if (sort === "newest") {
      rows.sort((a, b) => {
        const aa = createdAtById.get(a.id) ?? "";
        const bb = createdAtById.get(b.id) ?? "";
        return bb.localeCompare(aa);
      });
    } else {
      rows.sort((a, b) => {
        const sos = Number(!!b.emergencyCompatible) - Number(!!a.emergencyCompatible);
        if (sos) return sos;
        const stock = Number(b.stock > 0) - Number(a.stock > 0);
        if (stock) return stock;
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return a.price - b.price;
      });
    }
    return rows;
  }, [filtered, sort, createdAtById]);

  const featured = useMemo(() => {
    return [...parts]
      .filter((p) => p.stock > 0)
      .sort((a, b) => {
        const sos = Number(!!b.emergencyCompatible) - Number(!!a.emergencyCompatible);
        if (sos) return sos;
        return (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
      })
      .slice(0, 5);
  }, [parts]);

  const activeFilterCount =
    (category ? 1 : 0) + brands.length + (inStockOnly ? 1 : 0) + (q.trim() ? 1 : 0);

  const toggleBrand = (brand: string) => {
    setBrands((prev) => (prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]));
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeFavorites(next);
      return next;
    });
  };

  const clearAllFilters = () => {
    setCategory("");
    setBrands([]);
    setInStockOnly(false);
    setQ("");
  };

  const title = category ? categoryLabelFn(t, category) : t("marketplace.category.spare_parts");

  const catalogEmpty = parts.length === 0;

  return (
    <div className="thalvo-catalog relative space-y-4 sm:space-y-5">
      {banner}

      {/* Web desktop: left edge tab. Mobile / native: header Filters only. */}
      {!filtersOpen && filterPresentation === "side" && (
        <button
          type="button"
          onClick={openFilters}
          className="fixed left-0 top-[38%] z-40 flex -translate-y-1/2 items-center gap-1.5 rounded-r-xl border border-l-0 border-[color:color-mix(in_srgb,var(--mos-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--mos-navy)_95%,transparent)] py-3 pl-2 pr-2.5 text-[color:var(--mos-cyan)] shadow-lg shadow-black/40 backdrop-blur-md sm:top-[32%]"
          aria-expanded={false}
          aria-controls="marketplace-filter-drawer"
        >
          <PanelLeft className="size-4" />
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.14em] sm:inline">
            {t("marketplace.catalog.filters")}
          </span>
          {activeFilterCount > 0 ? (
            <span className="grid min-w-5 place-items-center rounded-md bg-[color:var(--mos-cyan)] px-1 text-[10px] font-bold text-[color:var(--mos-navy)]">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      )}

      {/* Backdrop + side drawer (web) or bottom sheet (mobile app / narrow) */}
      <div
        className={
          "fixed inset-0 z-50 transition-[visibility] duration-200 " +
          (filtersOpen ? "visible" : "invisible pointer-events-none")
        }
      >
        <button
          type="button"
          aria-label={t("marketplace.catalog.close_filters")}
          onClick={closeFilters}
          className={
            "absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 " +
            (filtersOpen ? "opacity-100" : "opacity-0")
          }
        />
        <aside
          id="marketplace-filter-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={t("marketplace.catalog.filters")}
          className={
            filterPresentation === "bottom"
              ? "absolute inset-x-0 bottom-0 flex max-h-[min(88dvh,40rem)] flex-col rounded-t-3xl border border-b-0 border-white/10 bg-[#071422] shadow-2xl transition-transform duration-300 ease-out pb-[env(safe-area-inset-bottom)] " +
                (filtersOpen ? "translate-y-0" : "translate-y-full")
              : "absolute inset-y-0 left-0 flex w-[min(100vw-2.5rem,20rem)] flex-col border-r border-white/10 bg-[#071422] shadow-2xl transition-transform duration-300 ease-out sm:w-[22rem] " +
                (filtersOpen ? "translate-x-0" : "-translate-x-full")
          }
        >
          {filterPresentation === "bottom" ? (
            <div className="flex flex-col items-center pt-2">
              <span aria-hidden className="mb-1 h-1 w-10 rounded-full bg-white/25" />
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--mos-cyan)_85%,transparent)]">
                {t("marketplace.catalog.filter_panel")}
              </p>
              <p className="truncate text-sm font-semibold text-white">{t("marketplace.catalog.filters")}</p>
            </div>
            <button
              type="button"
              onClick={closeFilters}
              className="grid size-9 place-items-center rounded-xl border border-white/10 text-white/70 hover:bg-white/10"
              aria-label={t("marketplace.catalog.close_filters")}
            >
              {filterPresentation === "bottom" ? <X className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                {t("marketplace.catalog.quick_search")}
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/35" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("marketplace.catalog.quick_search_placeholder")}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-cyan-400/50"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] font-semibold text-white/85">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="size-3.5 rounded border-white/20 bg-white/5 text-cyan-400 focus:ring-cyan-400/40"
              />
              {t("marketplace.catalog.in_stock_only")}
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  {t("marketplace.catalog.product_groups")}
                </p>
                {category ? (
                  <button
                    type="button"
                    onClick={() => setCategory("")}
                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-cyan-300/90"
                  >
                    <ChevronLeft className="size-3" />
                    {t("marketplace.all_categories")}
                  </button>
                ) : null}
              </div>
              <ul className="space-y-0.5">
                <li>
                  <button
                    type="button"
                    onClick={() => setCategory("")}
                    className={
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] " +
                      (!category ? "bg-cyan-400/15 text-cyan-100" : "text-white/75 hover:bg-white/5")
                    }
                  >
                    <span className="font-medium">{t("marketplace.all_categories")}</span>
                    <span className="tabular-nums text-white/40">{parts.length}</span>
                  </button>
                </li>
                {groupCounts.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setCategory(g.id)}
                      className={
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] " +
                        (category === g.id
                          ? "bg-cyan-400/15 text-cyan-100"
                          : "text-white/75 hover:bg-white/5")
                      }
                    >
                      <span className="truncate font-medium">{categoryLabelFn(t, g.id)}</span>
                      <span className="tabular-nums text-white/40">{g.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  {t("marketplace.catalog.all_brands")}
                </p>
                {brands.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setBrands([])}
                    className="text-[11px] font-semibold text-cyan-300/90"
                  >
                    {t("marketplace.catalog.clear_brands")}
                  </button>
                ) : null}
              </div>
              {brandCounts.length === 0 ? (
                <p className="text-[12px] text-white/45">{t("marketplace.catalog.no_brands")}</p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto overscroll-contain pr-1 sm:max-h-64">
                  {brandCounts.map(({ brand, count }) => {
                    const checked = brands.includes(brand);
                    return (
                      <li key={brand}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-[13px] text-white/80 hover:bg-white/5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBrand(brand)}
                            className="size-3.5 rounded border-white/20 bg-white/5 text-cyan-400 focus:ring-cyan-400/40"
                          />
                          <span className="min-w-0 flex-1 truncate font-medium uppercase tracking-wide">
                            {brand}
                          </span>
                          <span className="tabular-nums text-white/40">({count})</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-white/10 p-4">
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="h-10 w-full rounded-xl border border-white/10 text-[12px] font-semibold text-white/70 hover:bg-white/5"
              >
                {t("marketplace.catalog.clear_all")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeFilters}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[color:var(--mos-cyan)] text-sm font-bold text-[color:var(--mos-navy)] transition-transform active:scale-[0.98]"
            >
              {t("marketplace.catalog.apply_filters", { count: visible.length })}
            </button>
          </div>
        </aside>
      </div>

      {/* Showroom masthead — tighter on mobile */}
      <header className="relative overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,#071422_0%,#0d2744_48%,#123a4f_100%)] sm:rounded-2xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.1] sm:opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,240,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.35) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative space-y-3 px-3 py-4 sm:space-y-4 sm:px-6 sm:py-6">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] text-white/45 sm:text-[11px]"
          >
            <span className="truncate">{t("marketplace.title")}</span>
            <span aria-hidden>/</span>
            <button
              type="button"
              onClick={() => setCategory("")}
              className="truncate text-white/70 hover:text-cyan-200"
            >
              {t("marketplace.category.spare_parts")}
            </button>
            {category ? (
              <>
                <span aria-hidden>/</span>
                <span className="truncate font-semibold text-cyan-200">{categoryLabelFn(t, category)}</span>
              </>
            ) : null}
          </nav>

          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--mos-cyan)_85%,transparent)] sm:text-[10px] sm:tracking-[0.22em]">
                  {t("marketplace.catalog.showroom_eyebrow")}
                </p>
                <h2 className="thalvo-catalog-rise mt-1 font-[Montserrat,ui-sans-serif,system-ui] text-xl font-bold tracking-tight text-white sm:text-3xl">
                  {title}
                </h2>
                <p className="mt-1 hidden max-w-xl text-[13px] leading-relaxed text-white/55 sm:block">
                  {t("marketplace.catalog.showroom_lede")}
                </p>
              </div>
              <button
                type="button"
                onClick={openFilters}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[color:color-mix(in_srgb,var(--mos-cyan)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--mos-cyan)_12%,transparent)] px-3 text-[11px] font-bold uppercase tracking-wide text-[color:var(--mos-cyan)] sm:h-11"
              >
                {filterPresentation === "bottom" ? (
                  <SlidersHorizontal className="size-3.5" />
                ) : (
                  <PanelLeft className="size-3.5" />
                )}
                {t("marketplace.catalog.filters")}
                {activeFilterCount > 0 ? (
                  <span className="rounded-md bg-[color:var(--mos-cyan)] px-1.5 py-0.5 text-[10px] text-[color:var(--mos-navy)]">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("marketplace.search_placeholder")}
                className="h-11 w-full rounded-xl border border-white/15 bg-black/25 pl-10 pr-10 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-400/50"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-white/45 hover:bg-white/10"
                  aria-label={t("marketplace.catalog.clear_search")}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Brand wall — compact tiles on mobile */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            {t("marketplace.catalog.brand_wall")}
          </p>
          {brands.length > 0 && (
            <button
              type="button"
              onClick={() => setBrands([])}
              className="text-[11px] font-semibold text-cyan-300/90 hover:text-cyan-200"
            >
              {t("marketplace.catalog.clear_brands")}
            </button>
          )}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 no-scrollbar">
          {brandCounts.map(({ brand, count }, idx) => {
            const on = brands.includes(brand);
            return (
              <button
                key={brand}
                type="button"
                onClick={() => toggleBrand(brand)}
                aria-pressed={on}
                style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                className={
                  "thalvo-catalog-brand group flex min-w-[5.75rem] shrink-0 flex-col items-start gap-1.5 rounded-xl border px-2.5 py-2.5 text-left transition-colors sm:min-w-[7.5rem] sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-3 " +
                  (on
                    ? "border-[color:color-mix(in_srgb,var(--mos-cyan)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--mos-cyan)_14%,transparent)]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]")
                }
              >
                <span
                  className={
                    "grid size-8 place-items-center rounded-lg text-[10px] font-bold tracking-wide sm:size-9 sm:rounded-xl sm:text-[11px] " +
                    (on
                      ? "bg-[color:var(--mos-cyan)] text-[color:var(--mos-navy)]"
                      : "bg-white/10 text-white/80")
                  }
                >
                  {brandInitials(brand)}
                </span>
                <span className="w-full">
                  <span className="block truncate text-[10px] font-bold uppercase tracking-[0.1em] text-white sm:text-[11px] sm:tracking-[0.12em]">
                    {brand}
                  </span>
                  <span className="mt-0.5 block text-[9px] tabular-nums text-white/40 sm:text-[10px]">
                    {t("marketplace.catalog.sku_count", { count })}
                  </span>
                </span>
              </button>
            );
          })}
          {brandCounts.length === 0 && (
            <p className="px-1 text-[12px] text-white/45">{t("marketplace.catalog.no_brands")}</p>
          )}
        </div>
      </section>

      {/* Aisle tabs */}
      <section className="-mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-0.5 no-scrollbar">
        <AisleTab
          active={!category}
          onClick={() => setCategory("")}
          label={t("marketplace.all_categories")}
          count={parts.length}
        />
        {groupCounts.map((g) => (
          <AisleTab
            key={g.id}
            active={category === g.id}
            onClick={() => setCategory(g.id)}
            label={categoryLabelFn(t, g.id)}
            count={g.count}
          />
        ))}
      </section>

      {/* Featured strip — hide when filtering; tighter cards on mobile */}
      {featured.length > 0 && !q && brands.length === 0 && !category && (
        <section className="space-y-2">
          <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            {t("marketplace.catalog.featured_desk")}
          </p>
          <div className="-mx-1 flex gap-2.5 overflow-x-auto overscroll-x-contain px-1 pb-1 no-scrollbar sm:gap-3">
            {featured.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setQ(p.name);
                  setCategory(p.category);
                }}
                className="relative flex min-w-[14.5rem] max-w-[16rem] shrink-0 gap-2.5 overflow-hidden rounded-xl border border-white/10 bg-[#0c1a2e] p-2.5 text-left transition-colors hover:border-cyan-400/35 sm:min-w-[16rem] sm:max-w-[18rem] sm:gap-3 sm:rounded-2xl sm:p-3"
              >
                <span className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[color:var(--mos-cyan)] to-[color:var(--mos-amber)]" />
                <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#132337] text-cyan-300/80 sm:size-14 sm:rounded-xl">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Ship className="size-5 sm:size-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-300/80">
                    {t("marketplace.catalog.featured_n", { n: i + 1 })} · {p.brand}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] font-semibold leading-snug text-white">{p.name}</p>
                  <p className="mt-1 text-[12px] font-bold tabular-nums text-[color:var(--mos-amber)]">{currencyFormat(p.price)}</p>
                </div>
                <ArrowUpRight className="size-3.5 shrink-0 text-white/30" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Desk toolbar */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:px-4 sm:py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-white/80">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="size-3.5 rounded border-white/20 bg-white/5 text-cyan-400 focus:ring-cyan-400/40"
            />
            {t("marketplace.catalog.in_stock_only")}
          </label>
          <p className="text-[12px] tabular-nums text-white/50">
            {t("marketplace.catalog.total_products", { count: visible.length })}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={
                "h-8 rounded-lg px-2.5 text-[11px] font-semibold " +
                (view === "grid" ? "bg-white text-slate-950" : "text-white/60 hover:text-white")
              }
            >
              {t("marketplace.catalog.view_grid")}
            </button>
            <button
              type="button"
              onClick={() => setView("desk")}
              className={
                "h-8 rounded-lg px-2.5 text-[11px] font-semibold " +
                (view === "desk" ? "bg-white text-slate-950" : "text-white/60 hover:text-white")
              }
            >
              {t("marketplace.catalog.view_desk")}
            </button>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as PartsSortId)}
            className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0f1c2e] px-2.5 text-[12px] font-semibold text-white outline-none focus:border-cyan-400/50 sm:flex-none"
            aria-label={t("marketplace.catalog.sort_label")}
          >
            <option value="recommended">{t("marketplace.catalog.sort_recommended")}</option>
            <option value="price_asc">{t("marketplace.catalog.sort_price_asc")}</option>
            <option value="price_desc">{t("marketplace.catalog.sort_price_desc")}</option>
            <option value="name">{t("marketplace.catalog.sort_name")}</option>
            <option value="newest">{t("marketplace.catalog.sort_newest")}</option>
          </select>
        </div>
      </div>

      {catalogEmpty ? (
        <div className="thalvo-catalog-rise rounded-2xl border border-dashed border-[color:color-mix(in_srgb,var(--mos-cyan)_25%,transparent)] bg-[color:color-mix(in_srgb,var(--mos-navy)_55%,transparent)] px-4 py-12 text-center">
          <Ship className="mx-auto size-8 text-[color:var(--mos-cyan)] opacity-70" />
          <p className="mt-3 text-sm font-semibold text-white">{t("marketplace.catalog.empty_catalog_title")}</p>
          <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-white/55">
            {t("marketplace.catalog.empty_catalog_body")}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center">
          <p className="text-sm text-white/60">{t("marketplace.no_parts_match")}</p>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-3 text-[12px] font-semibold text-[color:var(--mos-cyan)]"
            >
              {t("marketplace.catalog.clear_all")}
            </button>
          ) : null}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 pb-36 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {visible.map((p, i) => (
            <ShowroomCard
              key={p.id}
              part={p}
              favorited={favorites.has(p.id)}
              onToggleFavorite={() => toggleFavorite(p.id)}
              currencyFormat={currencyFormat}
              onAdd={onAdd}
              onNotify={onNotify}
              onAskAi={onAskAi}
              riseDelay={Math.min(i, 8) * 35}
            />
          ))}
        </div>
      ) : (
        <ul className="space-y-2 pb-36">
          {visible.map((p) => (
            <DeskRow
              key={p.id}
              part={p}
              favorited={favorites.has(p.id)}
              onToggleFavorite={() => toggleFavorite(p.id)}
              currencyFormat={currencyFormat}
              onAdd={onAdd}
              onNotify={onNotify}
              onAskAi={onAskAi}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AisleTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-semibold transition-colors sm:h-9 sm:gap-2 sm:px-3 sm:text-[11px] " +
        (active
          ? "border-[color:var(--mos-cyan)] bg-[color:var(--mos-cyan)] text-[color:var(--mos-navy)]"
          : "border-white/10 bg-transparent text-white/70 hover:border-white/25 hover:text-white")
      }
    >
      <span className="max-w-[9rem] truncate sm:max-w-none">{label}</span>
      <span className={"tabular-nums " + (active ? "text-[color:color-mix(in_srgb,var(--mos-navy)_70%,transparent)]" : "text-white/35")}>{count}</span>
    </button>
  );
}

function ShowroomCard({
  part,
  favorited,
  onToggleFavorite,
  currencyFormat,
  onAdd,
  onNotify,
  onAskAi,
  riseDelay = 0,
}: {
  part: PartCardData;
  favorited: boolean;
  onToggleFavorite: () => void;
  currencyFormat: (n: number) => string;
  onAdd: (p: PartCardData) => void;
  onNotify: (p: PartCardData) => void;
  onAskAi: (p: PartCardData) => void;
  riseDelay?: number;
}) {
  const { t } = useTranslation();
  const outOfStock = part.stock <= 0;

  return (
    <article
      style={{ animationDelay: `${riseDelay}ms` }}
      className="thalvo-catalog-rise flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#091525] transition-transform duration-300 hover:-translate-y-0.5 sm:rounded-2xl"
    >
      <div className="relative aspect-[16/10] bg-[radial-gradient(circle_at_30%_20%,#1a3a55,transparent_55%),#0e2136]">
        {part.imageUrl ? (
          <img src={part.imageUrl} alt={part.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-cyan-200/50">
            <Ship className="size-10 sm:size-12" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
              {part.brand || t("marketplace.product.no_image")}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#091525] to-transparent" />
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={t("marketplace.catalog.favorite")}
          aria-pressed={favorited}
          className={
            "absolute right-2 top-2 grid size-9 place-items-center rounded-full border backdrop-blur sm:right-2.5 sm:top-2.5 " +
            (favorited
              ? "border-rose-400/40 bg-rose-500/25 text-rose-200"
              : "border-white/15 bg-black/30 text-white/80")
          }
        >
          <Heart className={"size-4 " + (favorited ? "fill-current" : "")} />
        </button>
        {part.emergencyCompatible && (
          <span className="absolute left-2 top-2 rounded-md bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white sm:left-2.5 sm:top-2.5">
            SOS
          </span>
        )}
        <span className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-md border border-white/15 bg-black/40 px-2 py-0.5 font-mono text-[10px] text-white/70 backdrop-blur sm:bottom-2.5 sm:left-2.5">
          {part.sku || part.categoryLabel || part.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3 sm:gap-3 sm:p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--mos-cyan)_90%,transparent)]">
            {part.brand}
          </p>
          <h3 className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-white sm:text-[15px]">
            {part.name}
          </h3>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-white/8 pt-2.5 sm:gap-3 sm:pt-3">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
              {t("marketplace.catalog.thalvo_price")}
            </p>
            <p className="text-lg font-bold tabular-nums tracking-tight text-[color:var(--mos-amber)] sm:text-xl">
              {currencyFormat(part.price)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-white/40">
              {part.dealerName ?? t("marketplace.product.verified_dealer")}
              {part.marina ? ` · ${part.marina}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => onAskAi(part)}
              aria-label={t("marketplace.ai_thalvo")}
              className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-[color:var(--mos-cyan)] hover:bg-white/10"
            >
              <Sparkles className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => (outOfStock ? onNotify(part) : onAdd(part))}
              className={
                "inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-bold uppercase tracking-wide sm:px-3 " +
                (outOfStock
                  ? "border border-white/10 bg-white/5 text-white/50"
                  : "bg-[color:var(--mos-cyan)] text-[color:var(--mos-navy)] hover:brightness-110")
              }
            >
              <ShoppingCart className="size-3.5" />
              <span className="hidden xs:inline sm:inline">
                {outOfStock ? t("marketplace.product.notify_me") : t("marketplace.catalog.buy")}
              </span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function DeskRow({
  part,
  favorited,
  onToggleFavorite,
  currencyFormat,
  onAdd,
  onNotify,
  onAskAi,
}: {
  part: PartCardData;
  favorited: boolean;
  onToggleFavorite: () => void;
  currencyFormat: (n: number) => string;
  onAdd: (p: PartCardData) => void;
  onNotify: (p: PartCardData) => void;
  onAskAi: (p: PartCardData) => void;
}) {
  const { t } = useTranslation();
  const outOfStock = part.stock <= 0;

  return (
    <li className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-[#091525]/90 p-3 sm:flex-row sm:items-center sm:gap-3 sm:rounded-2xl">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#132337] text-cyan-300/70 sm:size-14">
          {part.imageUrl ? (
            <img src={part.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-[11px] font-bold tracking-wide">{brandInitials(part.brand)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80">
            {part.brand}
            {part.emergencyCompatible ? (
              <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] text-rose-200">SOS</span>
            ) : null}
          </p>
          <p className="truncate text-[13px] font-semibold text-white sm:text-[14px]">{part.name}</p>
          <p className="truncate font-mono text-[10px] text-white/40">
            {part.sku ?? "—"} · {part.marina ?? t("marketplace.product.verified_dealer")}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-2 sm:justify-end sm:border-0 sm:pt-0">
        <p className="text-base font-bold tabular-nums text-[color:var(--mos-amber)]">{currencyFormat(part.price)}</p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={t("marketplace.catalog.favorite")}
            className={
              "grid size-9 place-items-center rounded-lg border " +
              (favorited ? "border-rose-400/40 text-rose-300" : "border-white/10 text-white/50")
            }
          >
            <Heart className={"size-3.5 " + (favorited ? "fill-current" : "")} />
          </button>
          <button
            type="button"
            onClick={() => onAskAi(part)}
            className="grid size-9 place-items-center rounded-lg border border-white/10 text-cyan-200"
            aria-label={t("marketplace.ai_thalvo")}
          >
            <Sparkles className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => (outOfStock ? onNotify(part) : onAdd(part))}
            className={
              "inline-flex h-9 items-center gap-1 rounded-lg px-3 text-[11px] font-bold " +
              (outOfStock
                ? "border border-white/10 text-white/50"
                : "bg-[color:var(--mos-cyan)] text-[color:var(--mos-navy)]")
            }
          >
            <ShoppingCart className="size-3.5" />
            {outOfStock ? t("marketplace.product.notify_me") : t("marketplace.catalog.buy")}
          </button>
        </div>
      </div>
    </li>
  );
}
