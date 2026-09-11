import { memo, useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPlaceholder } from "@/components/ClientOnly";
import { MARINE_DARK_TILE_URL, MARINE_DARK_TILE_MAX_NATIVE_ZOOM } from "@/components/LiveMap";

const focusIcon = L.divIcon({
  className: "thalvo-map-marker",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
  html: `<div class="thalvo-marker-face" style="width:36px;height:36px;border-radius:999px;display:grid;place-items:center;background:rgba(15,23,42,0.92);border:1px solid rgba(56,189,248,0.4);box-shadow:0 4px 6px -1px rgba(0,0,0,0.5)">
      <span style="width:10px;height:10px;border-radius:999px;background:#38bdf8"></span>
    </div>`,
});

interface Props {
  lat: number;
  lng: number;
  height?: number;
}

/**
 * Read-only chart preview focused on a single coordinate — used by the
 * Approval Desk so an operator can eyeball a reported position (nearby
 * hazards, depth context) before approving/rejecting, without leaving the
 * report card.
 */
export const ReportMiniMap = memo(function ReportMiniMap({ lat, lng, height = 160 }: Props) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  if (!isMounted) {
    return (
      <div className="overflow-hidden rounded-lg border border-cyan-500/25" style={{ height }}>
        <MapPlaceholder className="min-h-0" style={{ height, minHeight: height }} />
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-cyan-500/25" style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        minZoom={4}
        maxZoom={18}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={true}
        doubleClickZoom={false}
        className="thalvo-ecdis"
        fadeAnimation={false}
        zoomAnimation
        markerZoomAnimation={false}
        style={{ width: "100%", height: "100%", background: "#0b132b" }}
      >
        <TileLayer
          url={MARINE_DARK_TILE_URL}
          minZoom={4}
          maxZoom={18}
          maxNativeZoom={MARINE_DARK_TILE_MAX_NATIVE_ZOOM}
          updateWhenIdle
          keepBuffer={4}
          updateWhenZooming={false}
          errorTileUrl={
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#0b132b"/></svg>',
            )
          }
        />
        <Marker position={[lat, lng]} icon={focusIcon} />
      </MapContainer>
    </div>
  );
});
