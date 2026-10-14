import { useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Anchor, Search, X } from "lucide-react";
import { LeafletPointerGuard, stopMapEvent } from "@/lib/leaflet-dom";
import {
  chartPointCoords,
  chartPointName,
  ZONE_KIND_LABEL_KEYS,
  REPORT_CATEGORY_LABEL_KEYS,
  type ChartPoint,
  type CommunityReport,
  type MarineZone,
} from "@/lib/marine-data";

interface Props {
  zones: MarineZone[];
  reports: CommunityReport[];
  onSelect: (point: ChartPoint) => void;
  /** Optional strip rendered directly under the input (geo permission, etc.). */
  banner?: ReactNode;
  /** Brand mark — sits inside the command bar (left of search). */
  headerLeft?: ReactNode;
  /** Language + account — sits outside the command bar on the same row. */
  headerRight?: ReactNode;
  /** Extra chrome (metocean, mission pill, GPS chips) stacked under the search row. */
  below?: ReactNode;
}

/**
 * Map cockpit top chrome — Command Bar (C) search with Quiet Glass stack below.
 * Brand + search + LIVE share one bar; account/language stay outside on the right.
 */
export function ChartSearchBar({
  zones,
  reports,
  onSelect,
  banner,
  headerLeft,
  headerRight,
  below,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<ChartPoint[]>(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return [];
    const zoneHits: ChartPoint[] = zones
      .filter((z) => z.name.toLocaleLowerCase("tr").includes(q))
      .slice(0, 6)
      .map((zone) => ({ kind: "zone", zone }));
    const reportHits: ChartPoint[] = reports
      .filter((r) => r.title.toLocaleLowerCase("tr").includes(q))
      .slice(0, 6)
      .map((report) => ({ kind: "report", report }));
    return [...zoneHits, ...reportHits].slice(0, 8);
  }, [query, zones, reports]);

  const showDropdown = focused && query.trim().length > 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-col gap-1.5 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <LeafletPointerGuard className="pointer-events-none relative z-[10] flex min-w-0 items-center gap-2">
        <div className="pointer-events-auto relative z-0 min-w-0 flex-1">
          <div className="thalvo-on-dark flex h-11 min-w-0 items-center gap-2.5 overflow-hidden rounded-xl border border-white/15 bg-[#0a192f]/92 px-3 shadow-2xl backdrop-blur-md">
            {headerLeft ? (
              <>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden [&>span]:!size-7 [&>span>img]:!size-7">
                    {headerLeft}
                  </span>
                  <span className="hidden text-[11px] font-bold tracking-[0.14em] text-white sm:inline">
                    THALVO
                  </span>
                </div>
                <span className="h-4 w-px shrink-0 bg-white/15" aria-hidden />
              </>
            ) : null}
            <Search className="size-3.5 shrink-0 text-amber-300/90" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 120)}
              placeholder={t("chart.search_placeholder")}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-white placeholder:text-white/40 outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={(e) => {
                  stopMapEvent(e);
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label={t("common.clear")}
                className="grid size-5 shrink-0 place-items-center rounded-full text-white/40 hover:text-white/80"
              >
                <X className="size-3" />
              </button>
            ) : null}
            <span className="shrink-0 rounded-full border border-amber-300/40 bg-amber-400/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-100">
              {t("chart.live_pill")}
            </span>
          </div>

          {showDropdown && (
            <div className="thalvo-on-dark mt-1.5 max-h-[40vh] overflow-y-auto rounded-xl border border-white/12 bg-[#0a192f]/95 shadow-2xl backdrop-blur-md">
              {results.length === 0 ? (
                <p className="px-3.5 py-3 text-[11px] text-white/40">
                  {t("chart.search_no_results")}
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {results.map((point) => {
                    const coords = chartPointCoords(point);
                    const labelKey =
                      point.kind === "zone"
                        ? ZONE_KIND_LABEL_KEYS[point.zone.kind]
                        : REPORT_CATEGORY_LABEL_KEYS[point.report.category];
                    return (
                      <li
                        key={`${point.kind}-${point.kind === "zone" ? point.zone.id : point.report.id}`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            stopMapEvent(e);
                            setQuery("");
                            setFocused(false);
                            onSelect(point);
                          }}
                          className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-amber-400/10"
                        >
                          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-amber-200">
                            <Anchor className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-semibold text-white">
                              {chartPointName(point)}
                            </span>
                            <span className="block truncate text-[10px] text-white/45">
                              {t(labelKey)}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[9px] text-white/30">
                            {coords.lat.toFixed(2)}°, {coords.lng.toFixed(2)}°
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {headerRight ? (
          <div className="pointer-events-auto flex shrink-0 items-center justify-end gap-1.5">
            {headerRight}
          </div>
        ) : null}
      </LeafletPointerGuard>

      {banner ? (
        <LeafletPointerGuard className="pointer-events-auto min-w-0 w-full">{banner}</LeafletPointerGuard>
      ) : null}

      {below && (
        <div className="pointer-events-none flex min-w-0 w-full flex-col items-start gap-1.5">
          {below}
        </div>
      )}
    </div>
  );
}
