/**
 * Geometry helpers for coastal sea routing — land-segment tests and
 * great-circle distance.
 *
 * Coordinates are always { lat, lng } (Leaflet / maritime DD), NEVER GeoJSON
 * [lng, lat] tuples. Mixing those axes silently breaks intersection tests.
 */

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;
const METRES_PER_NM = 1852;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function isFiniteLatLng(p: LatLng | null | undefined): p is LatLng {
  return (
    !!p &&
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
}

/** Haversine great-circle distance between two WGS84 points, in nautical miles. */
export function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (EARTH_RADIUS_M * c) / METRES_PER_NM;
}

/** Cross product of OA × OB in planar lon/lat (adequate for short Aegean legs). */
function cross(o: LatLng, a: LatLng, b: LatLng): number {
  return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
}

function onSegment(a: LatLng, b: LatLng, p: LatLng, eps = 1e-12): boolean {
  return (
    Math.min(a.lng, b.lng) - eps <= p.lng &&
    p.lng <= Math.max(a.lng, b.lng) + eps &&
    Math.min(a.lat, b.lat) - eps <= p.lat &&
    p.lat <= Math.max(a.lat, b.lat) + eps
  );
}

/** Proper or improper intersection of segment AB with CD. */
export function segmentsIntersect(a: LatLng, b: LatLng, c: LatLng, d: LatLng): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  if (Math.abs(d1) < 1e-14 && onSegment(c, d, a)) return true;
  if (Math.abs(d2) < 1e-14 && onSegment(c, d, b)) return true;
  if (Math.abs(d3) < 1e-14 && onSegment(a, b, c)) return true;
  if (Math.abs(d4) < 1e-14 && onSegment(a, b, d)) return true;
  return false;
}

/** Ray-cast point-in-polygon. Ring vertices are {lat,lng}. */
export function pointInPolygon(point: LatLng, ring: LatLng[]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i]!;
    const pj = ring[j]!;
    const denom = pj.lat - pi.lat;
    if (Math.abs(denom) < 1e-18) continue;
    const intersect =
      pi.lat > point.lat !== pj.lat > point.lat &&
      point.lng < ((pj.lng - pi.lng) * (point.lat - pi.lat)) / denom + pi.lng;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** True if AB crosses any edge of a closed land ring (ignores shared endpoints). */
export function segmentHitsRing(a: LatLng, b: LatLng, ring: LatLng[]): boolean {
  if (ring.length < 3) return false;
  for (let i = 0; i < ring.length; i++) {
    const c = ring[i]!;
    const d = ring[(i + 1) % ring.length]!;
    if (segmentsIntersect(a, b, c, d)) {
      const shareEndpoint =
        nearlyEqual(a, c) || nearlyEqual(a, d) || nearlyEqual(b, c) || nearlyEqual(b, d);
      if (!shareEndpoint) return true;
    }
  }
  return false;
}

function nearlyEqual(p: LatLng, q: LatLng, eps = 1e-7): boolean {
  return Math.abs(p.lat - q.lat) < eps && Math.abs(p.lng - q.lng) < eps;
}

function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Segment is blocked if either endpoint sits inside land, the segment
 * crosses a land ring boundary, OR any sampled interior point sits on land.
 * Midpoint sampling catches thick coastal polygons that edge-intersection
 * alone can miss with coarse rings (Fethiye–Dalaman hinterland).
 */
export function segmentCrossesLand(a: LatLng, b: LatLng, land: LatLng[][], samples = 12): boolean {
  if (!isFiniteLatLng(a) || !isFiniteLatLng(b)) return true;
  for (const ring of land) {
    if (pointInPolygon(a, ring) || pointInPolygon(b, ring)) return true;
    if (segmentHitsRing(a, b, ring)) return true;
  }
  const n = Math.max(2, samples);
  for (let i = 1; i < n; i++) {
    const p = lerp(a, b, i / n);
    for (const ring of land) {
      if (pointInPolygon(p, ring)) return true;
    }
  }
  return false;
}

/** Path length along an ordered waypoint list, nautical miles. */
export function pathLengthNm(points: LatLng[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const next = points[i]!;
    if (!isFiniteLatLng(prev) || !isFiniteLatLng(next)) continue;
    sum += haversineNm(prev.lat, prev.lng, next.lat, next.lng);
  }
  return sum;
}

/** Drop near-collinear midpoints to keep the polyline readable. */
export function simplifyPath(points: LatLng[], minNm = 0.08): LatLng[] {
  const finite = points.filter(isFiniteLatLng);
  if (finite.length <= 2) return finite;
  const out: LatLng[] = [finite[0]!];
  for (let i = 1; i < finite.length - 1; i++) {
    const prev = out[out.length - 1]!;
    const cur = finite[i]!;
    if (haversineNm(prev.lat, prev.lng, cur.lat, cur.lng) >= minNm) out.push(cur);
  }
  out.push(finite[finite.length - 1]!);
  return out;
}
