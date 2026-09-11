/**
 * Douglas–Peucker style simplification that refuses to cut corners across land.
 */

import {
  haversineNm,
  isFiniteLatLng,
  segmentCrossesLand,
  type LatLng,
} from "./geometry.ts";

function perpendicularDistanceNm(p: LatLng, a: LatLng, b: LatLng): number {
  const ab = haversineNm(a.lat, a.lng, b.lat, b.lng);
  if (ab < 1e-9) return haversineNm(p.lat, p.lng, a.lat, a.lng);
  // Planar approx in NM using mid-lat scale
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const kx = 60 * Math.cos(midLat); // NM per deg lng
  const ky = 60; // NM per deg lat
  const ax = a.lng * kx;
  const ay = a.lat * ky;
  const bx = b.lng * kx;
  const by = b.lat * ky;
  const px = p.lng * kx;
  const py = p.lat * ky;
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby + 1e-12)));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Simplify a sea path. A candidate shortcut A→B is kept only if the segment
 * does not cross land masks (LOS check).
 */
export function simplifySeaRoute(
  points: LatLng[],
  land: LatLng[][],
  epsilonNm = 0.12,
): LatLng[] {
  const pts = points.filter(isFiniteLatLng);
  if (pts.length <= 2) return pts;

  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    if (end - start < 2) continue;
    let maxDist = 0;
    let maxIdx = -1;
    const a = pts[start]!;
    const b = pts[end]!;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistanceNm(pts[i]!, a, b);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    const shortcutClear = !segmentCrossesLand(a, b, land, 10);
    if (maxDist > epsilonNm || !shortcutClear) {
      if (maxIdx < 0) continue;
      keep[maxIdx] = 1;
      stack.push([start, maxIdx], [maxIdx, end]);
    }
  }

  const out: LatLng[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (keep[i]) out.push(pts[i]!);
  }

  // Final LOS pass: ensure consecutive kept points never cross land
  const indexOf = (p: LatLng) =>
    pts.findIndex((q) => Math.abs(q.lat - p.lat) < 1e-9 && Math.abs(q.lng - p.lng) < 1e-9);
  const safe: LatLng[] = [out[0]!];
  for (let i = 1; i < out.length; i++) {
    const prev = safe[safe.length - 1]!;
    const cur = out[i]!;
    if (segmentCrossesLand(prev, cur, land, 10)) {
      const iPrev = indexOf(prev);
      const iCur = indexOf(cur);
      if (iPrev >= 0 && iCur > iPrev + 1) {
        for (let j = iPrev + 1; j < iCur; j++) {
          const mid = pts[j]!;
          if (!safe.some((s) => Math.abs(s.lat - mid.lat) < 1e-9 && Math.abs(s.lng - mid.lng) < 1e-9)) {
            safe.push(mid);
          }
        }
      }
      // If still blocked after densify, keep original denser chain — fall back to all pts
      const last = safe[safe.length - 1]!;
      if (segmentCrossesLand(last, cur, land, 10)) {
        return pts;
      }
    }
    safe.push(cur);
  }
  return safe;
}
