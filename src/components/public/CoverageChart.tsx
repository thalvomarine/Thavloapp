import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslation } from "react-i18next";
import { MapPlaceholder } from "@/components/ClientOnly";
import {
  MARINE_DARK_TILE_MAX_NATIVE_ZOOM,
  MARINE_PUBLIC_BASE_URL,
  MARINE_SEAMARK_TILE_URL,
} from "@/lib/chart-tiles";
import {
  fetchMarineZones,
  ZONE_KIND_LABEL_KEYS,
  type MarineZone,
  type MarineZoneKind,
} from "@/lib/marine-data";

/** Coverage pins only. Live vessels and technicians stay off this chart. */
const COVERAGE_KINDS = new Set<MarineZoneKind>(["marina", "anchorage", "fuel", "hazard"]);

const KIND_COLOR: Record<MarineZoneKind, string> = {
  marina: "#22d3ee",
  anchorage: "#fbbf24",
  fuel: "#34d399",
  hazard: "#fb7185",
  lighthouse: "#94a3b8",
  restaurant: "#94a3b8",
};

export const COVERAGE_BAYS = {
  gocek: { lat: 36.7525, lng: 28.9428, zoom: 11 },
  marmaris: { lat: 36.8525, lng: 28.278, zoom: 12 },
  bodrum: { lat: 37.034, lng: 27.43, zoom: 12 },
} as const;

export type CoverageBayId = keyof typeof COVERAGE_BAYS;

const VOID_TILE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#0b132b"/></svg>',
  );
const CLEAR_TILE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>');

function GoTo({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (mobile) map.setView([lat, lng], zoom, { animate: false });
    else map.flyTo([lat, lng], zoom, { duration: 0.45 });
  }, [map, lat, lng, zoom]);
  return null;
}

function FitFrame() {
  const map = useMap();
  useEffect(() => {
    const kick = () => map.invalidateSize({ animate: false });
    kick();
    const frame = requestAnimationFrame(kick);
    const later = window.setTimeout(kick, 300);
    window.addEventListener("resize", kick);
    window.visualViewport?.addEventListener("resize", kick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(later);
      window.removeEventListener("resize", kick);
      window.visualViewport?.removeEventListener("resize", kick);
    };
  }, [map]);
  return null;
}

function Seamarks() {
  const map = useMap();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (!mobile) {
      setOn(true);
      return;
    }
    const enable = () => {
      if (map.getZoom() >= 13) setOn(true);
    };
    map.on("zoomend", enable);
    const later = window.setTimeout(enable, 1500);
    return () => {
      map.off("zoomend", enable);
      window.clearTimeout(later);
    };
  }, [map]);
  if (!on) return null;
  return (
    <TileLayer
      url={MARINE_SEAMARK_TILE_URL}
      minZoom={4}
      maxZoom={18}
      opacity={0.9}
      errorTileUrl={CLEAR_TILE}
      updateWhenIdle
      updateWhenZooming={false}
      keepBuffer={1}
    />
  );
}

export function CoverageChart({
  bay,
  fill = false,
  own = null,
}: {
  bay: CoverageBayId;
  fill?: boolean;
  /** This browser's fix. Not published and not shown to anyone else. */
  own?: { lat: number; lng: number } | null;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [zones, setZones] = useState<MarineZone[] | null>(null);
  const center = COVERAGE_BAYS[bay];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMarineZones()
      .then((rows) => {
        if (!cancelled) setZones(rows);
      })
      .catch(() => {
        if (!cancelled) setZones([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pins = useMemo(
    () =>
      (zones ?? []).filter(
        (z) =>
          COVERAGE_KINDS.has(z.kind) &&
          Number.isFinite(z.lat) &&
          Number.isFinite(z.lng),
      ),
    [zones],
  );

  if (!mounted || zones === null) {
    return (
      <MapPlaceholder
        className={fill ? "min-h-0" : "min-h-0 rounded-2xl"}
        style={fill ? { height: "100%", minHeight: "100%" } : { height: 420, minHeight: 420 }}
      />
    );
  }

  return (
    <div
      className={fill ? "h-full w-full" : "overflow-hidden rounded-2xl border border-cyan-500/25"}
      style={fill ? undefined : { height: 420 }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={center.zoom}
        minZoom={4}
        maxZoom={18}
        zoomControl={!fill}
        scrollWheelZoom={fill}
        className={fill ? "thalvo-ecdis thalvo-chart-frame" : "thalvo-ecdis"}
        style={{ width: "100%", height: "100%", background: "#06101c" }}
      >
        <FitFrame />
        <TileLayer
          url={MARINE_PUBLIC_BASE_URL}
          attribution="&copy; Esri"
          minZoom={4}
          maxZoom={18}
          maxNativeZoom={MARINE_DARK_TILE_MAX_NATIVE_ZOOM}
          errorTileUrl={VOID_TILE}
          updateWhenIdle
          updateWhenZooming={false}
          keepBuffer={2}
        />
        <Seamarks />
        <GoTo
          lat={own?.lat ?? center.lat}
          lng={own?.lng ?? center.lng}
          zoom={own ? 14 : center.zoom}
        />
        {own ? (
          <CircleMarker
            center={[own.lat, own.lng]}
            radius={8}
            pathOptions={{ color: "#67e8f9", fillColor: "#67e8f9", fillOpacity: 0.95, weight: 2 }}
          >
            <Popup>
              <p className="text-sm font-semibold text-slate-900">{t("chart.locate_me")}</p>
            </Popup>
          </CircleMarker>
        ) : null}
        {pins.map((z) => (
          <CircleMarker
            key={z.id}
            center={[z.lat, z.lng]}
            radius={7}
            pathOptions={{
              color: KIND_COLOR[z.kind],
              fillColor: KIND_COLOR[z.kind],
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup>
              <p className="text-sm font-semibold text-slate-900">{z.name}</p>
              <p className="text-xs text-slate-600">{t(ZONE_KIND_LABEL_KEYS[z.kind])}</p>
              {z.depth_m != null ? (
                <p className="text-xs text-slate-600">
                  {z.depth_m} m
                </p>
              ) : null}
              {z.description ? <p className="mt-1 text-xs text-slate-700">{z.description}</p> : null}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
