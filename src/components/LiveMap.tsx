import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Circle,
  Polygon,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { isNativeWebView } from "@/lib/native-history";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  MapPinOff,
  RefreshCw,
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
import { MARINE_DARK_TILE_URL as SAT_TILE, MARINE_SEAMARK_TILE_URL as SEAMARK_TILE } from "@/lib/chart-tiles";
import {
  fetchCommunityReports,
  fetchMarineZones,
  formatDegrees,
  toNauticalMiles,
  chartPointCoords,
  zoneBottomLabel,
  isValidChartPoint,
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
  nextBasemap,
  type ChartLayers,
  type ChartLayerKey,
  type ChartRegion,
  type PoiFilterKey,
  type BasemapId,
} from "@/components/map/ChartHud";
import { ChartSearchBar } from "@/components/map/ChartSearchBar";
import { ChartDetailSheet } from "@/components/map/ChartDetailSheet";
import {
  consumeMapFocus,
  THALVO_MAP_FOCUS_EVENT,
  type MapFocusTarget,
} from "@/lib/map-focus-bus";
import { CHART_PIN_ANCHOR, CHART_PIN_SIZE, chartPinHtml, type ChartPinKind } from "@/lib/chart-pins";
import { setMapChromeOverlay } from "@/lib/map-chrome";
import { publishCockpitContext } from "@/lib/ai-captain-context-bus";
import { THALVO_LAYER_FILTER_EVENT, type LayerFilterRequest } from "@/lib/map-layers-bus";
import { ReportModal } from "@/components/ReportModal";
import { AdminZoneDialog } from "@/components/map/AdminZoneDialog";
import { MetoceanHud } from "@/components/map/MetoceanHud";
import { MapPlaceholder } from "@/components/ClientOnly";
import { createRealtimeBuffer, debounce, runWhenIdle } from "@/lib/schedule";
import {
  AEGEAN_OFFLINE_BOUNDS,
  createCachedTileLayer,
  downloadAreaTiles,
  type DownloadProgress,
  type PrefetchController,
} from "@/lib/map/tileCache";

export {
  MARINE_DARK_TILE_MAX_NATIVE_ZOOM,
  MARINE_DARK_TILE_URL,
  MARINE_SEAMARK_TILE_URL,
} from "@/lib/chart-tiles";

export interface LivePin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "mechanic" | "diver";
}

/** Captain/sailor SOS or fault call, plotted at the device fix. */
export interface LiveAlert {
  id: string;
  lat: number;
  lng: number;
  title: string;
  kind: "sos" | "fault";
  detail?: string;
}

/** Dispatch route line: a responding boat's position to the job it's assigned to. */
export interface LiveRoute {
  id: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}

interface Props {
  providers: LivePin[];
  /** Open SOS and fault calls with a real device fix. */
  alerts?: LiveAlert[];
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
  aegean: { lat: 37.15, lng: 27.2, zoom: 8 },
  mediterranean: { lat: 36.35, lng: 29.1, zoom: 7 },
};

/**
 * Cockpit rasters. Default is Esri World Imagery (real bays/coast) plus an
 * OpenSeaMap seamark overlay. Nautical = OSM Mapnik + seamarks. Night =
 * OSM inverted (Carto's public Dark Matter URL watermarks without a key).
 */
const OSM_RASTER_TILE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const CHART_VOID = "#0b132b";
const CHART_MIN_ZOOM = 4;
const CHART_MAX_ZOOM = 18;

const DARK_ERROR_TILE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${CHART_VOID}"/></svg>`,
  );
const CLEAR_ERROR_TILE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>`);

function pinIcon(kind: ChartPinKind) {
  return L.divIcon({
    html: chartPinHtml(kind),
    className: "thalvo-map-marker",
    iconSize: CHART_PIN_SIZE,
    iconAnchor: CHART_PIN_ANCHOR,
    popupAnchor: [0, -40],
  });
}

const mechIcon = pinIcon("marina");
const diverIcon = pinIcon("anchorage");
const sosIcon = pinIcon("hazard");
const faultIcon = pinIcon("fuel");

const ZONE_ICONS: Record<MarineZoneKind, L.DivIcon> = {
  marina: pinIcon("marina"),
  fuel: pinIcon("fuel"),
  lighthouse: pinIcon("lighthouse"),
  restaurant: pinIcon("restaurant"),
  hazard: pinIcon("hazard"),
  anchorage: pinIcon("anchorage"),
};

const meIcon = pinIcon("own");
const reportIcon = pinIcon("lighthouse");

function Recenter({
  center,
  suspend = false,
}: {
  center: { lat: number; lng: number } | null;
  suspend?: boolean;
}) {
  const map = useMap();
  const userMoved = useRef(false);
  useMapEvents({
    dragstart: () => {
      userMoved.current = true;
    },
    zoomstart: () => {
      userMoved.current = true;
    },
  });
  useEffect(() => {
    if (!center || suspend || userMoved.current) return;
    map.setView([center.lat, center.lng], map.getZoom(), { animate: false });
  }, [center, center?.lat, center?.lng, map, suspend]);
  return null;
}

/** First GPS fix recenters once. Later watch updates must not steal the pan. */
function BootstrapGps({ fix }: { fix: GeoFix | null }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (!fix || done.current) return;
    done.current = true;
    map.setView([fix.lat, fix.lng], Math.max(map.getZoom(), DEFAULT_ZOOM), { animate: false });
  }, [fix, map]);
  return null;
}

function MapInteractionUnlock() {
  const map = useMap();
  useEffect(() => {
    map.dragging.enable();
    map.touchZoom.enable();
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    const el = map.getContainer();
    el.style.pointerEvents = "auto";
    el.style.touchAction = "none";
  }, [map]);
  return null;
}

/** Reports live map telemetry (centre + scale) and click positions upward. */
function MapBridge({
  onTelemetry,
  onClick,
}: {
  onTelemetry: (center: { lat: number; lng: number }, scaleNm: number | null, bearingDeg: number) => void;
  onClick?: (pos: { lat: number; lng: number }) => void;
}) {
  const map = useMap();

  const report = useCallback(() => {
    const c = map.getCenter();
    const size = map.getSize();
    const west = map.containerPointToLatLng([0, size.y / 2]);
    const east = map.containerPointToLatLng([size.x, size.y / 2]);
    const nm = size.x > 0 ? toNauticalMiles(west.distanceTo(east)) : null;
    onTelemetry({ lat: c.lat, lng: c.lng }, nm, 0);
  }, [map, onTelemetry]);

  const delayed = useMemo(
    () => debounce(report, isNativeWebView() ? 280 : 160),
    [report],
  );

  useEffect(() => {
    report();
  }, [report]);

  useEffect(() => () => delayed.cancel(), [delayed]);

  useMapEvents({
    moveend: delayed,
    zoomend: delayed,
    click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });

  return null;
}

function MapSizeSync() {
  const map = useMap();
  useEffect(() => {
    let lastW = 0;
    let lastH = 0;
    const kick = () => {
      try {
        const size = map.getSize();
        // Guard: invalidateSize can nudge layout → ResizeObserver → infinite
        // invalidate loop that freezes WKWebView / Chrome on mobile.
        if (size.x === lastW && size.y === lastH && lastW > 0) return;
        lastW = size.x;
        lastH = size.y;
        map.invalidateSize({ animate: false });
        map.dragging.enable();
        map.touchZoom.enable();
        map.scrollWheelZoom.enable();
      } catch {
        /* map already torn down */
      }
    };
    const delayed = debounce(kick, 180);
    const raf = requestAnimationFrame(delayed);
    const ids = [200, 800].map((ms) => window.setTimeout(delayed, ms));
    window.addEventListener("resize", delayed);
    window.addEventListener("orientationchange", delayed);
    document.addEventListener("visibilitychange", delayed);
    let observer: ResizeObserver | null = null;
    const container = map.getContainer();
    if (container && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => delayed());
      observer.observe(container);
    }
    return () => {
      cancelAnimationFrame(raf);
      ids.forEach((id) => window.clearTimeout(id));
      delayed.cancel();
      observer?.disconnect();
      window.removeEventListener("resize", delayed);
      window.removeEventListener("orientationchange", delayed);
      document.removeEventListener("visibilitychange", delayed);
    };
  }, [map]);
  return null;
}

function ChartRasterLayers({
  basemap,
  showSeamarks,
}: {
  basemap: BasemapId;
  showSeamarks: boolean;
}) {
  const map = useMap();
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const seaLayerRef = useRef<L.TileLayer | null>(null);
  const darkLayerRef = useRef<L.TileLayer | null>(null);
  const seamarkLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    // Low keepBuffer on WebView — satellite + seamark tiles otherwise pin
    // dozens of decoded bitmaps and OOM mid-range devices.
    const keepBuffer = 1;
    const raster = {
      minZoom: CHART_MIN_ZOOM,
      maxZoom: CHART_MAX_ZOOM,
      errorTileUrl: DARK_ERROR_TILE,
      keepBuffer,
      updateWhenZooming: false,
      updateWhenIdle: true,
    };
    const satellite = createCachedTileLayer(SAT_TILE, {
      ...raster,
      maxNativeZoom: 18,
      attribution: "Tiles © Esri",
    });
    const sea = createCachedTileLayer(OSM_RASTER_TILE, {
      ...raster,
      maxNativeZoom: 19,
      attribution: "© OpenStreetMap",
    });
    const dark = createCachedTileLayer(OSM_RASTER_TILE, {
      ...raster,
      maxNativeZoom: 19,
      className: "thalvo-dark-tiles",
      attribution: "© OpenStreetMap",
    });
    const seamark = createCachedTileLayer(SEAMARK_TILE, {
      minZoom: CHART_MIN_ZOOM,
      maxZoom: CHART_MAX_ZOOM,
      maxNativeZoom: 18,
      zIndex: 400,
      errorTileUrl: CLEAR_ERROR_TILE,
      keepBuffer,
      updateWhenZooming: false,
      updateWhenIdle: true,
      className: "thalvo-seamark-tiles",
    });

    satelliteLayerRef.current = satellite;
    seaLayerRef.current = sea;
    darkLayerRef.current = dark;
    seamarkLayerRef.current = seamark;

    return () => {
      map.removeLayer(satellite);
      map.removeLayer(sea);
      map.removeLayer(dark);
      map.removeLayer(seamark);
      satelliteLayerRef.current = null;
      seaLayerRef.current = null;
      darkLayerRef.current = null;
      seamarkLayerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const satellite = satelliteLayerRef.current;
    const sea = seaLayerRef.current;
    const dark = darkLayerRef.current;
    const seamark = seamarkLayerRef.current;
    if (!satellite || !sea || !dark || !seamark) return;

    const show = (layer: L.TileLayer) => {
      if (!map.hasLayer(layer)) map.addLayer(layer);
    };
    const hide = (layer: L.TileLayer) => {
      if (!map.hasLayer(layer)) return;
      map.removeLayer(layer);
      // Purge decoded bitmaps from inactive basemaps (WebView OOM guard).
      const tiles = (layer as unknown as { _tiles?: Record<string, { el?: HTMLElement }> })._tiles;
      if (tiles) {
        for (const key of Object.keys(tiles)) {
          const el = tiles[key]?.el;
          if (el?.parentNode) el.parentNode.removeChild(el);
          delete tiles[key];
        }
      }
    };

    if (basemap === "sat") {
      show(satellite);
      hide(sea);
      hide(dark);
    } else if (basemap === "dark") {
      show(dark);
      hide(satellite);
      hide(sea);
    } else {
      show(sea);
      hide(satellite);
      hide(dark);
    }

    if (showSeamarks) show(seamark);
    else hide(seamark);
  }, [map, basemap, showSeamarks]);

  return null;
}

const FleetPinMarker = memo(function FleetPinMarker({ pin }: { pin: LivePin }) {
  return (
    <Marker position={[pin.lat, pin.lng]} icon={pin.kind === "diver" ? diverIcon : mechIcon}>
      <Popup>
        <span className="text-[12px] font-semibold">{pin.name}</span>
      </Popup>
    </Marker>
  );
});

const ChartOverlays = memo(function ChartOverlays({
  fix,
  stale,
  pins,
  alerts,
  moorings,
  hazards,
  lights,
  reports,
  layers,
  poiFilters,
  enableDetailSheet,
  onSelectZone,
  onSelectReport,
}: {
  fix: GeoFix | null;
  stale: boolean;
  pins: LivePin[];
  alerts: LiveAlert[];
  routes: LiveRoute[];
  moorings: MarineZone[];
  hazards: MarineZone[];
  lights: MarineZone[];
  reports: CommunityReport[];
  layers: ChartLayers;
  poiFilters: Record<PoiFilterKey, boolean>;
  enableDetailSheet: boolean;
  onSelectZone: (zone: MarineZone) => void;
  onSelectReport: (report: CommunityReport) => void;
}) {
  const { t } = useTranslation();
  const zonePopup = (z: MarineZone) => (
    <div className="text-[12px] leading-snug">
      <p className="font-semibold">{z?.name ?? "—"}</p>
      <p className="opacity-70">
        {t(ZONE_KIND_LABEL_KEYS[z?.kind as MarineZoneKind] ?? "marine.kind_marina")}
      </p>
      {z?.vhf_channel && (
        <p className="mt-1">{t("marine.vhf_channel", { channel: z.vhf_channel })}</p>
      )}
      {z?.depth_m != null && <p>{t("marine.depth_m", { value: z.depth_m })}</p>}
      {zoneBottomLabel(z) && <p>{zoneBottomLabel(z)}</p>}
      {z?.description && <p className="mt-1">{z.description}</p>}
    </div>
  );

  return (
    <>
      {fix && <Marker position={[fix.lat, fix.lng]} icon={meIcon} opacity={stale ? 0.5 : 1} />}

      {layers.fleet &&
        poiFilters.service &&
        pins.map((p) => <FleetPinMarker key={p.id} pin={p} />)}

      {alerts.map((alert) => (
        <Circle
          key={`${alert.id}-ring`}
          center={[alert.lat, alert.lng]}
          radius={45}
          pathOptions={{
            color: alert.kind === "sos" ? "#EF4444" : "#F59E0B",
            fillColor: alert.kind === "sos" ? "#EF4444" : "#F59E0B",
            fillOpacity: 0.22,
            weight: 1.6,
          }}
        />
      ))}
      {alerts.map((alert) => (
        <Marker
          key={alert.id}
          position={[alert.lat, alert.lng]}
          icon={alert.kind === "sos" ? sosIcon : faultIcon}
        >
          <Popup>
            <div className="text-[12px] leading-snug">
              <p className="font-semibold">
                {alert.kind === "sos" ? t("ops_alerts.sos_title") : t("ops_alerts.fault_title")}
              </p>
              <p>{alert.title}</p>
              <p className="mt-1 font-mono">{formatDegrees(alert.lat, alert.lng)}</p>
              {alert.detail ? <p className="mt-1 opacity-70">{alert.detail}</p> : null}
            </div>
          </Popup>
        </Marker>
      ))}

      {layers.moorings &&
        moorings.map((z) => (
          <Marker
            key={z.id}
            position={[z.lat, z.lng]}
            icon={ZONE_ICONS[z.kind]}
            eventHandlers={
              enableDetailSheet ? { click: () => onSelectZone(z) } : undefined
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
                color: "#34d399",
                fillColor: "#34d399",
                fillOpacity: 0.1,
                weight: 1.25,
              }}
            />
          ))}

      {layers.seamarks &&
        lights.map((z) => (
          <Marker
            key={z.id}
            position={[z.lat, z.lng]}
            icon={ZONE_ICONS.lighthouse}
            eventHandlers={
              enableDetailSheet ? { click: () => onSelectZone(z) } : undefined
            }
          >
            {!enableDetailSheet && <Popup>{zonePopup(z)}</Popup>}
          </Marker>
        ))}

      {layers.hazards &&
        hazards.map((z) => (
          <Circle
            key={z.id}
            center={[z.lat, z.lng]}
            radius={300}
            pathOptions={{
              color: "#f43f5e",
              fillColor: "#f43f5e",
              fillOpacity: 0.14,
              weight: 1.4,
              dashArray: "4 4",
            }}
            eventHandlers={
              enableDetailSheet ? { click: () => onSelectZone(z) } : undefined
            }
          >
            {!enableDetailSheet && <Popup>{zonePopup(z)}</Popup>}
          </Circle>
        ))}

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

      {layers.reports &&
        reports.map((r) => (
          <Marker
            key={r.id}
            position={[r.lat, r.lng]}
            icon={reportIcon}
            eventHandlers={
              enableDetailSheet ? { click: () => onSelectReport(r) } : undefined
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
    </>
  );
});

export const LiveMap = memo(function LiveMap(props: Props) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <MapPlaceholder
        className={props.className}
        style={
          props.fullscreen
            ? { height: "100%", minHeight: 500, width: "100%" }
            : { height: props.height ?? 500, minHeight: 500 }
        }
      />
    );
  }

  return <LiveMapCanvas {...props} />;
});

function LiveMapCanvas({
  providers,
  alerts = [],
  routes = [],
  center,
  className = "",
  height = 400,
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
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);
  const [hudOpen, setHudOpen] = useState(true);
  const [basemap, setBasemap] = useState<BasemapId>("dark");
  const [poiFilters, setPoiFilters] = useState<Record<PoiFilterKey, boolean>>({
    marinas: true,
    fuel: true,
    service: true,
  });
  // A dismissed geolocation failure band stays hidden until a *new* failure
  // comes in (tracked by reference below) — closing it once shouldn't mean
  // fighting it every retry, but a fresh error (e.g. a different reason)
  // should still surface.
  const [failureDismissed, setFailureDismissed] = useState(false);
  const [map, setMap] = useState<L.Map | null>(null);
  const started = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedPoint, setSelectedPoint] = useState<ChartPoint | null>(null);

  const [tileProgress, setTileProgress] = useState<DownloadProgress | null>(null);
  const prefetchRef = useRef<PrefetchController | null>(null);

  const onDownloadOfflineTiles = useCallback(() => {
    if (prefetchRef.current) {
      prefetchRef.current.cancel();
      prefetchRef.current = null;
      setTileProgress(null);
      return;
    }
    // Prefetch night/sea OSM basemap for the Göcek–Fethiye–Bozburun corridor.
    const ctrl = downloadAreaTiles(
      OSM_RASTER_TILE,
      AEGEAN_OFFLINE_BOUNDS,
      9,
      15,
      (p) => setTileProgress({ ...p }),
    );
    prefetchRef.current = ctrl;
    void ctrl.promise.finally(() => {
      prefetchRef.current = null;
      setTimeout(() => setTileProgress(null), 2500);
    });
  }, []);

  useEffect(() => {
    if (!map) return;
    const apply = (target: MapFocusTarget) => {
      if (!isValidCoordinate(target.lat, target.lng)) return;
      map.flyTo([target.lat, target.lng], target.zoom ?? 15, { duration: 1.15 });
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
    // Seamark overlay doubles tile work — paint the basemap first.
    seamarks: false,
    hazards: true,
    moorings: true,
    reports: true,
    fleet: true,
  });
  const [telemetry, setTelemetry] = useState<{
    center: { lat: number; lng: number };
    scaleNm: number | null;
    bearingDeg: number;
  }>({
    center: GOCEK,
    scaleNm: null,
    bearingDeg: 0,
  });
  const lastPublishedCenter = useRef({ lat: GOCEK.lat, lng: GOCEK.lng });

  useEffect(() => {
    return runWhenIdle(() => {
      setLayers((v) => (v.seamarks ? v : { ...v, seamarks: true }));
    }, 1400);
  }, []);

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

  useEffect(() => {
    const onFilter = (event: Event) => {
      const detail = (event as CustomEvent<LayerFilterRequest>).detail;
      if (!detail?.layer) return;
      setLayers((v) => ({ ...v, [detail.layer]: detail.enabled }));
    };
    window.addEventListener(THALVO_LAYER_FILTER_EVENT, onFilter);
    return () => window.removeEventListener(THALVO_LAYER_FILTER_EVENT, onFilter);
  }, []);

  // AI Captain context: selection/GPS always publish; chart-pan is throttled
  // so drag does not flood the main thread.
  useEffect(() => {
    try {
      const position = fix
        ? { lat: fix.lat, lng: fix.lng, source: "gps" as const }
        : { lat: telemetry.center.lat, lng: telemetry.center.lng, source: "chart" as const };

      if (selectedPoint?.kind === "zone" && selectedPoint.zone) {
        const z = selectedPoint.zone;
        publishCockpitContext({
          position,
          selectedBay: {
            name: z.name ?? "—",
            kind: z.kind ?? "marina",
            depthM: z.depth_m ?? null,
            seabed: zoneBottomLabel(z),
            protection: z.metadata?.protection ?? null,
            lat: z.lat,
            lng: z.lng,
          },
        });
        return;
      }
      if (selectedPoint?.kind === "report" && selectedPoint.report) {
        const r = selectedPoint.report;
        publishCockpitContext({
          position,
          selectedBay: {
            name: r.title ?? "—",
            kind: r.category ?? "general",
            depthM: r.depth_m ?? null,
            seabed: r.seabed ?? null,
            protection: null,
            lat: r.lat,
            lng: r.lng,
          },
        });
        return;
      }
      publishCockpitContext({ position, selectedBay: null });
    } catch (err) {
      console.error("[LiveMap] cockpit context publish failed:", err);
    }
  }, [fix, selectedPoint]);

  useEffect(() => {
    if (fix || selectedPoint) return;
    const lat = telemetry.center.lat;
    const lng = telemetry.center.lng;
    const prev = lastPublishedCenter.current;
    if (Math.abs(lat - prev.lat) < 0.003 && Math.abs(lng - prev.lng) < 0.003) return;
    lastPublishedCenter.current = { lat, lng };
    publishCockpitContext({
      position: { lat, lng, source: "chart" },
      selectedBay: null,
    });
  }, [fix, selectedPoint, telemetry.center.lat, telemetry.center.lng]);

  useEffect(() => {
    setMapChromeOverlay("layers", layersMenuOpen);
  }, [layersMenuOpen]);
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
    return runWhenIdle(() => {
      void loadChartData();
    }, 900);
  }, [loadChartData]);

  useEffect(() => {
    const buffer = createRealtimeBuffer(() => {
      void loadChartData();
    }, 180);
    const channel = supabase
      .channel("live-map-chart-data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_reports" },
        () => buffer.ping(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marine_zones" },
        () => buffer.ping(),
      )
      .subscribe();
    return () => {
      buffer.dispose();
      supabase.removeChannel(channel);
    };
  }, [loadChartData]);

  useEffect(() => {
    let cancelled = false;
    const stopIdle = runWhenIdle(() => {
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
    }, 1400);
    return () => {
      cancelled = true;
      stopIdle();
    };
  }, []);

  const validCenter = center && isValidCoordinate(center.lat, center.lng) ? center : null;
  // Fall back to the Göcek viewport so the chart is always useful, even
  // without a GPS fix. The accuracy chip stays honest about the fix state.
  const effectiveCenter = validCenter ?? fix ?? GOCEK;

  const pins = useMemo(() => pickValidCoordinates(providers), [providers]);
  const moorings = useMemo(
    () =>
      zones.filter((z) => {
        if (!layers.moorings) return false;
        if (z.kind === "fuel") return poiFilters.fuel;
        if (z.kind === "marina" || z.kind === "anchorage" || z.kind === "restaurant") {
          return poiFilters.marinas;
        }
        return false;
      }),
    [zones, layers.moorings, poiFilters.fuel, poiFilters.marinas],
  );
  const hazards = useMemo(() => zones.filter((z) => z.kind === "hazard"), [zones]);
  const lights = useMemo(() => zones.filter((z) => z.kind === "lighthouse"), [zones]);
  const onSelectZone = useCallback((zone: MarineZone) => {
    console.log("[Point Clicked]:", { kind: "zone", zone });
    if (!zone || !Number.isFinite(zone.lat) || !Number.isFinite(zone.lng)) {
      console.error("[Point Clicked] invalid zone — ignored", zone);
      return;
    }
    // Normalize metadata so sheet/AI never see null.
    setSelectedPoint({
      kind: "zone",
      zone: { ...zone, metadata: zone.metadata ?? {} },
    });
  }, []);
  const onSelectReport = useCallback((report: CommunityReport) => {
    console.log("[Point Clicked]:", { kind: "report", report });
    if (!report || !Number.isFinite(report.lat) || !Number.isFinite(report.lng)) {
      console.error("[Point Clicked] invalid report — ignored", report);
      return;
    }
    setSelectedPoint({ kind: "report", report });
  }, []);

  const wrapperClass = fullscreen
    ? "thalvo-map-gpu absolute inset-0 isolate z-0 h-full min-h-[500px] w-full overflow-hidden " + className
    : "thalvo-map-gpu relative isolate z-0 h-full min-h-[500px] w-full overflow-hidden " +
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

  // "Go to my location" FAB: fly straight to an already-held fix, or take a
  // fresh one and fly to it as soon as it lands — either path leaves the
  // GEO_OPTIONS/failure handling identical to the initial auto-request.
  const onLocateMe = useCallback(async () => {
    setRequesting(true);
    const res = await getFix(GEO_OPTIONS);
    if (res.ok) {
      setFix(res.fix);
      setFailure(null);
      map?.flyTo([res.fix.lat, res.fix.lng], 14, { duration: 1 });
    } else if (fix) {
      map?.flyTo([fix.lat, fix.lng], 14, { duration: 1 });
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
      if (!isValidCoordinate(coords.lat, coords.lng)) return;
      map?.flyTo([coords.lat, coords.lng], 15, { duration: 1 });
    },
    [map],
  );

  // Leaflet's container doesn't auto-detect layout changes (sheet
  // open/close, orientation flips, or the iOS Safari URL bar collapsing) —
  // without this the tiles freeze at the old size and leave grey gutters.
  useEffect(() => {
    if (!map) return;
    const invalidate = debounce(() => map.invalidateSize({ animate: false }), 150);
    const raf = requestAnimationFrame(invalidate);
    window.addEventListener("orientationchange", invalidate);
    return () => {
      cancelAnimationFrame(raf);
      invalidate.cancel();
      window.removeEventListener("orientationchange", invalidate);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const invalidate = debounce(() => map.invalidateSize({ animate: false }), 150);
    invalidate();
    return () => invalidate.cancel();
  }, [map, layersMenuOpen, hudOpen]);

  const onMapTelemetry = useCallback(
    (nextCenter: { lat: number; lng: number }, scaleNm: number | null, bearingDeg: number) => {
      // Quantize so sub-pixel pan noise does not re-render the whole cockpit.
      const lat = Math.round(nextCenter.lat * 1e5) / 1e5;
      const lng = Math.round(nextCenter.lng * 1e5) / 1e5;
      const nm = scaleNm == null ? null : Math.round(scaleNm * 100) / 100;
      const bearing = Math.round(bearingDeg);
      setTelemetry((current) => {
        if (
          current.center.lat === lat &&
          current.center.lng === lng &&
          current.scaleNm === nm &&
          current.bearingDeg === bearing
        )
          return current;
        return { center: { lat, lng }, scaleNm: nm, bearingDeg: bearing };
      });
    },
    [],
  );

  return (
    <div
      ref={wrapperRef}
      className={wrapperClass}
      style={
        fullscreen
          ? {
              height: "100%",
              minHeight: 500,
              width: "100%",
            }
          : {
              height,
              minHeight: 500,
            }
      }
    >
      <div
        className="thalvo-map-gpu absolute inset-0 z-0 h-full min-h-[500px] w-full"
        style={{
          pointerEvents: "auto",
          touchAction: "none",
        }}
      >
      <MapContainer
        ref={setMap}
        center={[effectiveCenter.lat, effectiveCenter.lng]}
        zoom={DEFAULT_ZOOM}
        minZoom={CHART_MIN_ZOOM}
        maxZoom={CHART_MAX_ZOOM}
        dragging
        touchZoom
        scrollWheelZoom={fullscreen || scrollZoom}
        doubleClickZoom
        boxZoom
        keyboard
        zoomControl={false}
        attributionControl={false}
        preferCanvas
        fadeAnimation={false}
        zoomAnimation={false}
        markerZoomAnimation={false}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={60}
        className={(variant === "dark" ? "thalvo-ecdis " : "") + "h-full w-full min-h-[500px]"}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "500px",
          pointerEvents: "auto",
          touchAction: "none",
          background: variant === "dark" ? CHART_VOID : undefined,
        }}
        {...({
          tap: true,
          scrollWheelZoom: Boolean(fullscreen || scrollZoom),
          smoothWheelZoom: true,
        } as Record<string, unknown>)}
      >
        <MapSizeSync />
        <MapInteractionUnlock />
        {validCenter ? (
          <Recenter center={validCenter} />
        ) : (
          <BootstrapGps fix={fix} />
        )}
        <ChartRasterLayers
          basemap={basemap}
          showSeamarks={layers.seamarks}
        />
        <MapBridge onTelemetry={onMapTelemetry} onClick={onMapClick} />
        <ChartOverlays
          fix={fix}
          stale={stale}
          pins={pins}
          alerts={pickValidCoordinates(alerts)}
          routes={routes}
          moorings={moorings}
          hazards={hazards}
          lights={lights}
          reports={reports}
          layers={layers}
          poiFilters={poiFilters}
          enableDetailSheet={enableDetailSheet}
          onSelectZone={onSelectZone}
          onSelectReport={onSelectReport}
        />
      </MapContainer>
      </div>

      {/*
       * HUD / search / FAB chrome stays inside the map wrapper so it cannot
       * sit in a document-body stacking context above the SOS dock. The dock
       * is a sibling of this wrapper (z-[90]); iOS WebView still hit-tests
       * full-screen `pointer-events-none` body portals and swallows the SOS tap.
       */}
      {(() => {
        const overlayContent = (
          <div className="pointer-events-none absolute inset-0 z-[400]">
            {hud && (
              <>
                <ChartHud
                  layers={layers}
                  onToggleLayer={(key: ChartLayerKey) =>
                    setLayers((v) => ({ ...v, [key]: !v[key] }))
                  }
                  onJump={onJump}
                  filters={poiFilters}
                  onToggleFilter={(key) =>
                    setPoiFilters((current) => ({ ...current, [key]: !current[key] }))
                  }
                  isAdmin={isAdmin}
                  drawing={drawing}
                  onToggleDraw={() => {
                    setPicking(false);
                    setDrawing((v) => !v);
                  }}
                  canContribute
                  onAddReport={() => {
                    setDrawing(false);
                    setReportPos(null);
                    setReportDialog(true);
                  }}
                  panelOpen={hudOpen}
                  onPanelOpenChange={setHudOpen}
                  basemap={basemap}
                  onSelectBasemap={setBasemap}
                  onDownloadOfflineTiles={onDownloadOfflineTiles}
                  tileDownloadPercent={tileProgress?.percent ?? null}
                  tileDownloadActive={Boolean(tileProgress && tileProgress.percent < 100)}
                />
                <ChartSearchBar
                  zones={zones}
                  reports={reports}
                  onSelect={(point) => {
                    console.log("[Point Clicked]:", point);
                    if (!isValidChartPoint(point)) {
                      console.error("[Point Clicked] invalid chart point — ignored", point);
                      return;
                    }
                    const coords = chartPointCoords(point);
                    map?.flyTo([coords.lat, coords.lng], 15, { duration: 1 });
                    if (enableDetailSheet) {
                      if (point.kind === "zone") {
                        setSelectedPoint({
                          kind: "zone",
                          zone: { ...point.zone, metadata: point.zone.metadata ?? {} },
                        });
                      } else {
                        setSelectedPoint(point);
                      }
                    }
                  }}
                  headerLeft={headerLeft}
                  headerRight={headerRight}
                  banner={
                    hud && !fix && !requesting && failure && !failureDismissed ? (
                      <div className="flex w-full min-w-0 items-start gap-1.5 rounded-xl border border-amber-300/40 bg-amber-400/15 px-2.5 py-1.5 text-[10px] font-semibold leading-snug text-amber-100 shadow-2xl backdrop-blur-md">
                        <MapPinOff className="mt-0.5 size-3 shrink-0" />
                        <span className="min-w-0 flex-1 whitespace-normal">
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
                      {brand ? <div className="pointer-events-auto w-fit max-w-full">{brand}</div> : null}
                      <div
                        className={
                          "pointer-events-auto w-fit max-w-full transition-opacity duration-200 " +
                          (layersMenuOpen ? "pointer-events-none opacity-0" : "opacity-100")
                        }
                      >
                        <MetoceanHud />
                      </div>
                      {requesting && !fix && (
                        <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/20 px-2.5 py-1 text-[10px] font-bold text-amber-200 shadow backdrop-blur-md">
                          <Loader2 className="size-3 animate-spin" />
                          {t("geo.locating")}
                        </span>
                      )}
                    </>
                  }
                />
                <ChartReadout
                  coords={formatDegrees(telemetry.center.lat, telemetry.center.lng)}
                  scaleNm={telemetry.scaleNm}
                  viewportPinned={fullscreen}
                  concealed={false}
                />
                <ChartFabStack
                  onCycleBasemap={() => setBasemap((v) => nextBasemap(v))}
                  layersOpen={layersMenuOpen}
                  onLayersOpenChange={setLayersMenuOpen}
                  onLocateMe={() => void onLocateMe()}
                  locating={requesting}
                  concealed={false}
                  basemap={basemap}
                  onSelectBasemap={setBasemap}
                  layers={layers}
                  onToggleLayer={(key: ChartLayerKey) =>
                    setLayers((v) => ({ ...v, [key]: !v[key] }))
                  }
                  onJump={onJump}
                  filters={poiFilters}
                  onToggleFilter={(key) =>
                    setPoiFilters((current) => ({ ...current, [key]: !current[key] }))
                  }
                  isAdmin={isAdmin}
                  drawing={drawing}
                  onToggleDraw={() => {
                    setPicking(false);
                    setDrawing((v) => !v);
                  }}
                  canContribute
                  onAddReport={() => {
                    setDrawing(false);
                    setReportPos(null);
                    setReportDialog(true);
                  }}
                  onDownloadOfflineTiles={onDownloadOfflineTiles}
                  tileDownloadPercent={tileProgress?.percent ?? null}
                  tileDownloadActive={Boolean(tileProgress && tileProgress.percent < 100)}
                />
                {/* drawing/picking hints now live in ChartSearchBar `below` */}
              </>
            )}

            {tileProgress && (
              <div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-1/2 z-[460] -translate-x-1/2 px-3">
                <div className="pointer-events-auto rounded-full border border-cyan-400/35 bg-[#0B1528]/92 px-3.5 py-1.5 font-mono text-[11px] text-cyan-100 shadow-2xl backdrop-blur-md">
                  {tileProgress.percent >= 100 && !tileProgress.cancelled
                    ? t("chart.offline_download_done")
                    : t("chart.offline_download_progress", {
                        percent: tileProgress.percent,
                      })}
                  <span className="ml-2 inline-block h-1.5 w-16 overflow-hidden rounded-full bg-cyan-950 align-middle">
                    <span
                      className="block h-full rounded-full bg-cyan-400 transition-[width] duration-200"
                      style={{ width: `${Math.min(100, tileProgress.percent)}%` }}
                    />
                  </span>
                </div>
              </div>
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
          </div>
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
            {overlayContent}
            {detailSheet}
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
