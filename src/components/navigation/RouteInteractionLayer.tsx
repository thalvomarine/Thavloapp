/**
 * Interactive sea-route overlay: cyan polyline, large-hitbox pins, mid-leg + handles.
 * Hitboxes are ≥44×44 for mobile; map.dragging locks while a pin/mid is dragged.
 */

import { memo, useMemo } from "react";
import { Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import { isFiniteLatLng, type LatLng } from "@/lib/sea-route/geometry";

export type RoutePinRole = "start" | "via" | "end";

const HIT = 44;
const HIT_ANCHOR = HIT / 2;

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

/** Transparent 44×44 hitbox wrapping a centered visual core. */
function hitboxHtml(inner: string, extraClass = ""): string {
  return `<div class="thalvo-route-hit ${extraClass}" style="width:${HIT}px;height:${HIT}px;display:grid;place-items:center;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none">${inner}</div>`;
}

function pinIcon(role: RoutePinRole, locked: boolean): L.DivIcon {
  const grab = locked ? "default" : "grab";
  let core: string;
  if (role === "start") {
    core = `<span class="thalvo-route-pin-core thalvo-route-pin-start" style="cursor:${grab}" aria-hidden="true"></span>`;
  } else if (role === "end") {
    core = `<span class="thalvo-route-pin-core thalvo-route-pin-end" style="cursor:${grab}" aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F5C542" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="5" r="2.5" fill="#00F2FE" stroke="#00F2FE"/>
        <path d="M12 7.5v6"/>
        <path d="M8 11h8"/>
        <path d="M10 13.5c0 2.2 2 4.5 2 4.5s2-2.3 2-4.5"/>
      </svg>
    </span>`;
  } else {
    core = `<span class="thalvo-route-pin-core thalvo-route-pin-via" style="cursor:${grab}" aria-hidden="true"></span>`;
  }
  return L.divIcon({
    className: `thalvo-route-pin thalvo-route-pin--${role}${locked ? " is-locked" : ""}`,
    iconSize: [HIT, HIT],
    iconAnchor: [HIT_ANCHOR, HIT_ANCHOR],
    html: hitboxHtml(core, locked ? "is-locked" : ""),
  });
}

function midIcon(dragging = false): L.DivIcon {
  const core = dragging
    ? `<span class="thalvo-route-pin-core thalvo-route-pin-via is-dragging" aria-hidden="true"></span>`
    : `<span class="thalvo-route-mid-core" aria-hidden="true"><span class="thalvo-route-mid-plus">+</span></span>`;
  return L.divIcon({
    className: `thalvo-route-mid${dragging ? " is-dragging" : ""}`,
    iconSize: [HIT, HIT],
    iconAnchor: [HIT_ANCHOR, HIT_ANCHOR],
    html: hitboxHtml(core, dragging ? "is-dragging" : ""),
  });
}

function roleForIndex(i: number, n: number): RoutePinRole {
  if (i === 0) return "start";
  if (i === n - 1) return "end";
  return "via";
}

function useMapDragLock() {
  const map = useMap();
  return {
    onDragStart: () => {
      try {
        map.dragging.disable();
      } catch {
        /* map may be tearing down */
      }
    },
    onDragEnd: () => {
      try {
        map.dragging.enable();
      } catch {
        /* map may be tearing down */
      }
    },
  };
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
  const dragLock = useMapDragLock();

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
            icon={midIcon(false)}
            draggable
            zIndexOffset={400}
            eventHandlers={{
              dragstart: (e) => {
                dragLock.onDragStart();
                try {
                  e.target.setIcon(midIcon(true));
                } catch {
                  /* ignore icon swap failures */
                }
              },
              dragend: (e) => {
                dragLock.onDragEnd();
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
              dragstart: () => {
                if (locked) return;
                dragLock.onDragStart();
              },
              drag: (e) => {
                if (locked || role !== "via") return;
                const el = e.target.getElement() as HTMLElement | null;
                el?.classList.add("is-dragging");
              },
              dragend: (e) => {
                if (locked) return;
                dragLock.onDragEnd();
                const el = e.target.getElement() as HTMLElement | null;
                el?.classList.remove("is-dragging");
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
