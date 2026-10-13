import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Heart,
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
import type { PartsSortId } from "@/lib/parts-catalog-sort";

/** Narrow / native → bottom sheet; wide web → docked left rail. */
function useMobileSheet(): boolean {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    if (isNativeWebView()) return true;
    return window.matchMedia("(max-width: 1023px)").matches;
  });
  useEffect(() => {
    if (isNativeWebView()) {
      setMobile(true);
      return;
    }
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
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
    /* ignore */
  }
}

function brandInitials(brand: string): string {
  const parts = brand.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Design C — Day Counter: light authorised-dealer desk (default marketplace).
 * Design B remains in PartsCatalogShowroom as archive.
 */
export function PartsCatalogDayDesk({
  parts,
  rawParts,
  currencyFormat,
  onAdd,
  onNotify,
  onAskAi,
  banner,
}: Props) {
  const { t } = useTranslation();
  const mobileSheet = useMobileSheet();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<PartsSortId>("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
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
    for (const p of parts) live.set(p.category, (live.get(p.category) ?? 0) + 1);
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
      const hay = [p.name, p.brand, p.sku ?? "", p.categoryLabel ?? p.category, ...(p.compatibility ?? [])]
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
      rows.sort((a, b) => (createdAtById.get(b.id) ?? "").localeCompare(createdAtById.get(a.id) ?? ""));
    } else {
      rows.sort((a, b) => {
        const sos = Number(!!b.emergencyCompatible) - Number(!!a.emergencyCompatible);
        if (sos) return sos;
        const stock = Number(b.stock > 0) - Number(a.stock > 0);
        if (stock) return stock;
        return a.price - b.price;
      });
    }
    return rows;
  }, [filtered, sort, createdAtById]);

  const activeFilterCount =
    (category ? 1 : 0) + brands.length + (inStockOnly ? 1 : 0) + (q.trim() ? 1 : 0);

  const toggleBrand = (brand: string) => {
    setBrands((prev) => (prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]));
  };

  const clearAll = () => {
    setCategory("");
    setBrands([]);
    setInStockOnly(false);
    setQ("");
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

  const title = category ? categoryLabelFn(t, category) : t("marketplace.category.spare_parts");

  const filterBody = (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {t("marketplace.catalog.product_groups")}
        </p>
        <ul className="mt-2 space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => setCategory("")}
              className={
                "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-[13px] " +
                (!category ? "bg-[#0A192F] font-semibold text-white" : "text-slate-700 hover:bg-slate-100")
              }
            >
              <span>{t("marketplace.all_categories")}</span>
              <span className={!category ? "text-white/60" : "text-slate-400"}>{parts.length}</span>
            </button>
          </li>
          {groupCounts.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => setCategory(g.id)}
                className={
                  "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-[13px] " +
                  (category === g.id
                    ? "bg-[#0A192F] font-semibold text-white"
                    : "text-slate-700 hover:bg-slate-100")
                }
              >
                <span className="truncate">{categoryLabelFn(t, g.id)}</span>
                <span className={category === g.id ? "text-white/60" : "text-slate-400"}>{g.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {t("marketplace.catalog.all_brands")}
        </p>
        <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
          {brandCounts.map(({ brand, count }) => (
            <li key={brand}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={brands.includes(brand)}
                  onChange={() => toggleBrand(brand)}
                  className="size-3.5 rounded border-slate-300 text-[#0A192F] focus:ring-[#00F0FF]/40"
                />
                <span className="min-w-0 flex-1 truncate font-medium uppercase tracking-wide">{brand}</span>
                <span className="text-slate-400">({count})</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => setInStockOnly(e.target.checked)}
          className="size-3.5 rounded border-slate-300 text-[#0A192F]"
        />
        {t("marketplace.catalog.in_stock_only")}
      </label>
    </div>
  );

  return (
    <div className="space-y-3">
      {banner}
      <div className="-mx-1 space-y-4 rounded-2xl bg-[#EEF2F6] p-3 text-slate-900 sm:mx-0 sm:p-4">
      {/* Day masthead */}
      <header className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <nav className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          <span>{t("marketplace.title")}</span>
          <span>/</span>
          <button type="button" onClick={() => setCategory("")} className="hover:text-[#0A192F]">
            {t("marketplace.category.spare_parts")}
          </button>
          {category ? (
            <>
              <span>/</span>
              <span className="font-semibold text-[#0A192F]">{categoryLabelFn(t, category)}</span>
            </>
          ) : null}
        </nav>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {t("marketplace.catalog.day_eyebrow")}
            </p>
            <h2 className="mt-1 font-[Montserrat,ui-sans-serif,system-ui] text-2xl font-bold tracking-tight text-[#0A192F] sm:text-3xl">
              {title}
            </h2>
            <p className="mt-1 max-w-xl text-[13px] text-slate-600">{t("marketplace.catalog.day_lede")}</p>
          </div>
          <div className="flex w-full max-w-md gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("marketplace.search_placeholder")}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#00F0FF] focus:bg-white"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
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
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#0A192F] px-3 text-[11px] font-bold uppercase tracking-wide text-white"
              >
                <SlidersHorizontal className="size-3.5" />
                {t("marketplace.catalog.filters")}
                {activeFilterCount > 0 ? (
                  <span className="rounded bg-[#00F0FF] px-1.5 text-[10px] text-[#0A192F]">{activeFilterCount}</span>
                ) : null}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRailOpen((v) => !v)}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold uppercase tracking-wide text-[#0A192F]"
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
          "grid gap-4 " +
          (!mobileSheet && railOpen ? "lg:grid-cols-[240px_minmax(0,1fr)]" : "")
        }
      >
        {/* Desktop docked rail */}
        {!mobileSheet && railOpen && (
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-[#0A192F]">{t("marketplace.catalog.filters")}</p>
              {activeFilterCount > 0 && (
                <button type="button" onClick={clearAll} className="text-[11px] font-semibold text-slate-500">
                  {t("marketplace.catalog.clear_all")}
                </button>
              )}
            </div>
            {filterBody}
          </aside>
        )}

        <div className="min-w-0 space-y-3">
          {/* Quick aisle chips */}
          <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 no-scrollbar">
            <button
              type="button"
              onClick={() => setCategory("")}
              className={
                "h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-semibold " +
                (!category
                  ? "border-[#0A192F] bg-[#0A192F] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")
              }
            >
              {t("marketplace.all_categories")} · {parts.length}
            </button>
            {groupCounts.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setCategory(g.id === category ? "" : g.id)}
                className={
                  "h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-semibold " +
                  (category === g.id
                    ? "border-[#0A192F] bg-[#0A192F] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")
                }
              >
                {categoryLabelFn(t, g.id)} · {g.count}
              </button>
            ))}
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {category ? (
                <FilterChip
                  label={categoryLabelFn(t, category)}
                  onRemove={() => setCategory("")}
                />
              ) : null}
              {brands.map((b) => (
                <FilterChip key={b} label={b} onRemove={() => toggleBrand(b)} />
              ))}
              {inStockOnly ? (
                <FilterChip
                  label={t("marketplace.catalog.in_stock_only")}
                  onRemove={() => setInStockOnly(false)}
                />
              ) : null}
              {q.trim() ? (
                <FilterChip label={`“${q.trim()}”`} onRemove={() => setQ("")} />
              ) : null}
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] font-semibold text-slate-500 underline-offset-2 hover:underline"
              >
                {t("marketplace.catalog.clear_all")}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <p className="text-[13px] font-semibold text-slate-600">
              {t("marketplace.catalog.total_products", { count: visible.length })}
            </p>
            <label className="inline-flex items-center gap-2 text-[12px] text-slate-500">
              <ChevronDown className="size-3.5" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as PartsSortId)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-semibold text-[#0A192F] outline-none"
              >
                <option value="recommended">{t("marketplace.catalog.sort_recommended")}</option>
                <option value="price_asc">{t("marketplace.catalog.sort_price_asc")}</option>
                <option value="price_desc">{t("marketplace.catalog.sort_price_desc")}</option>
                <option value="name">{t("marketplace.catalog.sort_name")}</option>
                <option value="newest">{t("marketplace.catalog.sort_newest")}</option>
              </select>
            </label>
          </div>

          {parts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
              <Ship className="mx-auto size-8 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-[#0A192F]">{t("marketplace.catalog.empty_catalog_title")}</p>
              <p className="mx-auto mt-1 max-w-md text-[12px] text-slate-500">
                {t("marketplace.catalog.empty_catalog_body")}
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
              <p className="text-sm text-slate-600">{t("marketplace.no_parts_match")}</p>
              <button type="button" onClick={clearAll} className="mt-2 text-[12px] font-semibold text-[#0A192F]">
                {t("marketplace.catalog.clear_all")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 pb-28 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((p) => (
                <DayCard
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
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet */}
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
              "absolute inset-0 bg-slate-900/40 transition-opacity " + (filtersOpen ? "opacity-100" : "opacity-0")
            }
            aria-label={t("marketplace.catalog.close_filters")}
            onClick={() => setFiltersOpen(false)}
          />
          <aside
            className={
              "absolute inset-x-0 bottom-0 flex max-h-[min(88dvh,40rem)] flex-col rounded-t-3xl border border-b-0 border-slate-200 bg-white shadow-2xl transition-transform duration-300 pb-[env(safe-area-inset-bottom)] " +
              (filtersOpen ? "translate-y-0" : "translate-y-full")
            }
          >
            <div className="flex flex-col items-center pt-2">
              <span className="mb-1 h-1 w-10 rounded-full bg-slate-300" />
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-bold text-[#0A192F]">{t("marketplace.catalog.filters")}</p>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{filterBody}</div>
            <div className="space-y-2 border-t border-slate-100 p-4">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="h-10 w-full rounded-xl border border-slate-200 text-[12px] font-semibold text-slate-600"
                >
                  {t("marketplace.catalog.clear_all")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-[#0A192F] text-sm font-bold text-white"
              >
                {t("marketplace.catalog.apply_filters", { count: visible.length })}
              </button>
            </div>
          </aside>
        </div>
      )}
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex h-7 max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-[#0A192F]"
    >
      <span className="truncate">{label}</span>
      <X className="size-3 shrink-0 text-slate-400" />
    </button>
  );
}

function DayCard({
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
  const out = part.stock <= 0;
  const low = !out && part.stock <= 2;
  const stockLabel = out
    ? t("marketplace.product.out_of_stock")
    : low
      ? t("marketplace.product.running_low")
      : t("marketplace.product.stock_ready");
  const stockTone = out
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : low
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-emerald-50 text-emerald-800 border-emerald-200";

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-gradient-to-b from-slate-100 to-slate-50">
        {part.imageUrl ? (
          <img src={part.imageUrl} alt={part.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
            <span className="grid size-14 place-items-center rounded-2xl bg-white text-[15px] font-bold tracking-wide text-[#0A192F] shadow-sm">
              {brandInitials(part.brand)}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]">{part.brand}</span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorited}
          className={
            "absolute right-2 top-2 grid size-9 place-items-center rounded-full border bg-white/95 shadow-sm " +
            (favorited ? "border-rose-300 text-rose-500" : "border-slate-200 text-slate-500")
          }
          aria-label={t("marketplace.catalog.favorite")}
        >
          <Heart className={"size-4 " + (favorited ? "fill-current" : "")} />
        </button>
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {part.emergencyCompatible && (
            <span className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">SOS</span>
          )}
          <span className={"rounded border px-2 py-0.5 text-[10px] font-bold " + stockTone}>{stockLabel}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{part.brand}</p>
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[14px] font-semibold leading-snug text-[#0A192F]">
          {part.name}
        </h3>
        {part.sku ? <p className="font-mono text-[10px] text-slate-400">{part.sku}</p> : null}
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-2.5">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {t("marketplace.catalog.thalvo_price")}
            </p>
            <p className="text-lg font-bold tabular-nums text-[#F5B942]">{currencyFormat(part.price)}</p>
            <p className="truncate text-[10px] text-slate-500">
              {part.dealerName ?? t("marketplace.product.verified_dealer")}
              {part.marina ? ` · ${part.marina}` : ""}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onAskAi(part)}
              className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label={t("marketplace.ai_thalvo")}
            >
              <Sparkles className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => (out ? onNotify(part) : onAdd(part))}
              className={
                "inline-flex h-10 items-center gap-1 rounded-xl px-3 text-[11px] font-bold uppercase transition-transform active:scale-[0.98] " +
                (out ? "border border-slate-200 text-slate-500" : "bg-[#0A192F] text-white hover:bg-[#122845]")
              }
            >
              <ShoppingCart className="size-3.5" />
              {out ? t("marketplace.product.notify_me") : t("marketplace.catalog.buy")}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
