/** Great-circle distance in nautical miles. */
export function distanceNm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number | null {
  if (![aLat, aLng, bLat, bLng].every((n) => Number.isFinite(n))) return null;
  if (Math.abs(aLat) > 90 || Math.abs(bLat) > 90) return null;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  const km = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
  return km * 0.5399568;
}

/** Minutes to cover `nm` at `speedKts`. Null when the boat is not making way. */
export function etaMinutes(nm: number, speedKts: number): number | null {
  if (!Number.isFinite(nm) || nm < 0) return null;
  if (!Number.isFinite(speedKts) || speedKts < 0.4) return null;
  return Math.max(1, Math.round((nm / speedKts) * 60));
}

/** Geolocation speed is metres per second. */
export function knotsFromMps(mps: number | null | undefined): number | null {
  if (mps == null || !Number.isFinite(mps) || mps < 0.3) return null;
  return Math.min(40, mps * 1.943844);
}
