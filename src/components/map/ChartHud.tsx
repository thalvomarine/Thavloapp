import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Anchor,
  Crosshair,
  Download,
  Fuel,
  Globe2,
  Layers,
  Loader2,
  Map,
  MapPin,
  Menu,
  Moon,
  Plus,
  Satellite,
  Ship,
  Wrench,
  X,
} from "lucide-react";
import { formatDegrees } from "@/lib/marine-data";
import { LeafletPointerGuard, stopMapEvent } from "@/lib/leaflet-dom";
import { CompassMark } from "@/components/brand/CompassMark";
import { openThalvoAi } from "@/lib/thalvo-ai-bus";

export interface ChartLayers {
  seamarks: boolean;
  hazards: boolean;
  moorings: boolean;
  /** Approved captain-advice pins ("Kullanıcı Tavsiye Noktaları"). */
  reports: boolean;
  fleet: boolean;
}

export type ChartLayerKey = keyof ChartLayers;

export type ChartRegion = "aegean" | "mediterranean";
export type BasemapId = "sea" | "sat" | "dark";

export const BASEMAP_CYCLE: BasemapId[] = ["sat", "sea", "dark"];

export function nextBasemap(current: BasemapId): BasemapId {
  const i = BASEMAP_CYCLE.indexOf(current);
  return BASEMAP_CYCLE[(i + 1) % BASEMAP_CYCLE.length];
}

interface Props {
  layers: ChartLayers;
  onToggleLayer: (key: ChartLayerKey) => void;
  onJump: (region: ChartRegion) => void;
  filters?: Record<PoiFilterKey, boolean>;
  onToggleFilter?: (key: PoiFilterKey) => void;
  /** Admin-only draw mode: next map click opens the new-point modal. */
  isAdmin?: boolean;
  drawing?: boolean;
  onToggleDraw?: () => void;
  /** Captain contribution entry point. */
  canContribute?: boolean;
  onAddReport?: () => void;
  /**
   * Desktop HUD expanded/collapsed — driven by the panel chevron.
   */
  panelOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
  basemap?: BasemapId;
  onSelectBasemap?: (id: BasemapId) => void;
  /** Prefetch Göcek–Fethiye–Bozburun chart tiles for offline use. */
  onDownloadOfflineTiles?: () => void;
  tileDownloadPercent?: number | null;
  tileDownloadActive?: boolean;
}

const LAYER_ROWS: Array<{ key: ChartLayerKey; labelKey: string; dot: string }> = [
  { key: "seamarks", labelKey: "chart.layer_seamarks", dot: "bg-amber-300" },
  { key: "hazards", labelKey: "chart.layer_hazards", dot: "bg-red-400" },
  { key: "moorings", labelKey: "chart.layer_moorings", dot: "bg-emerald-300" },
  { key: "reports", labelKey: "chart.layer_reports", dot: "bg-amber-300" },
  { key: "fleet", labelKey: "chart.layer_fleet", dot: "bg-slate-300" },
];

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className="relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full border transition-all duration-200"
      style={{
        borderColor: on ? "var(--sheet-active-border)" : "var(--sheet-border)",
        background: on ? "var(--sheet-active-bg)" : "var(--sheet-switch-off)",
      }}
    >
      <span
        className={
          "absolute size-3 rounded-full transition-all duration-200 " +
          (on ? "left-[17px]" : "left-[3px]")
        }
        style={{
          background: on ? "var(--sheet-active-ink)" : "var(--sheet-faint)",
        }}
      />
    </span>
  );
}

const SHEET_BTN =
  "border border-[var(--sheet-border)] bg-[var(--sheet-chip)] text-[var(--sheet-ink)] hover:bg-[var(--sheet-chip-hover)]";
const SHEET_BTN_ACTIVE =
  "border border-[var(--sheet-active-border)] bg-[var(--sheet-active-bg)] text-[var(--sheet-ink)]";

const RAIL_BTN =
  "grid size-8 place-items-center rounded-[10px] border text-[var(--sheet-muted)] transition-colors hover:bg-[var(--sheet-chip-hover)] hover:text-[var(--sheet-ink)]";
const RAIL_BTN_ACTIVE =
  "border-[var(--sheet-active-border)] bg-[var(--sheet-active-bg)] text-[var(--sheet-active-ink)] hover:bg-[var(--sheet-active-bg)]";
const RAIL_BTN_IDLE = "border-[var(--sheet-border)] bg-transparent";

/**
 * Shared body — region quick-jump pills, layer toggles and the
 * contribute/draw actions. Rendered inside the desktop command panel
 * and the mobile full-width bottom sheet so the two never drift apart.
 */
function ChartHudBody({
  layers,
  onToggleLayer,
  onJump,
  filters,
  onToggleFilter,
  isAdmin,
  drawing,
  onToggleDraw,
  canContribute,
  onAddReport,
  basemap = "sat",
  onSelectBasemap,
  onDownloadOfflineTiles,
  tileDownloadPercent,
  tileDownloadActive,
}: Pick<
  Props,
  | "layers"
  | "onToggleLayer"
  | "onJump"
  | "filters"
  | "onToggleFilter"
  | "isAdmin"
  | "drawing"
  | "onToggleDraw"
  | "canContribute"
  | "onAddReport"
  | "basemap"
  | "onSelectBasemap"
  | "onDownloadOfflineTiles"
  | "tileDownloadPercent"
  | "tileDownloadActive"
>) {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            ["aegean", "chart.jump_aegean"],
            ["mediterranean", "chart.jump_mediterranean"],
          ] as const
        ).map(([id, labelKey]) => (
          <button
            key={id}
            type="button"
            onClick={(e) => {
              stopMapEvent(e);
              onJump(id);
            }}
            className={"h-10 rounded-xl text-[12px] font-semibold transition-colors " + SHEET_BTN}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
      {filters && onToggleFilter && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {(
            [
              ["marinas", "chart.filter_marinas"],
              ["fuel", "chart.filter_fuel"],
              ["service", "chart.filter_service"],
            ] as const
          ).map(([key, labelKey]) => {
            const on = filters[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={(e) => {
                  stopMapEvent(e);
                  onToggleFilter(key);
                }}
                className={
                  "h-9 rounded-lg text-[10px] font-semibold " +
                  (on ? SHEET_BTN_ACTIVE : SHEET_BTN)
                }
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      )}

      {onSelectBasemap && (
        <div className="mt-3 space-y-1.5">
          {(
            [
              { id: "sat" as const, Icon: Satellite, labelKey: "chart.basemap_sat" },
              { id: "sea" as const, Icon: Globe2, labelKey: "chart.basemap_sea" },
              { id: "dark" as const, Icon: Moon, labelKey: "chart.basemap_dark" },
            ] as const
          ).map(({ id, Icon, labelKey }) => {
            const on = basemap === id;
            return (
              <button
                key={id}
                type="button"
                onPointerDown={stopMapEvent}
                onClick={(e) => {
                  stopMapEvent(e);
                  onSelectBasemap(id);
                }}
                aria-pressed={on}
                className={
                  "flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left transition-colors " +
                  (on ? SHEET_BTN_ACTIVE : SHEET_BTN)
                }
              >
                <Icon
                  className="size-4 shrink-0"
                  style={{ color: "var(--sheet-active-ink)" }}
                />
                <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug">
                  {t(labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <ul
        className="mt-3 space-y-0.5 border-t pt-3"
        style={{ borderColor: "var(--sheet-border)" }}
      >
        {LAYER_ROWS.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              onPointerDown={stopMapEvent}
              onClick={(e) => {
                stopMapEvent(e);
                onToggleLayer(row.key);
              }}
              aria-pressed={layers[row.key]}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--sheet-chip-hover)]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={
                    "size-1.5 shrink-0 rounded-full transition-opacity " +
                    row.dot +
                    (layers[row.key] ? " opacity-100" : " opacity-25")
                  }
                />
                <span
                  className="text-[12px] font-medium leading-snug"
                  style={{
                    color: layers[row.key]
                      ? "var(--sheet-ink)"
                      : "var(--sheet-faint)",
                  }}
                >
                  {t(row.labelKey)}
                </span>
              </span>
              <Switch on={layers[row.key]} />
            </button>
          </li>
        ))}
      </ul>

      {onDownloadOfflineTiles && (
        <div
          className="mt-3 border-t pt-3"
          style={{ borderColor: "var(--sheet-border)" }}
        >
          <button
            type="button"
            onPointerDown={stopMapEvent}
            onClick={(e) => {
              stopMapEvent(e);
              onDownloadOfflineTiles();
            }}
            className={
              "flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border text-[11px] font-bold uppercase tracking-[0.04em] transition-all " +
              (tileDownloadActive
                ? "border-amber-400/50 bg-amber-400/15 text-amber-100"
                : SHEET_BTN)
            }
          >
            {tileDownloadActive ? (
              <>
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
                <span className="min-w-0 truncate">
                  {t("chart.offline_download_progress", {
                    percent: tileDownloadPercent ?? 0,
                  })}
                </span>
              </>
            ) : (
              <>
                <Ship className="size-3.5 shrink-0" />
                <span className="min-w-0 text-center leading-snug">
                  {t("chart.offline_download")}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {(canContribute || isAdmin) && (
        <div
          className="mt-3 space-y-1.5 border-t pt-3"
          style={{ borderColor: "var(--sheet-border)" }}
        >
          {canContribute && (
            <button
              type="button"
              onPointerDown={stopMapEvent}
              onClick={(e) => {
                stopMapEvent(e);
                onAddReport?.();
              }}
              className={
                "flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.06em] transition-all " +
                SHEET_BTN
              }
            >
              <Plus className="size-3.5 shrink-0" />
              <span className="min-w-0 text-center leading-snug">
                {t("chart.add_report")}
              </span>
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onPointerDown={stopMapEvent}
              onClick={(e) => {
                stopMapEvent(e);
                onToggleDraw?.();
              }}
              aria-pressed={drawing}
              className={
                "flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.06em] transition-all " +
                (drawing
                  ? "border border-orange-400/60 bg-orange-400/25 text-orange-100"
                  : SHEET_BTN)
              }
            >
              <Crosshair className="size-3.5 shrink-0" />
              <span className="min-w-0 text-center leading-snug">
                {drawing ? t("chart.draw_active") : t("chart.draw_point")}
              </span>
            </button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * ChartHud — Command Bar icon rail (C) on desktop/tablet.
 * Collapsed = compact vertical rail; expanded = Quiet Glass panel to the left.
 * Phones keep using the Layers FAB in `ChartFabStack`.
 */
export function ChartHud({
  layers,
  onToggleLayer,
  onJump,
  filters,
  onToggleFilter,
  isAdmin = false,
  drawing = false,
  onToggleDraw,
  canContribute = false,
  onAddReport,
  panelOpen,
  onPanelOpenChange,
  basemap = "sat",
  onSelectBasemap,
  onDownloadOfflineTiles,
  tileDownloadPercent,
  tileDownloadActive,
}: Props) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = panelOpen ?? uncontrolledOpen;
  const setOpen = (update: boolean | ((current: boolean) => boolean)) => {
    const next = typeof update === "function" ? update(open) : update;
    onPanelOpenChange?.(next);
    if (panelOpen === undefined) setUncontrolledOpen(next);
  };

  return (
    <LeafletPointerGuard className="pointer-events-auto absolute top-[calc(env(safe-area-inset-top)+4.75rem)] right-3 z-[500] hidden items-start gap-2 lg:flex">
      {open ? (
        <div className="thalvo-chart-sheet flex max-h-[min(72vh,36rem)] w-[min(280px,calc(100vw-6.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md">
          <div className="shrink-0 border-b px-3 py-2.5" style={{ borderColor: "var(--sheet-border)" }}>
            <p className="text-[12px] font-semibold" style={{ color: "var(--sheet-ink)" }}>
              {t("chart.hud_title")}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 text-xs">
            <ChartHudBody
              layers={layers}
              onToggleLayer={onToggleLayer}
              onJump={onJump}
              filters={filters}
              onToggleFilter={onToggleFilter}
              isAdmin={isAdmin}
              drawing={drawing}
              onToggleDraw={onToggleDraw}
              canContribute={canContribute}
              onAddReport={onAddReport}
              basemap={basemap}
              onSelectBasemap={onSelectBasemap}
              onDownloadOfflineTiles={onDownloadOfflineTiles}
              tileDownloadPercent={tileDownloadPercent}
              tileDownloadActive={tileDownloadActive}
            />
          </div>
        </div>
      ) : null}

      <div className="thalvo-chart-sheet flex w-[52px] flex-col items-center gap-2 rounded-2xl border p-2 shadow-2xl backdrop-blur-md">
        <button
          type="button"
          onPointerDown={stopMapEvent}
          onClick={(e) => {
            stopMapEvent(e);
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-label={open ? t("chart.collapse") : t("chart.expand")}
          title={t("chart.hud_title")}
          className={RAIL_BTN + " " + (open ? RAIL_BTN_ACTIVE : RAIL_BTN_IDLE)}
        >
          {open ? <Menu className="size-3.5" /> : <Layers className="size-3.5" />}
        </button>

        {onSelectBasemap ? (
          <button
            type="button"
            onPointerDown={stopMapEvent}
            onClick={(e) => {
              stopMapEvent(e);
              onSelectBasemap(nextBasemap(basemap));
            }}
            title={t(`chart.basemap_${basemap}`)}
            aria-label={t(`chart.basemap_${basemap}`)}
            className={
              RAIL_BTN +
              " " +
              (basemap !== "dark" ? RAIL_BTN_ACTIVE : RAIL_BTN_IDLE)
            }
          >
            {basemap === "sea" ? (
              <Globe2 className="size-3.5" />
            ) : (
              <Map className="size-3.5" />
            )}
          </button>
        ) : null}

        {onSelectBasemap ? (
          <button
            type="button"
            onPointerDown={stopMapEvent}
            onClick={(e) => {
              stopMapEvent(e);
              onSelectBasemap("dark");
            }}
            title={t("chart.basemap_dark")}
            aria-label={t("chart.basemap_dark")}
            aria-pressed={basemap === "dark"}
            className={RAIL_BTN + " " + (basemap === "dark" ? RAIL_BTN_ACTIVE : RAIL_BTN_IDLE)}
          >
            <Moon className="size-3.5" />
          </button>
        ) : null}

        {canContribute ? (
          <button
            type="button"
            onPointerDown={stopMapEvent}
            onClick={(e) => {
              stopMapEvent(e);
              onAddReport?.();
            }}
            title={t("chart.add_report")}
            aria-label={t("chart.add_report")}
            className={RAIL_BTN + " " + RAIL_BTN_IDLE}
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}

        {onDownloadOfflineTiles ? (
          <button
            type="button"
            onPointerDown={stopMapEvent}
            onClick={(e) => {
              stopMapEvent(e);
              onDownloadOfflineTiles();
            }}
            title={t("chart.offline_download")}
            aria-label={t("chart.offline_download")}
            className={
              RAIL_BTN +
              " " +
              (tileDownloadActive ? RAIL_BTN_ACTIVE : RAIL_BTN_IDLE)
            }
          >
            {tileDownloadActive ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
          </button>
        ) : null}

        {isAdmin ? (
          <button
            type="button"
            onPointerDown={stopMapEvent}
            onClick={(e) => {
              stopMapEvent(e);
              onToggleDraw?.();
            }}
            title={drawing ? t("chart.draw_active") : t("chart.draw_point")}
            aria-label={drawing ? t("chart.draw_active") : t("chart.draw_point")}
            aria-pressed={drawing}
            className={
              RAIL_BTN +
              " " +
              (drawing
                ? "border-orange-400/55 bg-orange-400/20 text-orange-100"
                : RAIL_BTN_IDLE)
            }
          >
            <Crosshair className="size-3.5" />
          </button>
        ) : null}
      </div>
    </LeafletPointerGuard>
  );
}

/**
 * Quiet Glass (B) LAT / LON stamp + scale. Fullscreen cockpit: bottom-left.
 * Embedded maps keep a compact corner chip.
 */
export function ChartReadout({
  coords,
  lat,
  lng,
  scaleNm,
  viewportPinned = false,
  concealed = false,
}: {
  /** Legacy single-line DM string — used when lat/lng are not provided. */
  coords?: string;
  lat?: number;
  lng?: number;
  scaleNm: number | null;
  viewportPinned?: boolean;
  /** Hide under the Kontrol Haritası drawer so the badge never stacks on top. */
  concealed?: boolean;
}) {
  const { t } = useTranslation();
  const hasParts = Number.isFinite(lat) && Number.isFinite(lng);
  const formatted = hasParts
    ? formatDegrees(lat as number, lng as number)
    : (coords ?? "");
  const [latPart, lonPart] = formatted.split(",").map((s) => s.trim());

  return (
    <div
      className={
        "thalvo-chart-sheet z-[50] rounded-xl border px-3 py-2 shadow-lg backdrop-blur-md transition-opacity duration-200 " +
        (concealed ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100") +
        " " +
        (viewportPinned
          ? "absolute left-4 bottom-28 max-w-[min(18rem,calc(100vw-6.5rem))] text-left"
          : "absolute bottom-3 right-3 max-w-[min(14rem,calc(100vw-5.5rem))] text-left")
      }
    >
      {latPart && lonPart ? (
        <div className="flex items-start gap-3.5">
          <div className="min-w-0">
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--sheet-faint)" }}
            >
              {t("chart.coord_lat")}
            </p>
            <p
              className="mt-0.5 font-mono text-[11px] font-semibold tabular-nums leading-tight"
              style={{ color: "var(--sheet-ink)" }}
            >
              {latPart}
            </p>
          </div>
          <div className="min-w-0">
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--sheet-faint)" }}
            >
              {t("chart.coord_lon")}
            </p>
            <p
              className="mt-0.5 font-mono text-[11px] font-semibold tabular-nums leading-tight"
              style={{ color: "var(--sheet-ink)" }}
            >
              {lonPart}
            </p>
          </div>
        </div>
      ) : (
        <p
          className="font-mono text-[11px] tabular-nums leading-tight"
          style={{ color: "var(--sheet-ink)" }}
        >
          {formatted}
        </p>
      )}
      {scaleNm != null ? (
        <p
          className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em]"
          style={{ color: "var(--sheet-faint)" }}
        >
          {t("common.distance")} ·{" "}
          {t("chart.scale_nm", { value: scaleNm.toFixed(scaleNm < 1 ? 2 : 1) })}
        </p>
      ) : null}
    </div>
  );
}

const FAB_BTN =
  "thalvo-chart-sheet grid size-11 place-items-center rounded-full border shadow-2xl backdrop-blur-md transition-colors hover:opacity-90 disabled:opacity-60 text-[color:var(--sheet-active-ink)]";

/**
 * Bottom-right FAB stack — compass, layers, locate.
 * On phones, layers opens a full-width bottom sheet (not a side popover)
 * so every control stays on-screen and scrollable above the dock.
 */
export function ChartFabStack({
  onCycleBasemap,
  layersOpen = false,
  onLayersOpenChange,
  onLocateMe,
  locating = false,
  concealed = false,
  basemap = "sat",
  onSelectBasemap,
  layers,
  onToggleLayer,
  onJump,
  filters,
  onToggleFilter,
  isAdmin = false,
  drawing = false,
  onToggleDraw,
  canContribute = false,
  onAddReport,
  onDownloadOfflineTiles,
  tileDownloadPercent,
  tileDownloadActive,
}: {
  onCycleBasemap?: () => void;
  layersOpen?: boolean;
  onLayersOpenChange?: (open: boolean) => void;
  onLocateMe: () => void;
  locating?: boolean;
  concealed?: boolean;
  basemap?: BasemapId;
  onSelectBasemap?: (id: BasemapId) => void;
  layers: ChartLayers;
  onToggleLayer: (key: ChartLayerKey) => void;
  onJump: (region: ChartRegion) => void;
  filters?: Record<PoiFilterKey, boolean>;
  onToggleFilter?: (key: PoiFilterKey) => void;
  isAdmin?: boolean;
  drawing?: boolean;
  onToggleDraw?: () => void;
  canContribute?: boolean;
  onAddReport?: () => void;
  onDownloadOfflineTiles?: () => void;
  tileDownloadPercent?: number | null;
  tileDownloadActive?: boolean;
}) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const layersBtnRef = useRef<HTMLButtonElement>(null);
  const layersLabel = t("chart.layers_button");

  useEffect(() => {
    if (!layersOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target) || layersBtnRef.current?.contains(target)) return;
      onLayersOpenChange?.(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [layersOpen, onLayersOpenChange]);

  return (
    <>
      {/* Mobile-first: full-width bottom sheet so every control is reachable. */}
      {layersOpen ? (
        <LeafletPointerGuard className="pointer-events-auto absolute inset-0 z-[560] lg:hidden">
          <button
            type="button"
            className="thalvo-chart-sheet-scrim absolute inset-0"
            aria-label={t("common.close")}
            onPointerDown={stopMapEvent}
            onClick={(e) => {
              stopMapEvent(e);
              onLayersOpenChange?.(false);
            }}
          />
          <aside
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("chart.hud_title")}
            className="thalvo-chart-sheet absolute inset-x-0 bottom-0 flex max-h-[min(82dvh,40rem)] w-full flex-col rounded-t-3xl border border-b-0 shadow-2xl"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom) + 4.75rem)",
            }}
          >
            <div className="flex flex-col items-center pt-2">
              <span
                className="mb-1 h-1 w-10 rounded-full"
                style={{ background: "var(--sheet-handle)" }}
              />
            </div>
            <div
              className="flex items-center justify-between gap-3 border-b px-4 py-3"
              style={{ borderColor: "var(--sheet-border)" }}
            >
              <p
                className="min-w-0 truncate text-[14px] font-bold"
                style={{ color: "var(--sheet-ink)" }}
              >
                {t("chart.hud_title")}
              </p>
              <button
                type="button"
                onPointerDown={stopMapEvent}
                onClick={(e) => {
                  stopMapEvent(e);
                  onLayersOpenChange?.(false);
                }}
                className="grid size-10 shrink-0 place-items-center rounded-xl border"
                style={{
                  borderColor: "var(--sheet-border)",
                  color: "var(--sheet-muted)",
                }}
                aria-label={t("common.close")}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 text-xs">
              <ChartHudBody
                layers={layers}
                onToggleLayer={onToggleLayer}
                onJump={onJump}
                filters={filters}
                onToggleFilter={onToggleFilter}
                isAdmin={isAdmin}
                drawing={drawing}
                onToggleDraw={onToggleDraw}
                canContribute={canContribute}
                onAddReport={onAddReport}
                basemap={basemap}
                onSelectBasemap={onSelectBasemap}
                onDownloadOfflineTiles={onDownloadOfflineTiles}
                tileDownloadPercent={tileDownloadPercent}
                tileDownloadActive={tileDownloadActive}
              />
            </div>
          </aside>
        </LeafletPointerGuard>
      ) : null}

      <div
        className={
          "pointer-events-none absolute right-3 bottom-28 z-[500] flex flex-col items-end gap-3 transition-opacity duration-200 " +
          (concealed || layersOpen ? "opacity-0" : "opacity-100")
        }
      >
        <LeafletPointerGuard className="pointer-events-auto flex w-11 flex-col items-center gap-3">
          <button
            type="button"
            onPointerDown={stopMapEvent}
            onClick={(e) => {
              stopMapEvent(e);
              openThalvoAi();
            }}
            title="THALVO AI"
            aria-label="THALVO AI"
            className={FAB_BTN}
          >
            <CompassMark size={18} />
          </button>
          <button
            ref={layersBtnRef}
            className={FAB_BTN + " lg:hidden"}
            type="button"
            onPointerDown={stopMapEvent}
            onContextMenu={(e) => {
              e.preventDefault();
              stopMapEvent(e);
              onCycleBasemap?.();
            }}
            onClick={(e) => {
              stopMapEvent(e);
              onLayersOpenChange?.(!layersOpen);
            }}
            title={layersLabel}
            aria-label={layersLabel}
            aria-pressed={layersOpen}
          >
            <Layers className="size-[18px]" />
          </button>
          <button
            type="button"
            onPointerDown={stopMapEvent}
            onClick={(e) => {
              stopMapEvent(e);
              onLocateMe();
            }}
            disabled={locating}
            title={t("chart.locate_me")}
            aria-label={t("chart.locate_me")}
            className={FAB_BTN}
          >
            {locating ? (
              <Loader2 className="size-[18px] animate-spin" />
            ) : (
              <Crosshair className="size-[18px]" />
            )}
          </button>
        </LeafletPointerGuard>
      </div>
    </>
  );
}

export type PoiFilterKey = "marinas" | "fuel" | "service";

/** Quick map-surface chips — marinas, fuel, service boats. */
export function ChartFilterChips({
  filters,
  onToggle,
}: {
  filters: Record<PoiFilterKey, boolean>;
  onToggle: (key: PoiFilterKey) => void;
}) {
  const { t } = useTranslation();
  const chips: Array<{ key: PoiFilterKey; labelKey: string; Icon: typeof Anchor }> = [
    { key: "marinas", labelKey: "chart.filter_marinas", Icon: Anchor },
    { key: "fuel", labelKey: "chart.filter_fuel", Icon: Fuel },
    { key: "service", labelKey: "chart.filter_service", Icon: Wrench },
  ];
  return (
    <LeafletPointerGuard className="pointer-events-auto flex max-w-full flex-nowrap gap-1.5 overflow-x-auto no-scrollbar">
      {chips.map(({ key, labelKey, Icon }) => {
        const on = filters[key];
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onPointerDown={stopMapEvent}
            onClick={(e) => {
              stopMapEvent(e);
              onToggle(key);
            }}
            className={
              "thalvo-chart-sheet inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold backdrop-blur-md transition-colors " +
              (on ? "" : "opacity-60")
            }
            style={
              on
                ? {
                    borderColor: "var(--sheet-active-border)",
                    background: "var(--sheet-active-bg)",
                    color: "var(--sheet-active-ink)",
                  }
                : undefined
            }
          >
            <Icon className="size-3 shrink-0" />
            {t(labelKey)}
          </button>
        );
      })}
    </LeafletPointerGuard>
  );
}

/** Small legend chip row used under the HUD when drawing is armed. */
export function ChartDrawHint({
  kind,
  inline = false,
}: {
  kind: "admin" | "report";
  inline?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={
        (inline
          ? "pointer-events-auto w-fit max-w-full "
          : "pointer-events-auto absolute left-1/2 top-[calc(env(safe-area-inset-top)+4.25rem)] z-20 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 ") +
        "rounded-full border border-orange-400/50 bg-orange-500/20 px-3.5 py-1.5 text-center text-[10px] font-semibold text-orange-100 shadow-[0_0_20px_rgba(251,146,60,0.25)] backdrop-blur-xl"
      }
    >
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {kind === "admin" ? (
          <MapPin className="size-3 shrink-0" />
        ) : (
          <Ship className="size-3 shrink-0" />
        )}
        {kind === "admin" ? t("chart.draw_hint") : t("chart.report_pick_hint")}
      </span>
    </div>
  );
}
