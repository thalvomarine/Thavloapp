import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslation } from "react-i18next";
import { MapPlaceholder } from "@/components/ClientOnly";
import {
  MARINE_DARK_TILE_MAX_NATIVE_ZOOM,
  MARINE_DARK_TILE_URL,
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

function FlyTo({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 0.6 });
  }, [map, lat, lng, zoom]);
  return null;
}

export function CoverageChart({ bay }: { bay: CoverageBayId }) {
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
    return <MapPlaceholder className="min-h-0 rounded-2xl" style={{ height: 420, minHeight: 420 }} />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-cyan-500/25" style={{ height: 420 }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={center.zoom}
        minZoom={4}
        maxZoom={18}
        zoomControl
        scrollWheelZoom={false}
        className="thalvo-ecdis"
        style={{ width: "100%", height: "100%", background: "#0b132b" }}
      >
        <TileLayer
          url={MARINE_DARK_TILE_URL}
          minZoom={4}
          maxZoom={18}
          maxNativeZoom={MARINE_DARK_TILE_MAX_NATIVE_ZOOM}
          errorTileUrl={VOID_TILE}
        />
        <TileLayer url={MARINE_SEAMARK_TILE_URL} minZoom={4} maxZoom={18} opacity={0.9} errorTileUrl={CLEAR_TILE} />
        <FlyTo lat={center.lat} lng={center.lng} zoom={center.zoom} />
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
