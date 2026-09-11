/**
 * Navigable waypoint mesh for the Turkish SW Aegean theatre.
 * Grid nodes sit in open water; curated channel nodes cover narrow
 * Göcek / Hisarönü corridors the grid may undersample.
 */

import { pointInPolygon, type LatLng } from "./geometry.ts";
import { AEGEAN_LAND_MASKS } from "./land-masks.ts";

const BOUNDS = {
  minLat: 36.55,
  maxLat: 37.12,
  minLng: 27.2,
  maxLng: 29.35,
};

/** ~2.0–2.2 NM grid step — dense enough for bay routing, light enough for WebView. */
const GRID_STEP = 0.032;

/** Hand-placed corridor nodes (passes, bay mouths, fairways). */
const CHANNEL_NODES: LatLng[] = [
  // Göcek approaches
  { lat: 36.7525, lng: 28.9428 },
  { lat: 36.745, lng: 28.935 },
  { lat: 36.738, lng: 28.925 },
  { lat: 36.73, lng: 28.915 },
  { lat: 36.72, lng: 28.905 },
  { lat: 36.71, lng: 28.895 },
  { lat: 36.7, lng: 28.885 },
  { lat: 36.69, lng: 28.875 },
  { lat: 36.68, lng: 28.865 },
  { lat: 36.67, lng: 28.855 },
  { lat: 36.66, lng: 28.845 },
  // West of Tersane / Domuz fairway
  { lat: 36.695, lng: 28.895 },
  { lat: 36.685, lng: 28.885 },
  { lat: 36.675, lng: 28.875 },
  { lat: 36.665, lng: 28.865 },
  // East Göcek bays corridor
  { lat: 36.735, lng: 28.955 },
  { lat: 36.725, lng: 28.965 },
  { lat: 36.715, lng: 28.975 },
  { lat: 36.705, lng: 28.985 },
  { lat: 36.695, lng: 28.995 },
  // Fethiye bay mouth
  { lat: 36.645, lng: 29.1 },
  { lat: 36.635, lng: 29.08 },
  { lat: 36.625, lng: 29.05 },
  // Marmaris approaches
  { lat: 36.84, lng: 28.28 },
  { lat: 36.83, lng: 28.3 },
  { lat: 36.82, lng: 28.25 },
  { lat: 36.81, lng: 28.22 },
  { lat: 36.8, lng: 28.32 },
  // Bozburun fairway
  { lat: 36.69, lng: 28.05 },
  { lat: 36.68, lng: 28.08 },
  { lat: 36.67, lng: 28.12 },
  { lat: 36.66, lng: 28.16 },
  // South of Datça open-water transit (Göcek ↔ Marmaris / Bodrum)
  { lat: 36.62, lng: 28.4 },
  { lat: 36.6, lng: 28.2 },
  { lat: 36.58, lng: 28.0 },
  { lat: 36.58, lng: 27.8 },
  { lat: 36.6, lng: 27.6 },
  { lat: 36.62, lng: 27.45 },
  // Bodrum gulf
  { lat: 37.03, lng: 27.43 },
  { lat: 37.02, lng: 27.48 },
  { lat: 37.0, lng: 27.42 },
  { lat: 36.99, lng: 27.5 },
  { lat: 36.98, lng: 27.55 },
];

function isOnLand(p: LatLng): boolean {
  return AEGEAN_LAND_MASKS.some((ring) => pointInPolygon(p, ring));
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

/** All navigable mesh nodes (grid + channel). Built once per session. */
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
  for (const p of CHANNEL_NODES) push(p);
  cached = out;
  return out;
}

/** @internal test helper */
export function __resetSeaWaypointsCache() {
  cached = null;
}
