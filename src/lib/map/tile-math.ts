/**
 * Pure Web-Mercator helpers for offline tile prefetch (no Leaflet dependency).
 */

export const TILE_CACHE_NAME = "maptiles-v1";

/** Göcek – Fethiye – Bozburun operating theatre (south-west Turkish Aegean). */
export const AEGEAN_OFFLINE_BOUNDS = {
  south: 36.55,
  west: 27.9,
  north: 36.95,
  east: 29.25,
} as const;

export type TileBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

/** Web-Mercator tile index for a WGS84 point. */
export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  };
}

export function countTilesForArea(
  bounds: TileBounds,
  minZoom: number,
  maxZoom: number,
): number {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const sw = latLngToTile(bounds.south, bounds.west, z);
    const ne = latLngToTile(bounds.north, bounds.east, z);
    const x0 = Math.min(sw.x, ne.x);
    const x1 = Math.max(sw.x, ne.x);
    const y0 = Math.min(sw.y, ne.y);
    const y1 = Math.max(sw.y, ne.y);
    total += (x1 - x0 + 1) * (y1 - y0 + 1);
  }
  return total;
}

export function tileTemplateUrl(template: string, z: number, x: number, y: number): string {
  return template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}
