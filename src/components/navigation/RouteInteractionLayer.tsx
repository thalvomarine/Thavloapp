/**
 * Interactive sea-route overlay: cyan polyline, draggable pins, mid-leg + handles.
 */

import { memo, useMemo } from "react";
import { Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import { isFiniteLatLng, type LatLng } from "@/lib/sea-route/geometry";

export type RoutePinRole = "start" | "via" | "end";

type Props = {
  waypoints: LatLng[];
  /** Editable pins: [origin, ...vias, destination] — not every mesh node. */
  pins: LatLng[];
  locked: boolean;
  active: boolean;
  onWaypointDragEnd: (index: number, latlng: LatLng) => void;
  onInsertVia: (afterLegIndex: number, latlng: LatLng) => void;
  onRemovePin: (index: number) => void;
};

function pinIcon(role: RoutePinRole, locked: boolean): L.DivIcon {
  const color = role === "end" ? "#FF3B56" : role === "start" ? "#34d399" : "#00F2FE";
  const size = role === "via" ? 14 : 18;
  const cursor = locked ? "default" : "grab";
  return L.divIcon({
    className: "thalvo-route-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:2px solid #0B1528;box-shadow:0 0 10px ${color}88;cursor:${cursor}"></div>`,
  });
}

function midIcon(): L.DivIcon {
  return L.divIcon({
    className: "thalvo-route-mid",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<div style="width:22px;height:22px;border-radius:999px;display:grid;place-items:center;background:rgba(11,21,40,0.75);border:1px solid rgba(0,242,254,0.45);color:#00F2FE;font-size:14px;font-weight:700;line-height:1;cursor:grab;opacity:0.85">+</div>`,
  });
}

function roleForIndex(i: number, n: number): RoutePinRole {
  if (i === 0) return "start";
  if (i === n - 1) return "end";
  return "via";
}

export const RouteInteractionLayer = memo(function RouteInteractionLayer({
  waypoints,
  pins,
  locked,
  active,
  onWaypointDragEnd,
  onInsertVia,
  onRemovePin,
}: Props) {
  const { t } = useTranslation();

  const line = useMemo(
    () =>
      waypoints
        .filter(isFiniteLatLng)
        .map((p) => [p.lat, p.lng] as [number, number]),
    [waypoints],
  );

  const safePins = useMemo(() => pins.filter(isFiniteLatLng), [pins]);

  const mids = useMemo(() => {
    if (locked || safePins.length < 2) return [];
    const out: Array<{ after: number; lat: number; lng: number }> = [];
    for (let i = 0; i < safePins.length - 1; i++) {
      const a = safePins[i]!;
      const b = safePins[i + 1]!;
      out.push({
        after: i,
        lat: (a.lat + b.lat) / 2,
        lng: (a.lng + b.lng) / 2,
      });
    }
    return out;
  }, [locked, safePins]);

  if (line.length < 2) return null;

  return (
    <>
      <Polyline
        positions={line}
        pathOptions={{
          color: "#00F2FE",
          weight: active ? 4 : 3,
          opacity: active ? 1 : 0.9,
          dashArray: active ? undefined : "2 8",
          lineCap: "round",
          lineJoin: "round",
          className: active ? "thalvo-route-active" : undefined,
        }}
      />

      {!locked &&
        mids.map((m) => (
          <Marker
            key={`mid-${m.after}-${m.lat.toFixed(4)}-${m.lng.toFixed(4)}`}
            position={[m.lat, m.lng]}
            icon={midIcon()}
            draggable
            zIndexOffset={400}
            eventHandlers={{
              dragend: (e) => {
                const ll = e.target.getLatLng();
                if (!Number.isFinite(ll.lat) || !Number.isFinite(ll.lng)) return;
                onInsertVia(m.after, { lat: ll.lat, lng: ll.lng });
              },
            }}
          />
        ))}

      {safePins.map((p, i) => {
        const role = roleForIndex(i, safePins.length);
        const canDelete = role === "via" || role === "end" || role === "start";
        return (
          <Marker
            key={`pin-${role}-${i}-${p.lat.toFixed(4)}-${p.lng.toFixed(4)}`}
            position={[p.lat, p.lng]}
            icon={pinIcon(role, locked)}
            draggable={!locked}
            zIndexOffset={500}
            eventHandlers={{
              dragend: (e) => {
                if (locked) return;
                const ll = e.target.getLatLng();
                if (!Number.isFinite(ll.lat) || !Number.isFinite(ll.lng)) return;
                onWaypointDragEnd(i, { lat: ll.lat, lng: ll.lng });
              },
            }}
          >
            {!locked && canDelete && (
              <Popup>
                <button
                  type="button"
                  className="rounded border border-rose-400/40 bg-[#0B1528] px-2 py-1 text-[11px] font-semibold text-rose-200"
                  onClick={() => onRemovePin(i)}
                >
                  {t("chart.route_deck_remove_point")}
                </button>
              </Popup>
            )}
          </Marker>
        );
      })}
    </>
  );
});
