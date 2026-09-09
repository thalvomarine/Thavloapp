import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MARINE_DARK_TILE_URL, MARINE_DARK_TILE_MAX_NATIVE_ZOOM } from "@/components/LiveMap";

const focusIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="position:relative;width:22px;height:22px">
      <span style="position:absolute;inset:0;border-radius:999px;background:#00F0FF;opacity:.3;animation:thalvoPing 1.6s ease-out infinite"></span>
      <span style="position:absolute;inset:6px;border-radius:999px;background:#00F0FF;border:2px solid #0a192f;box-shadow:0 0 8px rgba(0,240,255,0.8)"></span>
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
export function ReportMiniMap({ lat, lng, height = 160 }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-cyan-500/25" style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={true}
        doubleClickZoom={false}
        style={{ width: "100%", height: "100%", background: "#07111E" }}
      >
        <TileLayer
          url={MARINE_DARK_TILE_URL}
          maxZoom={20}
          maxNativeZoom={MARINE_DARK_TILE_MAX_NATIVE_ZOOM}
        />
        <Marker position={[lat, lng]} icon={focusIcon} />
      </MapContainer>
    </div>
  );
}
