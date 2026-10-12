import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Camera,
  ChevronLeft,
  Filter,
  Heart,
  Search,
  ShoppingCart,
  Ship,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { GlassPanel } from "@/components/mission/GlassPanel";
import type { PartCardData } from "@/components/marketplace/PartCard";
import { PART_CATEGORIES } from "@/lib/marine-catalog";

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

export function PartsCatalogBoard({
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
  const [draftQ, setDraftQ] = useState("");
  const [category, setCategory] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<PartsSortId>("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : readFavorites(),
  );

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
      // recommended: SOS → in stock → nearer → price
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

  const popular = useMemo(() => {
    return [...parts]
      .filter((p) => p.stock > 0)
      .sort((a, b) => {
        const sos = Number(!!b.emergencyCompatible) - Number(!!a.emergencyCompatible);
        if (sos) return sos;
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - db;
      })
      .slice(0, 6);
  }, [parts]);

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

  const applySearch = () => setQ(draftQ);
  const clearCategory = () => setCategory("");

  const activeFilterCount =
    (category ? 1 : 0) + brands.length + (inStockOnly ? 1 : 0) + (q.trim() ? 1 : 0);

  const sidebar = (
    <aside className="space-y-3">
      <GlassPanel className="!p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
          {t("marketplace.catalog.product_groups")}
        </p>
        {category ? (
          <button
            type="button"
            onClick={clearCategory}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-white/70 hover:text-cyan-200"
          >
            <ChevronLeft className="size-3.5" />
            {t("marketplace.category.spare_parts")}
          </button>
        ) : (
          <p className="text-[11px] text-white/45">{t("marketplace.category.spare_parts")}</p>
        )}
        <ul className="max-h-56 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
          <li>
            <button
              type="button"
              onClick={clearCategory}
              className={
                "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors " +
                (!category ? "bg-cyan-400/15 text-cyan-100" : "text-white/75 hover:bg-white/5")
              }
            >
              <span className="truncate font-medium">{t("marketplace.all_categories")}</span>
              <span className="tabular-nums text-white/40">{parts.length}</span>
            </button>
          </li>
          {groupCounts.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => setCategory(g.id)}
                className={
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors " +
                  (category === g.id ? "bg-cyan-400/15 text-cyan-100" : "text-white/75 hover:bg-white/5")
                }
              >
                <span className="truncate font-medium">{categoryLabelFn(t, g.id)}</span>
                <span className="tabular-nums text-white/40">{g.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </GlassPanel>

      <GlassPanel className="!p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
          {t("marketplace.catalog.all_brands")}
        </p>
        {brandCounts.length === 0 ? (
          <p className="text-[11px] text-white/45">{t("marketplace.catalog.no_brands")}</p>
        ) : (
          <ul className="max-h-52 space-y-1 overflow-y-auto overscroll-contain pr-1">
            {brandCounts.map(({ brand, count }) => {
              const checked = brands.includes(brand);
              return (
                <li key={brand}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-[12px] text-white/80 hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBrand(brand)}
                      className="size-3.5 rounded border-white/20 bg-white/5 text-cyan-400 focus:ring-cyan-400/40"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium uppercase tracking-wide">{brand}</span>
                    <span className="tabular-nums text-white/40">({count})</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {brands.length > 0 && (
          <button
            type="button"
            onClick={() => setBrands([])}
            className="text-[11px] font-semibold text-cyan-300/90 hover:text-cyan-200"
          >
            {t("marketplace.catalog.clear_brands")}
          </button>
        )}
      </GlassPanel>

      <GlassPanel className="!p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
          {t("marketplace.catalog.quick_search")}
        </p>
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/35" />
            <input
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder={t("marketplace.catalog.quick_search_placeholder")}
              className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-2 text-[12px] text-white outline-none placeholder:text-white/35 focus:border-cyan-400/50"
            />
          </div>
          <button
            type="button"
            onClick={applySearch}
            className="h-9 shrink-0 rounded-lg bg-cyan-400 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-950"
          >
            {t("marketplace.catalog.search_btn")}
          </button>
        </div>
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setDraftQ("");
            }}
            className="text-[11px] font-semibold text-white/50 hover:text-white/80"
          >
            {t("marketplace.catalog.clear_search")}
          </button>
        )}
      </GlassPanel>

      {popular.length > 0 && (
        <GlassPanel className="!p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
            {t("marketplace.catalog.most_popular")}
          </p>
          <ul className="space-y-1.5">
            {popular.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDraftQ(p.name);
                    setQ(p.name);
                    setCategory(p.category);
                    setFiltersOpen(false);
                  }}
                  className="flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left hover:bg-white/5"
                >
                  <Camera className="mt-0.5 size-3.5 shrink-0 text-white/35" />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-white/85">{p.name}</span>
                    <span className="block text-[10px] text-white/40">
                      {p.brand} · {currencyFormat(p.price)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}
    </aside>
  );

  return (
    <div className="space-y-3">
      {banner}

      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-white/45">
        <span className="font-medium text-white/55">{t("marketplace.title")}</span>
        <span aria-hidden>/</span>
        <button
          type="button"
          onClick={clearCategory}
          className="font-medium text-white/70 hover:text-cyan-200"
        >
          {t("marketplace.category.spare_parts")}
        </button>
        {category ? (
          <>
            <span aria-hidden>/</span>
            <span className="font-semibold text-cyan-200">{categoryLabelFn(t, category)}</span>
          </>
        ) : null}
      </nav>

      <div className="flex items-end justify-between gap-3">
        <h2 className="min-w-0 text-xl font-bold tracking-tight text-white sm:text-2xl">
          {category ? categoryLabelFn(t, category) : t("marketplace.category.spare_parts")}
        </h2>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[11px] font-semibold text-white/80 lg:hidden"
        >
          <SlidersHorizontal className="size-3.5" />
          {t("marketplace.catalog.filters")}
          {activeFilterCount > 0 ? (
            <span className="rounded-md bg-cyan-400/20 px-1.5 py-0.5 text-[10px] text-cyan-200">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="hidden lg:block">{sidebar}</div>

        <div className="min-w-0 space-y-3">
          <GlassPanel className="!p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-white/80">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="size-3.5 rounded border-white/20 bg-white/5 text-cyan-400 focus:ring-cyan-400/40"
                />
                {t("marketplace.catalog.in_stock_only")}
              </label>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <p className="text-[12px] text-white/55">
                  {t("marketplace.catalog.total_products", { count: visible.length })}
                </p>
                <label className="inline-flex items-center gap-2 text-[11px] text-white/50">
                  <Filter className="size-3.5" />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as PartsSortId)}
                    className="h-9 rounded-lg border border-white/10 bg-[#0f1c2e] px-2 text-[12px] font-semibold text-white outline-none focus:border-cyan-400/50"
                    aria-label={t("marketplace.catalog.sort_label")}
                  >
                    <option value="recommended">{t("marketplace.catalog.sort_recommended")}</option>
                    <option value="price_asc">{t("marketplace.catalog.sort_price_asc")}</option>
                    <option value="price_desc">{t("marketplace.catalog.sort_price_desc")}</option>
                    <option value="name">{t("marketplace.catalog.sort_name")}</option>
                    <option value="newest">{t("marketplace.catalog.sort_newest")}</option>
                  </select>
                </label>
              </div>
            </div>
          </GlassPanel>

          {visible.length === 0 ? (
            <GlassPanel className="text-center">
              <p className="text-sm text-white/60">{t("marketplace.no_parts_match")}</p>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 gap-3 pb-36 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((p) => (
                <CatalogProductCard
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

      {filtersOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            className="thalvo-dark max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0A192F] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{t("marketplace.catalog.filters")}</p>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-white/60 hover:bg-white/10"
                aria-label={t("common.close", { defaultValue: "Close" })}
              >
                <X className="size-4" />
              </button>
            </div>
            {sidebar}
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-cyan-400 text-sm font-bold text-slate-950"
            >
              {t("marketplace.catalog.apply_filters", { count: visible.length })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogProductCard({
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
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1c2e]/90 transition-colors hover:border-cyan-400/35">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-white/8 bg-[#132337]">
        {part.imageUrl ? (
          <img
            src={part.imageUrl}
            alt={part.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-cyan-300/70">
            <Ship className="size-10" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
              {t("marketplace.product.no_image")}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={t("marketplace.catalog.favorite")}
          aria-pressed={favorited}
          className={
            "absolute right-2 top-2 grid size-9 place-items-center rounded-full border backdrop-blur-md transition-colors " +
            (favorited
              ? "border-rose-400/40 bg-rose-500/20 text-rose-300"
              : "border-white/15 bg-black/35 text-white/80 hover:bg-black/50")
          }
        >
          <Heart className={"size-4 " + (favorited ? "fill-current" : "")} />
        </button>
        {part.emergencyCompatible && (
          <span className="absolute left-2 top-2 rounded-full border border-rose-400/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-200">
            SOS
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        {part.brand ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/90">{part.brand}</p>
        ) : null}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-snug text-white">
          {part.name}
        </h3>
        {part.sku ? <p className="font-mono text-[10px] text-white/40">{part.sku}</p> : null}

        <div className="mt-auto space-y-1 border-t border-white/8 pt-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
                {t("marketplace.catalog.thalvo_price")}
              </p>
              <p className="text-lg font-bold tabular-nums text-amber-300">{currencyFormat(part.price)}</p>
            </div>
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => (outOfStock ? onNotify(part) : onAdd(part))}
              aria-label={
                outOfStock ? t("marketplace.product.notify_me") : t("marketplace.product.add_to_cart")
              }
              className={
                "grid size-10 place-items-center rounded-xl border transition-colors " +
                (outOfStock
                  ? "border-white/10 bg-white/5 text-white/45"
                  : "border-cyan-400/40 bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/25")
              }
            >
              <ShoppingCart className="size-4" />
            </button>
          </div>
          <p className="truncate text-[10px] text-white/40">
            {part.dealerName
              ? t("marketplace.product.sold_by", { dealer: part.dealerName })
              : t("marketplace.product.verified_dealer")}
            {part.marina ? ` · ${part.marina}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onAskAi(part)}
          className="text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300/70 hover:text-cyan-200"
        >
          {t("marketplace.ai_thalvo")}
        </button>
      </div>
    </article>
  );
}
