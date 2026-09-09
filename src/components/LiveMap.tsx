import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polygon,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-rotate";
import { renderToStaticMarkup } from "react-dom/server";
import { useTranslation } from "react-i18next";
import {
  Wrench,
  Anchor,
  Fuel,
  Loader2,
  MapPinOff,
  RefreshCw,
  Lightbulb,
  Utensils,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  GEO_OPTIONS,
  getFix,
  formatAccuracy,
  isLowAccuracy,
  isStale,
  isValidCoordinate,
  pickValidCoordinates,
  type GeoFailure,
  type GeoFix,
} from "@/lib/geolocation";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCommunityReports,
  fetchMarineZones,
  formatDegrees,
  toNauticalMiles,
  chartPointCoords,
  zoneBottomLabel,
  REPORT_CATEGORY_LABEL_KEYS,
  SEABED_LABEL_KEYS,
  ZONE_KIND_LABEL_KEYS,
  type ChartPoint,
  type CommunityReport,
  type MarineZone,
  type MarineZoneKind,
} from "@/lib/marine-data";
import {
  ChartHud,
  ChartReadout,
  ChartDrawHint,
  ChartFabStack,
  type ChartLayers,
  type ChartLayerKey,
  type ChartRegion,
} from "@/components/map/ChartHud";
import { ChartSearchBar } from "@/components/map/ChartSearchBar";
import { ChartDetailSheet } from "@/components/map/ChartDetailSheet";
import {
  consumeMapFocus,
  THALVO_MAP_FOCUS_EVENT,
  type MapFocusTarget,
} from "@/lib/map-focus-bus";
import { easeMapToNorth } from "@/lib/chart-north";
import { setMapChromeOverlay, useMapChromeHidden } from "@/lib/map-chrome";
import { publishCockpitContext } from "@/lib/ai-captain-context-bus";
import { THALVO_LAYER_FILTER_EVENT, type LayerFilterRequest } from "@/lib/map-layers-bus";
import { ReportModal } from "@/components/ReportModal";
import { AdminZoneDialog } from "@/components/map/AdminZoneDialog";
import { MetoceanHud } from "@/components/map/MetoceanHud";

export interface LivePin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "mechanic" | "diver";
}

/** Dispatch route line: a responding boat's position to the job it's assigned to. */
export interface LiveRoute {
  id: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}

interface Props {
  providers: LivePin[];
  /** Active dispatch route lines (see the ETA engine in the admin tower). */
  routes?: LiveRoute[];
  center?: { lat: number; lng: number };
  className?: string;
  height?: number | string;
  variant?: "light" | "dark";
  /** Set false on decorative/embedded maps that should stay a plain chart. */
  hud?: boolean;
  /** Full-viewport chartplotter mode: the wrapper becomes `fixed inset-0`, ignoring `height`. */
  fullscreen?: boolean;
  /** Extra content stacked under the search bar (e.g. an active-mission pill). */
  brand?: ReactNode;
  /** Top-row left of the map chrome (logo). */
  headerLeft?: ReactNode;
  /** Top-row right of the map chrome (language + account). */
  headerRight?: ReactNode;
  /** Opt-in Navily-style bottom sheet on marker/zone tap, instead of a Leaflet popup. */
  enableDetailSheet?: boolean;
  /** Fired when the captain taps "Emergency" inside the detail sheet. */
  onRequestEmergency?: () => void;
  /** Enable mouse-wheel zoom — safe once the map owns the whole viewport. */
  scrollZoom?: boolean;
}

/** Default viewport: Göcek bay. Used until a real GPS fix arrives. */
const GOCEK = { lat: 36.7525, lng: 28.9428 };
const DEFAULT_ZOOM = 13;

const REGIONS: Record<ChartRegion, { lat: number; lng: number; zoom: number }> = {
  gocek: { lat: 36.7525, lng: 28.9428, zoom: 13 },
  marmaris: { lat: 36.8525, lng: 28.278, zoom: 13 },
  bozburun: { lat: 36.689, lng: 28.043, zoom: 13 },
};

/**
 * Night cockpit basemap.
 *
 * Esri World Ocean Base only publishes tiles to zoom 13 — past that the
 * service returns a pale-blue "Map data not yet available" plate instead
 * of a real chart. Carto Dark Matter covers street-level zooms and stays
 * dark; OpenSeaMap seamarks ride on top as the navigation overlay.
 */
const BASE_TILE_DARK =
  "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png";
const BASE_TILE_LIGHT = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const CHART_VOID = "#07111E";

/** Shared with small standalone map previews (e.g. admin report focus map). */
export const MARINE_DARK_TILE_URL = BASE_TILE_DARK;
export const MARINE_DARK_TILE_MAX_NATIVE_ZOOM = 20;

function svgIcon(node: React.ReactElement, color: string, glow?: string) {
  const svg = renderToStaticMarkup(
    <div
      style={{
        background: color,
        width: 34,
        height: 34,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        color: "#fff",
        border: "2px solid rgba(255,255,255,0.85)",
        boxShadow: glow
          ? `0 0 10px ${glow}, 0 0 18px ${glow}`
          : "0 4px 10px rgba(0,0,0,.35)",
      }}
    >
      {node}
    </div>,
  );
  return L.divIcon({ html: svg, className: "", iconSize: [34, 34], iconAnchor: [17, 17] });
}

const mechIcon = svgIcon(<Wrench size={16} />, "#0A192F");
const diverIcon = svgIcon(<Anchor size={16} />, "#0891B2");

const ZONE_ICONS: Record<MarineZoneKind, L.DivIcon> = {
  marina: svgIcon(<Anchor size={16} />, "#0d3b2e", "rgba(57,255,20,0.75)"),
  fuel: svgIcon(<Fuel size={16} />, "#3d3200", "rgba(245,217,10,0.8)"),
  lighthouse: svgIcon(<Lightbulb size={16} />, "#3d3200", "rgba(245,217,10,0.95)"),
  restaurant: svgIcon(<Utensils size={16} />, "#0d3b2e", "rgba(57,255,20,0.7)"),
  hazard: svgIcon(<TriangleAlert size={16} />, "#4a0014", "rgba(255,45,85,0.9)"),
  anchorage: svgIcon(<Anchor size={16} />, "#0d3b2e", "rgba(57,255,20,0.8)"),
};

const meIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="position:relative;width:22px;height:22px">
      <span style="position:absolute;inset:0;border-radius:999px;background:#3b82f6;opacity:.35;animation:thalvoPing 1.6s ease-out infinite"></span>
      <span style="position:absolute;inset:6px;border-radius:999px;background:#2563eb;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></span>
    </div>
    <style>@keyframes thalvoPing{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.4);opacity:0}}</style>`,
});

const reportIcon = svgIcon(<Anchor size={14} />, "#003d4d", "rgba(0,240,255,0.75)");

function Recenter({
  center,
  suspend = false,
}: {
  center: { lat: number; lng: number };
  suspend?: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (suspend) return;
    map.setView([center.lat, center.lng], map.getZoom());
  }, [center.lat, center.lng, map, suspend]);
  return null;
}

/** Reports live map telemetry (centre + scale) and click positions upward. */
function MapBridge({
  onTelemetry,
  onClick,
}: {
  onTelemetry: (center: { lat: number; lng: number }, scaleNm: number | null) => void;
  onClick?: (pos: { lat: number; lng: number }) => void;
}) {
  const map = useMap();

  const report = useCallback(() => {
    const c = map.getCenter();
    const size = map.getSize();
    const west = map.containerPointToLatLng([0, size.y / 2]);
    const east = map.containerPointToLatLng([size.x, size.y / 2]);
    const nm = size.x > 0 ? toNauticalMiles(west.distanceTo(east)) : null;
    onTelemetry({ lat: c.lat, lng: c.lng }, nm);
  }, [map, onTelemetry]);

  useEffect(() => {
    report();
  }, [report]);

  useMapEvents({
    move: report,
    zoom: report,
    click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });

  return null;
}

export function LiveMap({
  providers,
  routes = [],
  center,
  className = "",
  height = 260,
  variant = "light",
  hud = true,
  fullscreen = false,
  brand,
  headerLeft,
  headerRight,
  enableDetailSheet = false,
  onRequestEmergency,
  scrollZoom = false,
}: Props) {
  const { t } = useTranslation();
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [failure, setFailure] = useState<GeoFailure | null>(null);
  const [requesting, setRequesting] = useState(false);
  // Mobile "Layers" drawer (see ChartHud) — fades the Metocean widget out of
  // the way while it's open instead of letting the two fight for space.
  const [layersDrawerOpen, setLayersDrawerOpen] = useState(false);
  // A dismissed geolocation failure band stays hidden until a *new* failure
  // comes in (tracked by reference below) — closing it once shouldn't mean
  // fighting it every retry, but a fresh error (e.g. a different reason)
  // should still surface.
  const [failureDismissed, setFailureDismissed] = useState(false);
  // The fullscreen cockpit portals its overlay chrome to `document.body`
  // (see the render below) so it can outrank the app shell's floating
  // bottom dock nav in the *root* stacking context — a descendant's
  // z-index can never escape its own positioned ancestor's stacking
  // context, and the map tile wrapper below intentionally stays at a low
  // z-index so the dock nav still paints over the map itself. Portals
  // only run client-side, so this flips true one paint after mount.
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    setMounted(true);
  }, []);
  const [map, setMap] = useState<L.Map | null>(null);
  const started = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedPoint, setSelectedPoint] = useState<ChartPoint | null>(null);
  const [navTarget, setNavTarget] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!map) return;
    const apply = (target: MapFocusTarget) => {
      if (!isValidCoordinate(target.lat, target.lng)) return;
      map.flyTo([target.lat, target.lng], target.zoom ?? 15, { duration: 1.15 });
      setNavTarget({ lat: target.lat, lng: target.lng });
    };
    const pending = consumeMapFocus();
    if (pending) apply(pending);
    const onFocus = (event: Event) => {
      const detail = (event as CustomEvent<MapFocusTarget>).detail;
      if (detail) apply(detail);
    };
    window.addEventListener(THALVO_MAP_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(THALVO_MAP_FOCUS_EVENT, onFocus);
  }, [map]);

  const [layers, setLayers] = useState<ChartLayers>({
    seamarks: true,
    hazards: true,
    moorings: true,
    reports: true,
    fleet: true,
  });
  const [telemetry, setTelemetry] = useState<{
    center: { lat: number; lng: number };
    scaleNm: number | null;
  }>({
    center: GOCEK,
    scaleNm: null,
  });

  const [zones, setZones] = useState<MarineZone[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [zoneDialog, setZoneDialog] = useState(false);
  const [zonePos, setZonePos] = useState<{ lat: number; lng: number } | null>(null);
  const [reportDialog, setReportDialog] = useState(false);
  const [reportPos, setReportPos] = useState<{ lat: number; lng: number } | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onMapRoute = path === "/app";
  const overlayLocked = useMapChromeHidden();
  const hideMapChrome = overlayLocked || !onMapRoute;

  useEffect(() => {
    const onFilter = (event: Event) => {
      const detail = (event as CustomEvent<LayerFilterRequest>).detail;
      if (!detail?.layer) return;
      setLayers((v) => ({ ...v, [detail.layer]: detail.enabled }));
    };
    window.addEventListener(THALVO_LAYER_FILTER_EVENT, onFilter);
    return () => window.removeEventListener(THALVO_LAYER_FILTER_EVENT, onFilter);
  }, []);

  useEffect(() => {
    const position = fix
      ? { lat: fix.lat, lng: fix.lng, source: "gps" as const }
      : { lat: telemetry.center.lat, lng: telemetry.center.lng, source: "chart" as const };
    if (selectedPoint?.kind === "zone") {
      publishCockpitContext({
        position,
        selectedBay: {
          name: selectedPoint.zone.name,
          kind: selectedPoint.zone.kind,
          depthM: selectedPoint.zone.depth_m,
          seabed: zoneBottomLabel(selectedPoint.zone),
          protection: selectedPoint.zone.metadata.protection ?? null,
          lat: selectedPoint.zone.lat,
          lng: selectedPoint.zone.lng,
        },
      });
      return;
    }
    if (selectedPoint?.kind === "report") {
      publishCockpitContext({
        position,
        selectedBay: {
          name: selectedPoint.report.title,
          kind: selectedPoint.report.category,
          depthM: selectedPoint.report.depth_m,
          seabed: selectedPoint.report.seabed,
          protection: null,
          lat: selectedPoint.report.lat,
          lng: selectedPoint.report.lng,
        },
      });
      return;
    }
    publishCockpitContext({ position, selectedBay: null });
  }, [fix, telemetry.center.lat, telemetry.center.lng, selectedPoint]);

  useEffect(() => {
    setMapChromeOverlay("layers", layersDrawerOpen);
  }, [layersDrawerOpen]);
  useEffect(() => {
    setMapChromeOverlay("bay", selectedPoint != null);
  }, [selectedPoint]);
  useEffect(() => {
    setMapChromeOverlay("note", reportDialog);
  }, [reportDialog]);
  useEffect(() => {
    setMapChromeOverlay("zone", zoneDialog);
  }, [zoneDialog]);
  useEffect(() => {
    return () => {
      setMapChromeOverlay("layers", false);
      setMapChromeOverlay("bay", false);
      setMapChromeOverlay("note", false);
      setMapChromeOverlay("zone", false);
    };
  }, []);

  const request = useCallback(async () => {
    setRequesting(true);
    const res = await getFix(GEO_OPTIONS);
    if (res.ok) {
      setFix(res.fix);
      setFailure(null);
    } else {
      setFailure(res.failure);
      setFailureDismissed(false);
    }
    setRequesting(false);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void request();
  }, [request]);

  const loadChartData = useCallback(async () => {
    // Each source is fetched independently: a schema drift or RLS hiccup on
    // one table (e.g. community_reports) must not blank out the other
    // (marine_zones) — the base chart stays usable with whatever pins the
    // still-healthy source can provide.
    const [zoneResult, reportResult] = await Promise.allSettled([
      fetchMarineZones(),
      fetchCommunityReports("approved"),
    ]);
    if (zoneResult.status === "fulfilled") {
      setZones(zoneResult.value);
    } else {
      console.error("[LiveMap] fetchMarineZones failed", zoneResult.reason);
      setZones([]);
    }
    if (reportResult.status === "fulfilled") {
      setReports(reportResult.value);
    } else {
      console.error("[LiveMap] fetchCommunityReports failed", reportResult.reason);
      setReports([]);
    }
  }, []);

  useEffect(() => {
    void loadChartData();
  }, [loadChartData]);

  // Realtime: an admin approving a report (or adding/editing a chart point)
  // must appear on every open chart instantly — no manual refresh, no
  // polling. Both tables are additionally gated by RLS, so an anonymous
  // viewer's re-read here can only ever surface already-public rows.
  useEffect(() => {
    const channel = supabase
      .channel("live-map-chart-data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_reports" },
        () => void loadChartData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marine_zones" },
        () => void loadChartData(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadChartData]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (cancelled) return;
      setSignedIn(!!auth.user);
      if (!auth.user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const validCenter = center && isValidCoordinate(center.lat, center.lng) ? center : null;
  // Fall back to the Göcek viewport so the chart is always useful, even
  // without a GPS fix. The accuracy chip stays honest about the fix state.
  const effectiveCenter = validCenter ?? fix ?? GOCEK;

  const pins = useMemo(() => pickValidCoordinates(providers), [providers]);

  const tileUrl = variant === "dark" ? BASE_TILE_DARK : BASE_TILE_LIGHT;
  const tileAttr = variant === "dark" ? "&copy; OpenStreetMap &copy; CARTO" : "";
  const tileMaxNativeZoom = variant === "dark" ? MARINE_DARK_TILE_MAX_NATIVE_ZOOM : undefined;

  const wrapperClass = fullscreen
    ? "fixed inset-0 z-10 h-[100dvh] w-screen overflow-hidden " + className
    : "relative z-10 w-full overflow-hidden " +
      (variant === "dark" ? "" : "rounded-2xl border border-border ") +
      className;

  const retryButton = (
    <button
      type="button"
      onClick={() => void request()}
      disabled={requesting}
      className={
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold transition-colors disabled:opacity-50 " +
        (variant === "dark"
          ? "bg-white/10 hover:bg-white/20 text-white border border-white/15"
          : "bg-foreground/5 hover:bg-foreground/10 text-foreground border border-border")
      }
    >
      <RefreshCw className={"size-3 " + (requesting ? "animate-spin" : "")} />
      {t("common.retry")}
    </button>
  );

  const stale = isStale(fix);
  const lowAccuracy = isLowAccuracy(fix);
  const warn = !!fix && (stale || lowAccuracy);

  const onJump = useCallback(
    (region: ChartRegion) => {
      const target = REGIONS[region];
      map?.flyTo([target.lat, target.lng], target.zoom, { duration: 1.2 });
    },
    [map],
  );

  const onResetNorth = useCallback(() => {
    if (!map) return;
    easeMapToNorth(map, 800);
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(12);
    }
  }, [map]);

  // "Go to my location" FAB: fly straight to an already-held fix, or take a
  // fresh one and fly to it as soon as it lands — either path leaves the
  // GEO_OPTIONS/failure handling identical to the initial auto-request.
  const onLocateMe = useCallback(async () => {
    if (fix) {
      map?.flyTo([fix.lat, fix.lng], Math.max(map.getZoom(), 15), { duration: 1 });
      return;
    }
    setRequesting(true);
    const res = await getFix(GEO_OPTIONS);
    if (res.ok) {
      setFix(res.fix);
      setFailure(null);
      map?.flyTo([res.fix.lat, res.fix.lng], 15, { duration: 1 });
    } else {
      setFailure(res.failure);
      setFailureDismissed(false);
    }
    setRequesting(false);
  }, [fix, map]);

  const onMapClick = useCallback(
    (pos: { lat: number; lng: number }) => {
      if (drawing) {
        setZonePos(pos);
        setZoneDialog(true);
        setDrawing(false);
        return;
      }
      if (picking) {
        setReportPos(pos);
        setReportDialog(true);
        setPicking(false);
        return;
      }
      // A tap on open water — not a marker — slides the detail sheet closed.
      if (enableDetailSheet) setSelectedPoint(null);
    },
    [drawing, picking, enableDetailSheet],
  );

  const onNavigate = useCallback(
    (point: ChartPoint) => {
      const coords = chartPointCoords(point);
      map?.flyTo([coords.lat, coords.lng], 15, { duration: 1 });
      if (fix) setNavTarget(coords);
      else void request();
    },
    [map, fix, request],
  );

  // Leaflet's container doesn't auto-detect layout changes (sheet
  // open/close, orientation flips, or the iOS Safari URL bar collapsing) —
  // without this the tiles freeze at the old size and leave grey gutters.
  useEffect(() => {
    if (!map) return;
    const invalidate = () => map.invalidateSize();
    const raf = requestAnimationFrame(invalidate);
    let ro: ResizeObserver | null = null;
    if (wrapperRef.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => invalidate());
      ro.observe(wrapperRef.current);
    }
    window.addEventListener("resize", invalidate);
    window.addEventListener("orientationchange", invalidate);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("orientationchange", invalidate);
    };
  }, [map]);

  const onMapTelemetry = useCallback(
    (nextCenter: { lat: number; lng: number }, scaleNm: number | null) => {
      setTelemetry((current) => {
        if (
          current.center.lat === nextCenter.lat &&
          current.center.lng === nextCenter.lng &&
          current.scaleNm === scaleNm
        )
          return current;
        return { center: nextCenter, scaleNm };
      });
    },
    [],
  );

  const moorings = zones.filter(
    (z) =>
      z.kind === "marina" || z.kind === "anchorage" || z.kind === "fuel" || z.kind === "restaurant",
  );
  const hazards = zones.filter((z) => z.kind === "hazard");
  const lights = zones.filter((z) => z.kind === "lighthouse");

  const zonePopup = (z: MarineZone) => (
    <div className="text-[12px] leading-snug">
      <p className="font-semibold">{z.name}</p>
      <p className="opacity-70">{t(ZONE_KIND_LABEL_KEYS[z.kind])}</p>
      {z.vhf_channel && (
        <p className="mt-1">{t("marine.vhf_channel", { channel: z.vhf_channel })}</p>
      )}
      {z.depth_m != null && <p>{t("marine.depth_m", { value: z.depth_m })}</p>}
      {zoneBottomLabel(z) && <p>{zoneBottomLabel(z)}</p>}
      {z.description && <p className="mt-1">{z.description}</p>}
    </div>
  );

  return (
    <div ref={wrapperRef} className={wrapperClass} style={fullscreen ? undefined : { height }}>
      <MapContainer
        ref={setMap}
        center={[effectiveCenter.lat, effectiveCenter.lng]}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={scrollZoom}
        zoomControl={false}
        attributionControl={false}
        fadeAnimation
        zoomAnimation
        markerZoomAnimation
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={80}
        className={variant === "dark" ? "thalvo-ecdis" : undefined}
        style={{
          width: "100%",
          height: "100%",
          background: variant === "dark" ? CHART_VOID : undefined,
        }}
        {...({
          rotate: true,
          bearing: 0,
          touchRotate: true,
          shiftKeyRotate: true,
          rotateControl: false,
        } as Record<string, unknown>)}
      >
        <TileLayer
          key={tileUrl}
          attribution={tileAttr}
          url={tileUrl}
          subdomains={variant === "dark" ? "abcd" : "abc"}
          maxZoom={20}
          maxNativeZoom={tileMaxNativeZoom}
          keepBuffer={6}
          updateWhenZooming
          updateWhenIdle={false}
          className={variant === "dark" ? "thalvo-dark-tiles" : undefined}
        />
        {layers.seamarks && (
          <TileLayer
            url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
            attribution=""
            opacity={1}
            zIndex={10}
            maxZoom={19}
            keepBuffer={4}
            className="thalvo-seamark-tiles"
          />
        )}
        <Recenter center={effectiveCenter} suspend={Boolean(navTarget)} />
        <MapBridge onTelemetry={onMapTelemetry} onClick={onMapClick} />

        {fix && <Marker position={[fix.lat, fix.lng]} icon={meIcon} opacity={stale ? 0.5 : 1} />}

        {/* Captain-plotted course: own GPS fix -> a chart point picked from the detail sheet */}
        {fix && navTarget && (
          <Polyline
            positions={[
              [fix.lat, fix.lng],
              [navTarget.lat, navTarget.lng],
            ]}
            pathOptions={{
              color: "#00F0FF",
              weight: 2.5,
              opacity: 0.85,
              dashArray: "1 10",
              lineCap: "round",
            }}
          />
        )}

        {/* Live dispatch route: responding boat -> job, neon dashed course line */}
        {layers.fleet &&
          routes.map((r) => (
            <Polyline
              key={`route-${r.id}`}
              positions={[
                [r.from.lat, r.from.lng],
                [r.to.lat, r.to.lng],
              ]}
              pathOptions={{
                color: "#00F0FF",
                weight: 2.5,
                opacity: 0.85,
                dashArray: "1 10",
                lineCap: "round",
              }}
            />
          ))}

        {/* Fleet: service boats and mission pins */}
        {layers.fleet &&
          pins.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={p.kind === "diver" ? diverIcon : mechIcon}
            >
              <Popup>
                <span className="text-[12px] font-semibold">{p.name}</span>
              </Popup>
            </Marker>
          ))}

        {/* Moorings, anchorages, marinas, restaurants, fuel */}
        {layers.moorings &&
          moorings.map((z) => (
            <Marker
              key={z.id}
              position={[z.lat, z.lng]}
              icon={ZONE_ICONS[z.kind]}
              eventHandlers={
                enableDetailSheet
                  ? { click: () => setSelectedPoint({ kind: "zone", zone: z }) }
                  : undefined
              }
            >
              {!enableDetailSheet && <Popup>{zonePopup(z)}</Popup>}
            </Marker>
          ))}
        {layers.moorings &&
          moorings
            .filter((z) => z.kind === "anchorage")
            .map((z) => (
              <Circle
                key={`c-${z.id}`}
                center={[z.lat, z.lng]}
                radius={450}
                pathOptions={{
                  color: "#39FF14",
                  fillColor: "#39FF14",
                  fillOpacity: 0.12,
                  weight: 1.5,
                }}
              />
            ))}

        {/* Lighthouses ride with the seamark layer */}
        {layers.seamarks &&
          lights.map((z) => (
            <Marker
              key={z.id}
              position={[z.lat, z.lng]}
              icon={ZONE_ICONS.lighthouse}
              eventHandlers={
                enableDetailSheet
                  ? { click: () => setSelectedPoint({ kind: "zone", zone: z }) }
                  : undefined
              }
            >
              {!enableDetailSheet && <Popup>{zonePopup(z)}</Popup>}
            </Marker>
          ))}

        {/* Shoal / reef hazard rings */}
        {layers.hazards &&
          hazards.map((z) => (
            <Circle
              key={z.id}
              center={[z.lat, z.lng]}
              radius={300}
                pathOptions={{
                  color: "#FF2D55",
                  fillColor: "#FF2D55",
                  fillOpacity: 0.22,
                  weight: 1.6,
                  dashArray: "4 4",
                }}
              eventHandlers={
                enableDetailSheet
                  ? { click: () => setSelectedPoint({ kind: "zone", zone: z }) }
                  : undefined
              }
            >
              {!enableDetailSheet && <Popup>{zonePopup(z)}</Popup>}
            </Circle>
          ))}

        {/* Dökükbaşı shoal — legacy surveyed polygon */}
        {layers.hazards && (
          <Polygon
            positions={[
              [36.7395, 28.9165],
              [36.7415, 28.9215],
              [36.7385, 28.926],
              [36.7345, 28.9235],
              [36.734, 28.9185],
            ]}
            pathOptions={{
              color: "#FF2D55",
              fillColor: "#FF2D55",
              fillOpacity: 0.26,
              weight: 1.6,
              dashArray: "4 4",
            }}
          >
            <Popup>
              <div className="text-[12px] leading-snug">
                <p className="font-semibold">Dökükbaşı Resifi</p>
                <p className="opacity-70">{t("marine.category_hazard")}</p>
                <p className="mt-1">{t("marine.dokukbasi_warning")}</p>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* Approved captain advice — "Kullanıcı Tavsiye Noktaları" layer */}
        {layers.reports &&
          reports.map((r) => (
            <Marker
              key={r.id}
              position={[r.lat, r.lng]}
              icon={reportIcon}
              eventHandlers={
                enableDetailSheet
                  ? { click: () => setSelectedPoint({ kind: "report", report: r }) }
                  : undefined
              }
            >
              {!enableDetailSheet && (
                <Popup>
                  <div className="text-[12px] leading-snug">
                    <p className="font-semibold">{t(REPORT_CATEGORY_LABEL_KEYS[r.category])}</p>
                    <p className="opacity-70">{t("chart.report_from_captain")}</p>
                    {r.depth_m != null && (
                      <p className="mt-1">{t("marine.depth_m", { value: r.depth_m })}</p>
                    )}
                    {r.seabed && <p>{t(SEABED_LABEL_KEYS[r.seabed])}</p>}
                    <p className="mt-1">{r.note}</p>
                  </div>
                </Popup>
              )}
            </Marker>
          ))}
      </MapContainer>

      {/*
       * Everything below is the floating cockpit "chrome" (HUD, search bar,
       * FAB stack, detail sheet, dialogs) rather than the map surface
       * itself. In fullscreen mode it's portaled straight to `document.body`
       * (see the IIFE below) — a descendant's z-index can never outrank an
       * ancestor's stacking context, and the map tile wrapper above
       * intentionally sits at a low z-index so the app shell's floating
       * bottom dock nav still paints over the *map*. Without the portal,
       * this chrome — including the bottom detail sheet — would be capped
       * at that same low z-index and end up hidden under the dock instead
       * of floating above it. Non-fullscreen (embedded) usage is untouched:
       * the IIFE just returns the same JSX in place, no portal involved.
       */}
      {(() => {
        const overlayContent = (
          <>
            {hud && (
              <>
                <ChartHud
                  layers={layers}
                  onToggleLayer={(key: ChartLayerKey) =>
                    setLayers((v) => ({ ...v, [key]: !v[key] }))
                  }
                  onJump={onJump}
                  onResetNorth={onResetNorth}
                  isAdmin={isAdmin}
                  drawing={drawing}
                  onToggleDraw={() => {
                    setPicking(false);
                    setDrawing((v) => !v);
                  }}
                  // Reporting is open to anonymous captains too — no sign-in gate.
                  canContribute
                  onAddReport={() => {
                    setDrawing(false);
                    setReportPos(null);
                    setReportDialog(true);
                  }}
                  mobileDrawerOpen={layersDrawerOpen}
                  onMobileDrawerOpenChange={setLayersDrawerOpen}
                />
                <ChartSearchBar
                  zones={zones}
                  reports={reports}
                  onSelect={(point) => {
                    const coords = chartPointCoords(point);
                    map?.flyTo([coords.lat, coords.lng], 15, { duration: 1 });
                    if (enableDetailSheet) setSelectedPoint(point);
                  }}
                  headerLeft={headerLeft}
                  headerRight={headerRight}
                  banner={
                    hud && !fix && !requesting && failure && !failureDismissed ? (
                      <div className="mt-1.5 flex w-full items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold leading-tight text-amber-100 shadow-2xl backdrop-blur-md">
                        <MapPinOff className="size-3 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                          {t(failure.messageKey, { defaultValue: failure.defaultMessage })}
                        </span>
                        <button
                          type="button"
                          onClick={() => void request()}
                          disabled={requesting}
                          aria-label={t("common.retry")}
                          title={t("common.retry")}
                          className="grid size-5 shrink-0 place-items-center rounded-full text-amber-100/70 hover:text-amber-50 disabled:opacity-50"
                        >
                          <RefreshCw className={"size-3 " + (requesting ? "animate-spin" : "")} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setFailureDismissed(true)}
                          aria-label={t("common.close")}
                          title={t("common.close")}
                          className="grid size-5 shrink-0 place-items-center rounded-full text-amber-100/70 hover:text-amber-50"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : null
                  }
                  below={
                    <>
                      {drawing && <ChartDrawHint kind="admin" inline />}
                      {picking && <ChartDrawHint kind="report" inline />}
                      {brand}
                      <div
                        className={
                          "transition-opacity duration-200 " +
                          (hideMapChrome ? "pointer-events-none opacity-0" : "opacity-100")
                        }
                      >
                        <MetoceanHud />
                      </div>
                      {fix && (
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold shadow backdrop-blur-md " +
                              (warn
                                ? "border-amber-300/40 bg-amber-400/20 text-amber-200"
                                : variant === "dark"
                                  ? "border-white/15 bg-white/10 text-white"
                                  : "border-border bg-white/90 text-foreground")
                            }
                          >
                            {stale
                              ? t("geo.stale")
                              : lowAccuracy
                                ? `${t("geo.low_accuracy")} · ${formatAccuracy(fix)}`
                                : `${t("geo.accuracy")} ${formatAccuracy(fix)}`}
                          </span>
                          {warn && retryButton}
                        </div>
                      )}
                      {!fix && (requesting || !hud) && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/20 px-2.5 py-1 text-[10px] font-bold text-amber-200 shadow backdrop-blur-md">
                            {requesting ? (
                              <>
                                <Loader2 className="size-3 animate-spin" />
                                {t("geo.locating")}
                              </>
                            ) : (
                              <>
                                <MapPinOff className="size-3" />
                                {failure
                                  ? t(failure.messageKey, { defaultValue: failure.defaultMessage })
                                  : t("geo.locating")}
                              </>
                            )}
                          </span>
                          {!requesting && retryButton}
                        </div>
                      )}
                    </>
                  }
                />
                <ChartReadout
                  coords={formatDegrees(telemetry.center.lat, telemetry.center.lng)}
                  scaleNm={telemetry.scaleNm}
                  viewportPinned={fullscreen}
                  concealed={hideMapChrome}
                />
                <ChartFabStack
                  onResetNorth={onResetNorth}
                  onOpenLayers={() => setLayersDrawerOpen(true)}
                  onLocateMe={() => void onLocateMe()}
                  locating={requesting}
                  showAi={fullscreen}
                  viewportPinned={fullscreen}
                  concealed={hideMapChrome}
                />
                {/* drawing/picking hints now live in ChartSearchBar `below` */}
              </>
            )}

            {!hud && (
              <div className="pointer-events-auto absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 z-20 flex max-w-[min(220px,calc(100vw-5.5rem))] flex-col items-start gap-2">
                {brand}
                {fix && (
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold shadow backdrop-blur-md " +
                        (warn
                          ? "border-amber-300/40 bg-amber-400/20 text-amber-200"
                          : variant === "dark"
                            ? "border-white/15 bg-white/10 text-white"
                            : "border-border bg-white/90 text-foreground")
                      }
                    >
                      {stale
                        ? t("geo.stale")
                        : lowAccuracy
                          ? `${t("geo.low_accuracy")} · ${formatAccuracy(fix)}`
                          : `${t("geo.accuracy")} ${formatAccuracy(fix)}`}
                    </span>
                    {warn && retryButton}
                  </div>
                )}
                {!fix && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/20 px-2.5 py-1 text-[10px] font-bold text-amber-200 shadow backdrop-blur-md">
                      {requesting ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          {t("geo.locating")}
                        </>
                      ) : (
                        <>
                          <MapPinOff className="size-3" />
                          {failure
                            ? t(failure.messageKey, { defaultValue: failure.defaultMessage })
                            : t("geo.locating")}
                        </>
                      )}
                    </span>
                    {!requesting && retryButton}
                  </div>
                )}
              </div>
            )}

          </>
        );
        const detailSheet = enableDetailSheet ? (
          <ChartDetailSheet
            point={selectedPoint}
            fix={fix}
            onClose={() => setSelectedPoint(null)}
            onNavigate={onNavigate}
            onEmergency={() => {
              setSelectedPoint(null);
              onRequestEmergency?.();
            }}
          />
        ) : null;
        return (
          <>
            {fullscreen
              ? mounted &&
                createPortal(
                  <div className="pointer-events-none fixed inset-0 z-20">{overlayContent}</div>,
                  document.body,
                )
              : overlayContent}
            {fullscreen
              ? mounted &&
                createPortal(
                  <div className="pointer-events-none fixed inset-0 z-50">{detailSheet}</div>,
                  document.body,
                )
              : detailSheet}
          </>
        );
      })()}

      <ReportModal
        open={reportDialog}
        onOpenChange={setReportDialog}
        picked={reportPos}
        onSubmitted={() => void loadChartData()}
      />
      <AdminZoneDialog
        open={zoneDialog}
        onOpenChange={setZoneDialog}
        position={zonePos}
        onSaved={() => void loadChartData()}
      />
    </div>
  );
}
