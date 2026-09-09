/**
 * THALVO shared marine helpers — M6 Architecture Freeze.
 *
 * Small pure helpers used across mission / marketplace / passport panels.
 * Kept intentionally dependency-free so any panel can import safely.
 */

import type { StatusTone } from "@/types/marine";

/** Haversine distance in km between two lat/lng pairs. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rough surface-vessel ETA at ~18 knots (33 km/h). Returns minutes. */
export function estimateEtaMinutes(distanceKm: number, knots = 18): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  const kmh = knots * 1.852;
  return Math.round((distanceKm / kmh) * 60);
}

/** Map an arbitrary domain status string to the shared tone vocabulary. */
export function toneForStatus(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  const s = status.toLowerCase();
  if (/(sos|dispute|cancel|refund|risk|blocked)/.test(s)) return "danger";
  if (/(pending|review|draft|submitted|held|awaiting|low)/.test(s)) return "warning";
  if (/(active|progress|preparing|matching|confirmed|out.?for)/.test(s)) return "info";
  if (/(complete|delivered|released|reliable|available|paid)/.test(s)) return "success";
  return "neutral";
}
