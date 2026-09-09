/**
 * Great-circle distance + ETA helpers for the live dispatch route line.
 * Pure functions, no I/O — the caller supplies validated coordinates.
 */

const EARTH_RADIUS_M = 6_371_000;
const METRES_PER_NM = 1852;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine great-circle distance between two WGS84 points, in nautical miles. */
export function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const metres = EARTH_RADIUS_M * c;
  return metres / METRES_PER_NM;
}

/** Default cruise speed assumed for a dispatched response boat, in knots. */
export const DEFAULT_RESPONSE_SPEED_KTS = 22;

/** Average service-boat speed for the emergency call network (user spec). */
export const DEFAULT_SERVICE_BOAT_KTS = 18;

export interface MarineEta {
  distanceNm: number;
  etaMinutes: number | null;
  /** "1.8 NM • ~11 dk" */
  label: string;
}

/**
 * Great-circle range in nautical miles and transit time at `avgSpeedKnots`.
 * Label is cockpit-ready: distance NM + minutes.
 */
export function calculateMarineEta(
  userCoords: { lat: number; lng: number },
  providerCoords: { lat: number; lng: number },
  avgSpeedKnots = DEFAULT_SERVICE_BOAT_KTS,
): MarineEta {
  const distanceNm = haversineNm(
    providerCoords.lat,
    providerCoords.lng,
    userCoords.lat,
    userCoords.lng,
  );
  const minutes = etaMinutes(distanceNm, avgSpeedKnots);
  const etaLabel = minutes == null ? "—" : `~${Math.max(1, Math.round(minutes))} dk`;
  return {
    distanceNm,
    etaMinutes: minutes,
    label: `${distanceNm.toFixed(1)} NM • ${etaLabel}`,
  };
}

/** Minutes to cover `distanceNm` at `speedKts`. Returns null for a stalled (0 kt) boat. */
export function etaMinutes(distanceNm: number, speedKts: number): number | null {
  if (!Number.isFinite(distanceNm) || !Number.isFinite(speedKts) || speedKts <= 0) return null;
  return (distanceNm / speedKts) * 60;
}

export interface RouteEta {
  distanceNm: number;
  speedKts: number;
  etaMinutes: number | null;
}

export function computeRouteEta(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  speedKts: number = DEFAULT_RESPONSE_SPEED_KTS,
): RouteEta {
  const distanceNm = haversineNm(from.lat, from.lng, to.lat, to.lng);
  return { distanceNm, speedKts, etaMinutes: etaMinutes(distanceNm, speedKts) };
}

/**
 * "Mesafe: 3.4 NM | Hız: 22 kts | ETA: 9 dk" — monospaced dispatch readout.
 * `distanceLabel`/`speedLabel` are injected by the caller so the string
 * stays translatable without this pure lib depending on i18next.
 */
export function formatRouteEta(
  eta: RouteEta,
  distanceLabel = "Mesafe",
  speedLabel = "Hız",
): string {
  const distance = `${distanceLabel}: ${eta.distanceNm.toFixed(1)} NM`;
  const speed = `${speedLabel}: ${Math.round(eta.speedKts)} kts`;
  const etaPart = `ETA: ${eta.etaMinutes == null ? "—" : `${Math.round(eta.etaMinutes)} dk`}`;
  return `${distance} | ${speed} | ${etaPart}`;
}
