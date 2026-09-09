import { useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Anchor, Search, X } from "lucide-react";
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
  /** Top-row left: brand mark. When set with `headerRight`, search sits on the row below. */
  headerLeft?: ReactNode;
  /** Top-row right: language + account. */
  headerRight?: ReactNode;
  /** Extra chrome (metocean, mission pill, GPS chips) stacked under the search row. */
  below?: ReactNode;
}

/**
 * Map cockpit top chrome — one flex column so the search field never
 * paints over the logo / account controls. Row 1 is brand + actions;
 * row 2 is the full-width search bar.
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
  const hasHeader = Boolean(headerLeft || headerRight);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      {hasHeader && (
        <div className="pointer-events-auto relative z-[10] flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">{headerLeft}</div>
          <div className="flex shrink-0 items-center gap-1.5">{headerRight}</div>
        </div>
      )}

      <div className={"pointer-events-auto relative z-0 w-full " + (hasHeader ? "mt-2" : "")}>
        <div className="flex items-center gap-2 overflow-hidden rounded-full border border-cyan-500/30 bg-[#0a192f]/90 px-3.5 py-2 shadow-2xl backdrop-blur-md">
          <Search className="size-3.5 shrink-0 text-cyan-300/80" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            placeholder={t("chart.search_placeholder")}
            className="min-w-0 flex-1 bg-transparent text-[12px] text-white placeholder:text-white/40 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label={t("common.clear")}
              className="grid size-5 shrink-0 place-items-center rounded-full text-white/40 hover:text-white/80"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {banner}

        {showDropdown && (
          <div className="mt-1.5 max-h-[40vh] overflow-y-auto rounded-xl border border-cyan-500/30 bg-[#0a192f]/95 shadow-2xl backdrop-blur-md">
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
                        onClick={() => {
                          setQuery("");
                          setFocused(false);
                          onSelect(point);
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-cyan-400/10"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cyan-400/10 text-cyan-200">
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

      {below && (
        <div className="pointer-events-auto mt-2 flex flex-col items-start gap-2">{below}</div>
      )}
    </div>
  );
}
