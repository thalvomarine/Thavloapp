import type { Map as LeafletMap } from "leaflet";

type RotatableMap = LeafletMap & {
  getBearing?: () => number;
  setBearing?: (bearing: number) => void;
};

function normalizeBearing(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function getMapBearing(map: LeafletMap): number {
  return normalizeBearing((map as RotatableMap).getBearing?.() ?? 0);
}

export function isMapNorthUp(map: LeafletMap, epsilon = 0.8): boolean {
  const b = getMapBearing(map);
  return b < epsilon || b > 360 - epsilon;
}

/**
 * ECDIS “north-up”: ease bearing and pitch back to 0.
 * Uses Leaflet-rotate `setBearing` when present; otherwise recentres the view
 * so the control still produces a visible camera settle.
 */
export function easeMapToNorth(map: LeafletMap, duration = 800): boolean {
  const rotatable = map as RotatableMap;
  const alreadyNorth = isMapNorthUp(map);

  if (alreadyNorth) {
    map.setView(map.getCenter(), map.getZoom(), { animate: true, duration: duration / 1000 });
    return true;
  }

  if (typeof rotatable.getBearing === "function" && typeof rotatable.setBearing === "function") {
    const start = getMapBearing(map);
    const from = start > 180 ? start - 360 : start;
    const origin = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - origin) / duration);
      const eased = 1 - (1 - t) ** 3;
      rotatable.setBearing?.(from * (1 - eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return false;
  }

  map.setView(map.getCenter(), map.getZoom(), { animate: true, duration: duration / 1000 });
  return alreadyNorth;
}
