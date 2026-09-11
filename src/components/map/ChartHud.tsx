import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Anchor,
  ChevronDown,
  Compass,
  Crosshair,
  Fuel,
  Globe2,
  Layers,
  Loader2,
  MapPin,
  Moon,
  Navigation,
  Navigation2,
  Plus,
  Satellite,
  Ship,
  Wrench,
} from "lucide-react";
import { LeafletPointerGuard, stopMapEvent } from "@/lib/leaflet-dom";

export interface ChartLayers {
  seamarks: boolean;
  hazards: boolean;
  moorings: boolean;
  /** Approved captain-advice pins ("Kullanıcı Tavsiye Noktaları"). */
  reports: boolean;
  fleet: boolean;
}

export type ChartLayerKey = keyof ChartLayers;

export type ChartRegion = "gocek" | "marmaris" | "bozburun";
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
  onResetNorth: () => void;
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
}

const LAYER_ROWS: Array<{ key: ChartLayerKey; labelKey: string; dot: string }> = [
  { key: "seamarks", labelKey: "chart.layer_seamarks", dot: "bg-cyan-300" },
  { key: "hazards", labelKey: "chart.layer_hazards", dot: "bg-red-400" },
  { key: "moorings", labelKey: "chart.layer_moorings", dot: "bg-emerald-300" },
  { key: "reports", labelKey: "chart.layer_reports", dot: "bg-amber-300" },
  { key: "fleet", labelKey: "chart.layer_fleet", dot: "bg-sky-300" },
];

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={
        "relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full border transition-all duration-200 " +
        (on
          ? "border-cyan-300/60 bg-cyan-400/25 shadow-[inset_0_0_8px_rgba(0,240,255,0.25)]"
          : "border-white/15 bg-white/[0.07]")
      }
    >
      <span
        className={
          "absolute size-3 rounded-full transition-all duration-200 " +
          (on
            ? "left-[17px] bg-cyan-200 shadow-[0_0_6px_rgba(0,240,255,0.7)]"
            : "left-[3px] bg-white/50")
        }
      />
    </span>
  );
}

/**
 * Shared body — region quick-jump pills, layer toggles and the
 * contribute/draw actions. Rendered inside the desktop floating panel
 * *and* inside the mobile bottom drawer so the two surfaces never drift
 * out of sync.
 */
function ChartHudBody({
  layers,
  onToggleLayer,
  onJump,
  isAdmin,
  drawing,
  onToggleDraw,
  canContribute,
  onAddReport,
  basemap = "sat",
  onSelectBasemap,
}: Pick<
  Props,
  | "layers"
  | "onToggleLayer"
  | "onJump"
  | "isAdmin"
  | "drawing"
  | "onToggleDraw"
  | "canContribute"
  | "onAddReport"
  | "basemap"
  | "onSelectBasemap"
>) {
  const { t } = useTranslation();
  return (
    <>
      {/* Region quick-jump pills — horizontally scrollable so adding a 4th/5th
          region never squeezes existing labels into unreadable slivers. */}
      <div className="-mx-0.5 flex flex-nowrap gap-1.5 overflow-x-auto px-0.5 no-scrollbar">
        <button
          type="button"
          onClick={(e) => {
            stopMapEvent(e);
            onJump("gocek");
          }}
          className="h-8 shrink-0 whitespace-nowrap rounded-full border border-cyan-300/25 bg-cyan-400/[0.08] px-3.5 text-[11px] font-semibold text-cyan-100/90 transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/20"
        >
          {t("chart.jump_gocek")}
        </button>
        <button
          type="button"
          onClick={(e) => {
            stopMapEvent(e);
            onJump("marmaris");
          }}
          className="h-8 shrink-0 whitespace-nowrap rounded-full border border-cyan-300/25 bg-cyan-400/[0.08] px-3.5 text-[11px] font-semibold text-cyan-100/90 transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/20"
        >
          {t("chart.jump_marmaris")}
        </button>
        <button
          type="button"
          onClick={(e) => {
            stopMapEvent(e);
            onJump("bozburun");
          }}
          className="h-8 shrink-0 whitespace-nowrap rounded-full border border-cyan-300/25 bg-cyan-400/[0.08] px-3.5 text-[11px] font-semibold text-cyan-100/90 transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/20"
        >
          {t("chart.jump_bozburun")}
        </button>
      </div>

      {onSelectBasemap && (
        <div className="mt-2.5 space-y-1 rounded-lg border border-white/[0.07] p-1">
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
                  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left transition-colors " +
                  (on ? "bg-cyan-400/15 text-white" : "text-white/70 hover:bg-white/[0.05]")
                }
              >
                <Icon className="size-3.5 shrink-0 text-cyan-200" />
                <span className="truncate text-[11px] font-medium">{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Layer toggles */}
      <ul className="mt-2.5 space-y-0.5 border-t border-white/[0.07] pt-2.5">
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
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={
                    "size-1.5 shrink-0 rounded-full transition-opacity " +
                    row.dot +
                    (layers[row.key] ? " opacity-100" : " opacity-25")
                  }
                />
                <span
                  className={
                    "truncate text-[11px] font-medium leading-tight transition-colors " +
                    (layers[row.key] ? "text-white/90" : "text-white/40")
                  }
                >
                  {t(row.labelKey)}
                </span>
              </span>
              <Switch on={layers[row.key]} />
            </button>
          </li>
        ))}
      </ul>

      {(canContribute || isAdmin) && (
        <div className="mt-2.5 space-y-1.5 border-t border-white/[0.07] pt-2.5">
          {canContribute && (
            <button
              type="button"
              onPointerDown={stopMapEvent}
              onClick={(e) => {
                stopMapEvent(e);
                onAddReport?.();
              }}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-cyan-300/40 bg-cyan-400/15 text-[11px] font-bold uppercase tracking-[0.1em] text-cyan-100 transition-all hover:bg-cyan-400/30 hover:shadow-[0_0_16px_rgba(0,240,255,0.25)]"
            >
              <Plus className="size-3.5 shrink-0" />
              <span className="truncate">{t("chart.add_report")}</span>
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
                "flex h-10 w-full items-center justify-center gap-1.5 rounded-full border text-[11px] font-bold uppercase tracking-[0.1em] transition-all " +
                (drawing
                  ? "border-orange-400/60 bg-orange-400/25 text-orange-100 shadow-[0_0_16px_rgba(251,146,60,0.3)]"
                  : "border-white/15 bg-white/[0.05] text-white/70 hover:bg-white/[0.12] hover:text-white/90")
              }
            >
              <Crosshair className="size-3.5 shrink-0" />
              <span className="truncate">
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
 * ChartHud — desktop/tablet control panel anchored top-right of the map.
 * Phones use the Layers FAB popover in `ChartFabStack` instead, so this
 * card stays `lg:block` and never covers the chart on a narrow viewport.
 */
export function ChartHud({
  layers,
  onToggleLayer,
  onJump,
  onResetNorth,
  isAdmin = false,
  drawing = false,
  onToggleDraw,
  canContribute = false,
  onAddReport,
  panelOpen,
  onPanelOpenChange,
  basemap = "sat",
  onSelectBasemap,
}: Props) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(true);
  const open = panelOpen ?? uncontrolledOpen;
  const setOpen = (update: boolean | ((current: boolean) => boolean)) => {
    const next = typeof update === "function" ? update(open) : update;
    onPanelOpenChange?.(next);
    if (panelOpen === undefined) setUncontrolledOpen(next);
  };
  const [needleSpin, setNeedleSpin] = useState(0);

  return (
    <LeafletPointerGuard className="pointer-events-auto absolute top-[calc(env(safe-area-inset-top)+6.5rem)] right-3 z-[500] hidden w-[min(252px,calc(100vw-5.5rem))] overflow-hidden rounded-xl border border-cyan-500/30 bg-[#0a192f]/90 text-xs shadow-2xl backdrop-blur-md lg:block">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />

      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onPointerDown={stopMapEvent}
            onClick={(e) => {
              stopMapEvent(e);
              setOpen((v) => !v);
            }}
            className="flex min-w-0 items-center gap-2 text-left"
            aria-expanded={open}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
            <p className="truncate text-[9px] font-bold uppercase leading-none tracking-[0.22em] text-cyan-200/90">
              {t("chart.hud_title")}
            </p>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onPointerDown={stopMapEvent}
              onClick={(e) => {
                stopMapEvent(e);
                onResetNorth();
                setNeedleSpin((n) => n + 360);
              }}
              title={t("chart.compass_hint")}
              aria-label={t("chart.compass_hint")}
              className="grid size-7 place-items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-cyan-200 transition-colors hover:bg-cyan-400/25 hover:text-cyan-100"
            >
              <Compass
                className="size-3.5 transition-transform duration-700 ease-out"
                style={{ transform: `rotate(${needleSpin}deg)` }}
              />
            </button>
            <button
              type="button"
              onPointerDown={stopMapEvent}
              onClick={(e) => {
                stopMapEvent(e);
                setOpen((v) => !v);
              }}
              aria-label={open ? t("chart.collapse") : t("chart.expand")}
              title={open ? t("chart.collapse") : t("chart.expand")}
              className="grid size-7 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white/90"
            >
              <ChevronDown
                className={
                  "size-3.5 transition-transform duration-200 " + (open ? "" : "-rotate-90")
                }
              />
            </button>
          </div>
        </div>

        <div
          className={
            "grid transition-all duration-300 ease-out " +
            (open ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")
          }
        >
          <div className="min-h-0 overflow-hidden">
            <ChartHudBody
              layers={layers}
              onToggleLayer={onToggleLayer}
              onJump={onJump}
              isAdmin={isAdmin}
              drawing={drawing}
              onToggleDraw={onToggleDraw}
              canContribute={canContribute}
              onAddReport={onAddReport}
              basemap={basemap}
              onSelectBasemap={onSelectBasemap}
            />
          </div>
        </div>
      </div>
    </LeafletPointerGuard>
  );
}

/**
 * Nautical coordinate + scale readout. On the fullscreen cockpit it sits
 * bottom-left, level with the FAB stack (`5.5rem` above the home-indicator
 * / dock) — never inside the bottom nav. Embedded maps keep the compact
 * in-widget corner chip.
 */
export function ChartReadout({
  coords,
  scaleNm,
  viewportPinned = false,
  concealed = false,
}: {
  coords: string;
  scaleNm: number | null;
  viewportPinned?: boolean;
  /** Hide under the Kontrol Haritası drawer so the badge never stacks on top. */
  concealed?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={
        "z-[50] rounded-md border border-white/10 bg-[#07111E]/80 px-2.5 py-1.5 shadow-lg backdrop-blur-sm transition-opacity duration-200 " +
        (concealed ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100") +
        " " +
        (viewportPinned
          ? "absolute left-4 bottom-28 max-w-[min(16.5rem,calc(100vw-6.5rem))] text-left"
          : "absolute bottom-3 right-3 max-w-[min(11.5rem,calc(100vw-5.5rem))] text-right")
      }
    >
      <p className="font-mono text-[11px] leading-tight tracking-tight text-cyan-200">
        {coords}
      </p>
      <p
        className={
          "mt-0.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-300/55 " +
          (viewportPinned ? "justify-start" : "justify-end")
        }
      >
        <Navigation className="size-2.5 shrink-0 text-cyan-400/50" />
        <span className="truncate">
          {t("common.distance")}
          {scaleNm == null ? "" : ` · ${t("chart.scale_nm", { value: scaleNm.toFixed(scaleNm < 1 ? 2 : 1) })}`}
        </span>
      </p>
    </div>
  );
}

const FAB_BTN =
  "grid size-11 place-items-center rounded-full border border-cyan-500/30 bg-[#0a192f]/90 text-cyan-200 shadow-2xl backdrop-blur-md transition-colors hover:bg-cyan-400/15 hover:text-cyan-100 disabled:opacity-60";

/**
 * Bottom-right FAB stack — compass, layers menu, locate, heading rose.
 * The layers popover is anchored here so opening it cannot race a full-screen
 * drawer overlay (which was closing on the same pointerup).
 */
export function ChartFabStack({
  onResetNorth,
  onCycleBasemap,
  layersOpen = false,
  onLayersOpenChange,
  onLocateMe,
  locating = false,
  concealed = false,
  headingDeg = 0,
  basemap = "sat",
  onSelectBasemap,
  layers,
  onToggleLayer,
  onJump,
  isAdmin = false,
  drawing = false,
  onToggleDraw,
  canContribute = false,
  onAddReport,
}: {
  onResetNorth: () => void;
  onCycleBasemap?: () => void;
  layersOpen?: boolean;
  onLayersOpenChange?: (open: boolean) => void;
  onLocateMe: () => void;
  locating?: boolean;
  concealed?: boolean;
  headingDeg?: number;
  basemap?: BasemapId;
  onSelectBasemap?: (id: BasemapId) => void;
  layers: ChartLayers;
  onToggleLayer: (key: ChartLayerKey) => void;
  onJump: (region: ChartRegion) => void;
  isAdmin?: boolean;
  drawing?: boolean;
  onToggleDraw?: () => void;
  canContribute?: boolean;
  onAddReport?: () => void;
}) {
  const { t } = useTranslation();
  const [needleSpin, setNeedleSpin] = useState(0);
  const heading = ((headingDeg % 360) + 360) % 360;
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
    <div
      className={
        "pointer-events-none absolute right-4 bottom-28 z-[500] flex flex-col items-end gap-3 transition-opacity duration-200 " +
        (concealed ? "opacity-0" : "opacity-100")
      }
    >
      {layersOpen && (
        <LeafletPointerGuard className="pointer-events-auto">
          <div
            ref={menuRef}
            className="w-[min(252px,calc(100vw-5.5rem))] overflow-hidden rounded-xl border border-cyan-500/30 bg-[#0a192f]/95 text-xs shadow-2xl backdrop-blur-md"
          >
            <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
            <div className="p-3">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-200/90">
                {t("chart.hud_title")}
              </p>
              <ChartHudBody
                layers={layers}
                onToggleLayer={onToggleLayer}
                onJump={onJump}
                isAdmin={isAdmin}
                drawing={drawing}
                onToggleDraw={onToggleDraw}
                canContribute={canContribute}
                onAddReport={onAddReport}
                basemap={basemap}
                onSelectBasemap={onSelectBasemap}
              />
            </div>
          </div>
        </LeafletPointerGuard>
      )}
      <LeafletPointerGuard className="pointer-events-auto flex w-11 flex-col items-center gap-3">
        <button
          type="button"
          onPointerDown={stopMapEvent}
          onClick={(e) => {
            stopMapEvent(e);
            onResetNorth();
            setNeedleSpin((n) => n + 360);
          }}
          title={t("chart.compass_hint")}
          aria-label={t("chart.compass_hint")}
          className={FAB_BTN}
        >
          <Compass
            className="size-[18px] transition-transform duration-700 ease-out"
            style={{ transform: `rotate(${needleSpin}deg)` }}
          />
        </button>
        <button
          ref={layersBtnRef}
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
          className={FAB_BTN}
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
        <button
          type="button"
          onPointerDown={stopMapEvent}
          onClick={(e) => {
            stopMapEvent(e);
            onResetNorth();
          }}
          title={t("chart.heading_hint")}
          aria-label={t("chart.heading_hint")}
          className={FAB_BTN}
        >
          <Navigation2
            className="size-[18px]"
            style={{ transform: `rotate(${heading}deg)` }}
          />
        </button>
      </LeafletPointerGuard>
    </div>
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
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold backdrop-blur-md transition-colors " +
              (on
                ? "border-cyan-400/45 bg-cyan-400/20 text-cyan-50"
                : "border-white/15 bg-[#0a192f]/75 text-white/45")
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
