import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Compass,
  Crosshair,
  Layers,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  Plus,
  Ship,
  X,
} from "lucide-react";
import { CompassMark } from "@/components/brand/CompassMark";
import { openThalvoAi } from "@/lib/thalvo-ai-bus";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

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
   * Mobile "Layers" drawer state — controlled by the map owner so the
   * *trigger* (a button in the bottom-right `ChartFabStack`) and the
   * *content* (rendered here) can live in two different screen corners
   * without duplicating state. The map owner also uses the open flag to
   * fade the top-left Metocean widget out of the way while the drawer is
   * up, since both would otherwise fight for the same narrow strip on a
   * phone in portrait.
   */
  mobileDrawerOpen?: boolean;
  onMobileDrawerOpenChange?: (open: boolean) => void;
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
>) {
  const { t } = useTranslation();
  return (
    <>
      {/* Region quick-jump pills — horizontally scrollable so adding a 4th/5th
          region never squeezes existing labels into unreadable slivers. */}
      <div className="-mx-0.5 flex flex-nowrap gap-1.5 overflow-x-auto px-0.5 no-scrollbar">
        <button
          type="button"
          onClick={() => onJump("gocek")}
          className="h-8 shrink-0 whitespace-nowrap rounded-full border border-cyan-300/25 bg-cyan-400/[0.08] px-3.5 text-[11px] font-semibold text-cyan-100/90 transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/20"
        >
          {t("chart.jump_gocek")}
        </button>
        <button
          type="button"
          onClick={() => onJump("marmaris")}
          className="h-8 shrink-0 whitespace-nowrap rounded-full border border-cyan-300/25 bg-cyan-400/[0.08] px-3.5 text-[11px] font-semibold text-cyan-100/90 transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/20"
        >
          {t("chart.jump_marmaris")}
        </button>
        <button
          type="button"
          onClick={() => onJump("bozburun")}
          className="h-8 shrink-0 whitespace-nowrap rounded-full border border-cyan-300/25 bg-cyan-400/[0.08] px-3.5 text-[11px] font-semibold text-cyan-100/90 transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/20"
        >
          {t("chart.jump_bozburun")}
        </button>
      </div>

      {/* Layer toggles */}
      <ul className="mt-2.5 space-y-0.5 border-t border-white/[0.07] pt-2.5">
        {LAYER_ROWS.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              onClick={() => onToggleLayer(row.key)}
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
              onClick={onAddReport}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-cyan-300/40 bg-cyan-400/15 text-[11px] font-bold uppercase tracking-[0.1em] text-cyan-100 transition-all hover:bg-cyan-400/30 hover:shadow-[0_0_16px_rgba(0,240,255,0.25)]"
            >
              <Plus className="size-3.5 shrink-0" />
              <span className="truncate">{t("chart.add_report")}</span>
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={onToggleDraw}
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
 * ChartHud — chartplotter control panel anchored top-right of the map.
 * Pure presentation: every interaction is delegated to the map owner.
 *
 * `sm:` and up (tablets/desktop, where the top-left Metocean widget and
 * this panel have room to coexist): the classic always-visible floating
 * card, header always shown, body collapsible.
 *
 * Below `sm:` (phones in portrait — the two floating panels otherwise
 * collide edge-to-edge on a ~375–430px viewport): the panel itself is
 * hidden entirely. Its controls resurface in a bottom drawer opened from
 * the "Layers" button in the bottom-right `ChartFabStack` instead (see
 * `mobileDrawerOpen`) — one trigger, docked with the other map controls,
 * rather than a second floating card competing for the same corner.
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
  mobileDrawerOpen = false,
  onMobileDrawerOpenChange,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [needleSpin, setNeedleSpin] = useState(0);

  return (
    <>
      {/* Desktop / tablet floating panel */}
      <div className="pointer-events-auto absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 z-20 hidden w-[252px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-cyan-500/30 bg-[#0a192f]/90 text-xs shadow-2xl backdrop-blur-md sm:block">
        {/* Accent hairline along the top edge */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />

        <div className="p-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
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
                onClick={() => {
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
                onClick={() => setOpen((v) => !v)}
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
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom drawer — opened via the "Layers" button living in the
          bottom-right ChartFabStack (see LiveMap), not a second trigger
          here. */}
      <Drawer open={mobileDrawerOpen} onOpenChange={onMobileDrawerOpenChange}>
        <DrawerContent
          overlayClassName="z-50"
          className="z-50 thalvo-dark border-t border-cyan-500/30 bg-[#0a192f]/97 text-white backdrop-blur-xl"
        >
          <DrawerHeader className="flex flex-row items-center justify-between gap-3 pb-1 text-left">
            <DrawerTitle className="text-[10px] font-bold uppercase leading-none tracking-[0.22em] text-cyan-200/90">
              {t("chart.hud_title")}
            </DrawerTitle>
            <DrawerClose asChild>
              <button
                type="button"
                aria-label={t("common.close")}
                title={t("common.close")}
                className="grid size-9 shrink-0 place-items-center rounded-full border border-cyan-500/35 bg-white/5 text-cyan-100 transition-colors hover:bg-cyan-400/15 hover:text-white"
              >
                <X className="size-4" strokeWidth={2.5} />
              </button>
            </DrawerClose>
          </DrawerHeader>
          <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-1 text-xs">
            <ChartHudBody
              layers={layers}
              onToggleLayer={onToggleLayer}
              onJump={onJump}
              isAdmin={isAdmin}
              drawing={drawing}
              onToggleDraw={onToggleDraw}
              canContribute={canContribute}
              onAddReport={onAddReport}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
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
        "z-20 max-w-[min(11.5rem,calc(100vw-5.5rem))] rounded-md border border-white/10 bg-[#07111E]/70 px-2 py-1 shadow-lg backdrop-blur-sm transition-opacity duration-200 " +
        (concealed ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100") +
        " " +
        (viewportPinned
          ? "fixed left-3 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] text-left"
          : "absolute bottom-3 right-3 text-right")
      }
    >
      <p className="truncate font-mono text-[10px] leading-tight tracking-tight text-cyan-300/90">
        {coords}
      </p>
      <p
        className={
          "mt-0.5 flex items-center gap-1 font-mono text-[8px] text-cyan-300/50 " +
          (viewportPinned ? "justify-start" : "justify-end")
        }
      >
        <span className="truncate">
          {scaleNm == null
            ? "—"
            : t("chart.scale_nm", { value: scaleNm.toFixed(scaleNm < 1 ? 2 : 1) })}
        </span>
        <Navigation className="size-2.5 shrink-0 text-cyan-400/50" />
      </p>
    </div>
  );
}

/**
 * Bottom-right FAB stack — compass/north reset, mobile "Layers/Filters"
 * (opens the ChartHud bottom drawer — desktop hides this and uses the
 * always-visible panel instead), "go to my GPS position", and the AI
 * captain assistant. The coordinate readout lives bottom-left at the
 * same elevation so this stack owns the bottom-right exclusively.
 */
export function ChartFabStack({
  onResetNorth,
  onOpenLayers,
  onLocateMe,
  locating = false,
  showAi = false,
  viewportPinned = false,
  concealed = false,
}: {
  onResetNorth: () => void;
  onOpenLayers?: () => void;
  onLocateMe: () => void;
  locating?: boolean;
  /** Compass/AI launcher — map cockpit only. Hidden on Marketplace / Missions / My Vessel. */
  showAi?: boolean;
  /** Pin to the viewport (fullscreen cockpit) so `bottom` clears the dock. */
  viewportPinned?: boolean;
  /** Hide under the Kontrol Haritası drawer so FABs never stack on top. */
  concealed?: boolean;
}) {
  const { t } = useTranslation();
  const [needleSpin, setNeedleSpin] = useState(0);
  return (
    <div
      className={
        "right-4 z-20 flex flex-col items-center gap-2.5 transition-opacity duration-200 " +
        (concealed ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100") +
        " " +
        (viewportPinned ? "fixed" : "absolute") +
        " bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
      }
    >
      <button
        type="button"
        onClick={() => {
          onResetNorth();
          setNeedleSpin((n) => n + 360);
        }}
        title={t("chart.compass_hint")}
        aria-label={t("chart.compass_hint")}
        className="grid size-11 place-items-center rounded-full border border-cyan-500/30 bg-[#0a192f]/90 text-cyan-200 shadow-2xl backdrop-blur-md transition-colors hover:bg-cyan-400/15 hover:text-cyan-100"
      >
        <Compass
          className="size-[18px] transition-transform duration-700 ease-out"
          style={{ transform: `rotate(${needleSpin}deg)` }}
        />
      </button>
      {onOpenLayers && (
        <button
          type="button"
          onClick={onOpenLayers}
          title={t("chart.layers_button")}
          aria-label={t("chart.layers_button")}
          className="grid size-11 place-items-center rounded-full border border-cyan-500/30 bg-[#0a192f]/90 text-cyan-200 shadow-2xl backdrop-blur-md transition-colors hover:bg-cyan-400/15 hover:text-cyan-100 sm:hidden"
        >
          <Layers className="size-[18px]" />
        </button>
      )}
      <button
        type="button"
        onClick={onLocateMe}
        disabled={locating}
        title={t("chart.locate_me")}
        aria-label={t("chart.locate_me")}
        className="grid size-11 place-items-center rounded-full border border-cyan-500/30 bg-[#0a192f]/90 text-cyan-200 shadow-2xl backdrop-blur-md transition-colors hover:bg-cyan-400/15 hover:text-cyan-100 disabled:opacity-60"
      >
        {locating ? (
          <Loader2 className="size-[18px] animate-spin" />
        ) : (
          <LocateFixed className="size-[18px]" />
        )}
      </button>
      {showAi && (
        <button
          type="button"
          onClick={openThalvoAi}
          title={t("chart.ai_hint")}
          aria-label={t("chart.ai_hint")}
          className="grid size-11 place-items-center rounded-full border shadow-2xl backdrop-blur-md transition-transform active:scale-[0.96]"
          style={{
            background:
              "radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 45%), linear-gradient(160deg, #0F2440 0%, #0A192F 60%, #081428 100%)",
            borderColor: "rgba(255,176,32,0.55)",
          }}
        >
          <CompassMark size={20} />
        </button>
      )}
    </div>
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
          ? "max-w-full "
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
