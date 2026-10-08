import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AlertOctagon, Anchor, Ruler, Waves, X } from "lucide-react";
import {
  chartPointCoords,
  chartPointName,
  formatDegrees,
  isValidChartPoint,
  zoneBottomLabel,
  REPORT_CATEGORY_LABEL_KEYS,
  SEABED_LABEL_KEYS,
  ZONE_KIND_LABEL_KEYS,
  type ChartPoint,
  type MarineZoneKind,
  type ReportCategory,
  type Seabed,
} from "@/lib/marine-data";
import { openEmergencyService } from "@/lib/emergency-service-bus";
import { fetchMetocean, nearestRegion, shelterStatus, type MetoceanSnapshot } from "@/lib/metocean";

interface Props {
  point: ChartPoint | null;
  /** The captain's own GPS fix, kept for callers that already pass it. */
  fix: { lat: number; lng: number } | null;
  onClose: () => void;
  onNavigate: (point: ChartPoint) => void;
  onEmergency: () => void;
}

function kindLabelKey(point: ChartPoint): string {
  if (point.kind === "zone") {
    const kind = point.zone?.kind as MarineZoneKind | undefined;
    return (kind && ZONE_KIND_LABEL_KEYS[kind]) || "marine.kind_marina";
  }
  const cat = point.report?.category as ReportCategory | undefined;
  return (cat && REPORT_CATEGORY_LABEL_KEYS[cat]) || "marine.report_cat_general";
}

/**
 * Place card on the chart. Depth, seabed and shelter stay; no route is drawn.
 */
export function ChartDetailSheet({ point, fix, onClose, onNavigate, onEmergency }: Props) {
  const { t } = useTranslation();
  const [displayPoint, setDisplayPoint] = useState<ChartPoint | null>(null);
  const [visible, setVisible] = useState(false);
  const [snapshot, setSnapshot] = useState<MetoceanSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    console.log("[ChartDetailSheet] props", { point, fix });
    if (isValidChartPoint(point)) {
      setDisplayPoint(point);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    // Parent cleared the selection.
    setVisible(false);
    setDisplayPoint(null);
  }, [point, fix]);

  useEffect(() => {
    if (!isValidChartPoint(displayPoint)) return;
    const { lat, lng } = chartPointCoords(displayPoint);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    let cancelled = false;
    const controller = new AbortController();
    setWeatherLoading(true);
    setSnapshot(null);
    fetchMetocean(lat, lng, controller.signal)
      .then((snap) => {
        if (!cancelled) setSnapshot(snap);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [displayPoint]);

  if (!isValidChartPoint(displayPoint) || typeof document === "undefined") return null;

  try {
    const coords = chartPointCoords(displayPoint);
    const name = chartPointName(displayPoint);
    const kindLabel = t(kindLabelKey(displayPoint));
    const depthM =
      displayPoint.kind === "zone"
        ? displayPoint.zone?.depth_m
        : displayPoint.report?.depth_m;
    const seabedLabel =
      displayPoint.kind === "report"
        ? displayPoint.report?.seabed
          ? t(
              SEABED_LABEL_KEYS[displayPoint.report.seabed as Seabed] ??
                "marine.seabed_sand",
            )
          : null
        : zoneBottomLabel(displayPoint.zone);
    const description =
      displayPoint.kind === "zone"
        ? displayPoint.zone?.description
        : displayPoint.report?.note;

    const region =
      Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
        ? nearestRegion(coords.lat, coords.lng)
        : "aegean";
    const shelter =
      snapshot && Number.isFinite(snapshot.windDirectionDeg)
        ? shelterStatus(region, snapshot.windDirectionDeg)
        : null;

    const sheet = (
      <div
        className={
          "pointer-events-none fixed inset-x-0 flex justify-center px-2 transition-transform duration-300 ease-out sm:px-4 " +
          (visible ? "translate-y-0" : "translate-y-[calc(100%+2rem)]")
        }
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)",
          zIndex: 999990,
        }}
      >
        <div className="pointer-events-auto flex max-h-[min(70dvh,calc(100dvh-env(safe-area-inset-bottom)-6.5rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#0a192f]/95 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="h-px w-full shrink-0 bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
          <div className="flex shrink-0 items-start justify-between gap-3 p-4 pb-2">
            <div className="min-w-0">
              <p className="truncate text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-200/80">
                {kindLabel}
              </p>
              <p className="mt-0.5 truncate text-base font-semibold text-white">{name}</p>
              <p className="mt-1 truncate font-mono text-[11px] text-white/50">
                {Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
                  ? formatDegrees(coords.lat, coords.lng)
                  : "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="overflow-y-auto overscroll-contain px-4 pb-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {depthM != null && Number.isFinite(depthM) && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-white/80">
                  <Ruler className="size-3 text-cyan-300/80" />
                  {t("marine.depth_m", { value: depthM })}
                </span>
              )}
              {seabedLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-white/80">
                  <Waves className="size-3 text-cyan-300/80" />
                  {seabedLabel}
                </span>
              )}
              {weatherLoading ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-white/40">
                  {t("chart.metocean_title")}…
                </span>
              ) : shelter ? (
                <span
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.06em] " +
                    (shelter.sheltered
                      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
                      : "border-amber-400/40 bg-amber-400/15 text-amber-100")
                  }
                >
                  {t(shelter.labelKey)}
                </span>
              ) : null}
            </div>

            {description ? (
              <p className="mt-3 text-[12px] leading-relaxed text-white/70">{description}</p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = displayPoint;
                  onNavigate(target);
                }}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-400/15 text-[12px] font-bold uppercase tracking-[0.06em] text-cyan-100 transition-colors hover:bg-cyan-400/25"
              >
                <Anchor className="size-4 shrink-0" />
                <span className="truncate">{t("chart.sheet_navigate")}</span>
              </button>
              <button
                type="button"
                onClick={onEmergency}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[12px] font-bold uppercase tracking-[0.06em] text-white transition-transform active:scale-[0.98]"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.68 0.24 25) 0%, oklch(0.6 0.24 18) 100%)",
                  boxShadow: "0 10px 30px -10px rgba(244,63,94,0.55)",
                }}
              >
                <AlertOctagon className="size-4 shrink-0" />
                <span className="truncate">{t("chart.sheet_emergency")}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const bay = chartPointName(displayPoint);
                onClose();
                openEmergencyService({ bayName: bay || undefined });
              }}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-400/10 text-[12px] font-bold uppercase tracking-[0.06em] text-cyan-100"
            >
              <Anchor className="size-4 shrink-0" />
              <span className="truncate">{t("esvc.entry_title")}</span>
            </button>
          </div>
        </div>
      </div>
    );

    return createPortal(sheet, document.body);
  } catch (err) {
    console.error("[ChartDetailSheet] render crash:", err);
    return createPortal(
      <div className="pointer-events-auto fixed inset-x-4 bottom-28 z-[999990] rounded-xl border border-rose-400/40 bg-[#0a192f]/95 p-3 text-[11px] text-rose-200">
        Nokta detayı açılamadı. {err instanceof Error ? err.message : String(err)}
      </div>,
      document.body,
    );
  }
}
