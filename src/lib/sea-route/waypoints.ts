/**
 * Navigable waypoint mesh for the Turkish SW Aegean theatre.
 * Sparse grid + curated fairway / corridor nodes — sized for mobile WebView memory.
 */

import { ALL_CORRIDOR_NODES } from "./corridors.ts";
import { pointInPolygon, type LatLng } from "./geometry.ts";
import { AEGEAN_LAND_MASKS_BUFFERED } from "./land-masks.ts";

const BOUNDS = {
  minLat: 36.55,
  maxLat: 37.12,
  minLng: 27.2,
  maxLng: 29.35,
};

/** ~3.5 NM step — keeps node count low enough for Capacitor WebViews. */
const GRID_STEP = 0.055;

function isOnLand(p: LatLng): boolean {
  return AEGEAN_LAND_MASKS_BUFFERED.some((ring) => pointInPolygon(p, ring));
}

function buildGrid(): LatLng[] {
  const nodes: LatLng[] = [];
  for (let lat = BOUNDS.minLat; lat <= BOUNDS.maxLat; lat += GRID_STEP) {
    for (let lng = BOUNDS.minLng; lng <= BOUNDS.maxLng; lng += GRID_STEP) {
      const p = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
      if (!isOnLand(p)) nodes.push(p);
    }
  }
  return nodes;
}

let cached: LatLng[] | null = null;

/** All navigable mesh nodes (grid + corridors). Built once per session. */
export function getSeaWaypoints(): LatLng[] {
  if (cached) return cached;
  const seen = new Set<string>();
  const out: LatLng[] = [];
  const push = (p: LatLng) => {
    if (isOnLand(p)) return;
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };
  for (const p of buildGrid()) push(p);
  for (const p of ALL_CORRIDOR_NODES) push(p);
  cached = out;
  return out;
}

/** @internal test helper */
export function __resetSeaWaypointsCache() {
  cached = null;
}
