/**
 * Simplified land masks for Thalvo's operating theatre
 * (Bodrum → Datça → Bozburun → Marmaris → Göcek / Fethiye / Dalaman).
 *
 * Rings are WGS84 { lat, lng } — Leaflet order, NOT GeoJSON [lng, lat].
 * Slightly oversized so A* prefers open-water corridors.
 */

import { expandRing, type LatLng } from "./geometry.ts";

/** Coastal safety buffer (~250 m ≈ 0.135 NM). */
export const LAND_BUFFER_METERS = 250;

/** Island / peninsula / coastal hinterland rings. */
export const AEGEAN_LAND_MASKS: LatLng[][] = [
  // —— Göcek gulf islands ——
  [
    { lat: 36.743, lng: 28.928 },
    { lat: 36.747, lng: 28.93 },
    { lat: 36.7485, lng: 28.936 },
    { lat: 36.746, lng: 28.941 },
    { lat: 36.742, lng: 28.939 },
    { lat: 36.741, lng: 28.932 },
  ],
  [
    { lat: 36.678, lng: 28.905 },
    { lat: 36.686, lng: 28.908 },
    { lat: 36.692, lng: 28.918 },
    { lat: 36.688, lng: 28.928 },
    { lat: 36.678, lng: 28.926 },
    { lat: 36.674, lng: 28.914 },
  ],
  [
    { lat: 36.638, lng: 28.868 },
    { lat: 36.648, lng: 28.872 },
    { lat: 36.652, lng: 28.884 },
    { lat: 36.646, lng: 28.892 },
    { lat: 36.636, lng: 28.888 },
    { lat: 36.634, lng: 28.876 },
  ],
  [
    { lat: 36.702, lng: 28.918 },
    { lat: 36.71, lng: 28.922 },
    { lat: 36.712, lng: 28.932 },
    { lat: 36.706, lng: 28.938 },
    { lat: 36.698, lng: 28.934 },
    { lat: 36.697, lng: 28.924 },
  ],
  [
    { lat: 36.682, lng: 28.952 },
    { lat: 36.688, lng: 28.956 },
    { lat: 36.69, lng: 28.966 },
    { lat: 36.684, lng: 28.97 },
    { lat: 36.678, lng: 28.962 },
  ],
  [
    { lat: 36.712, lng: 28.962 },
    { lat: 36.72, lng: 28.966 },
    { lat: 36.722, lng: 28.976 },
    { lat: 36.714, lng: 28.98 },
    { lat: 36.708, lng: 28.972 },
  ],

  // —— Şövalye (Fethiye) ——
  [
    { lat: 36.648, lng: 29.088 },
    { lat: 36.656, lng: 29.092 },
    { lat: 36.658, lng: 29.104 },
    { lat: 36.65, lng: 29.108 },
    { lat: 36.644, lng: 29.098 },
  ],

  // —— Fethiye – Dalaman – Köyceğiz coastal land ——
  // Stays NORTH of Göcek gulf water so marina/fairway nodes remain navigable.
  [
    { lat: 36.78, lng: 28.78 },
    { lat: 36.84, lng: 28.68 },
    { lat: 36.92, lng: 28.78 },
    { lat: 36.94, lng: 28.95 },
    { lat: 36.9, lng: 29.15 },
    { lat: 36.82, lng: 29.18 },
    { lat: 36.78, lng: 29.02 },
  ],
  // Eastern Fethiye hinterland (bay → Dalaman road corridor)
  [
    { lat: 36.66, lng: 29.12 },
    { lat: 36.72, lng: 29.08 },
    { lat: 36.78, lng: 29.12 },
    { lat: 36.78, lng: 29.25 },
    { lat: 36.7, lng: 29.28 },
    { lat: 36.64, lng: 29.2 },
  ],

  // —— Sedir (Cleopatra) island, Marmaris ——
  [
    { lat: 36.772, lng: 28.192 },
    { lat: 36.78, lng: 28.196 },
    { lat: 36.782, lng: 28.208 },
    { lat: 36.774, lng: 28.212 },
    { lat: 36.768, lng: 28.202 },
  ],

  // —— Datça peninsula ——
  [
    { lat: 36.72, lng: 27.55 },
    { lat: 36.8, lng: 27.65 },
    { lat: 36.82, lng: 27.85 },
    { lat: 36.78, lng: 28.05 },
    { lat: 36.72, lng: 28.15 },
    { lat: 36.68, lng: 28.05 },
    { lat: 36.66, lng: 27.85 },
    { lat: 36.68, lng: 27.65 },
  ],

  // —— Bozburun / Hisarönü peninsula mass (mountains + villages) ——
  // Covers the land that a Göcek↔Bozburun straight line would cut through.
  // Leaves a southern sea approach to Bozburun Limanı (~36.690 / 28.043) open.
  [
    { lat: 36.62, lng: 27.95 },
    { lat: 36.68, lng: 27.92 },
    { lat: 36.74, lng: 27.98 },
    { lat: 36.78, lng: 28.05 },
    { lat: 36.8, lng: 28.18 },
    { lat: 36.78, lng: 28.28 },
    { lat: 36.74, lng: 28.3 },
    { lat: 36.7, lng: 28.26 },
    { lat: 36.695, lng: 28.18 },
    { lat: 36.7, lng: 28.1 },
    { lat: 36.71, lng: 28.05 },
    { lat: 36.7, lng: 28.0 },
    { lat: 36.68, lng: 27.98 },
    { lat: 36.65, lng: 28.0 },
    { lat: 36.63, lng: 28.05 },
  ],
  // Inner Hisarönü / Selimiye neck
  [
    { lat: 36.7, lng: 28.12 },
    { lat: 36.74, lng: 28.14 },
    { lat: 36.76, lng: 28.22 },
    { lat: 36.73, lng: 28.28 },
    { lat: 36.69, lng: 28.24 },
    { lat: 36.68, lng: 28.16 },
  ],

  // —— Mainland hinterland (north of the charted coast) ——
  [
    { lat: 36.88, lng: 27.2 },
    { lat: 37.2, lng: 27.3 },
    { lat: 37.25, lng: 28.0 },
    { lat: 37.15, lng: 28.6 },
    { lat: 37.05, lng: 29.2 },
    { lat: 36.95, lng: 29.4 },
    { lat: 36.88, lng: 29.35 },
    { lat: 36.9, lng: 28.9 },
    { lat: 36.92, lng: 28.5 },
    { lat: 36.95, lng: 28.0 },
    { lat: 36.92, lng: 27.5 },
  ],

  // —— Bodrum peninsula inland ——
  [
    { lat: 37.0, lng: 27.25 },
    { lat: 37.08, lng: 27.3 },
    { lat: 37.1, lng: 27.55 },
    { lat: 37.05, lng: 27.65 },
    { lat: 36.98, lng: 27.55 },
    { lat: 36.96, lng: 27.35 },
  ],

  // —— Karaada (Bodrum) ——
  [
    { lat: 36.968, lng: 27.428 },
    { lat: 36.976, lng: 27.432 },
    { lat: 36.978, lng: 27.445 },
    { lat: 36.97, lng: 27.45 },
    { lat: 36.964, lng: 27.438 },
  ],
];

/** Land masks inflated by LAND_BUFFER_METERS for routing / LOS checks. */
export const AEGEAN_LAND_MASKS_BUFFERED: LatLng[][] = AEGEAN_LAND_MASKS.map((ring) =>
  expandRing(ring, LAND_BUFFER_METERS),
);
