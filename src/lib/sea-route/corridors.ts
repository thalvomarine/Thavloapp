/**
 * Hand-curated fairway / channel nodes for precision Aegean routing.
 * Keep dense where land squeezes the track (Göcek, Fethiye, Bozburun).
 */

import type { LatLng } from "./geometry.ts";

/** Fethiye approaches + Kızılada / Ölüdeniz outer track. */
export const FETHIYE_KIZILADA: LatLng[] = [
  { lat: 36.645, lng: 29.1 },
  { lat: 36.635, lng: 29.08 },
  { lat: 36.625, lng: 29.05 },
  { lat: 36.62, lng: 28.98 },
  { lat: 36.615, lng: 28.94 },
  { lat: 36.61, lng: 28.9 },
  { lat: 36.605, lng: 28.86 },
  { lat: 36.62, lng: 28.92 },
  { lat: 36.63, lng: 28.96 },
];

/** Göcek bay fairways — keep clear of Tersane / Domuz / Yassıca. */
export const GOCEK_FAIRWAYS: LatLng[] = [
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
  { lat: 36.695, lng: 28.895 },
  { lat: 36.685, lng: 28.885 },
  { lat: 36.675, lng: 28.875 },
  { lat: 36.665, lng: 28.865 },
  { lat: 36.735, lng: 28.955 },
  { lat: 36.725, lng: 28.965 },
  { lat: 36.715, lng: 28.975 },
  { lat: 36.705, lng: 28.985 },
  { lat: 36.695, lng: 28.995 },
];

/**
 * Kurdoğlu / Sarsala approaches — prefer ≥0.8 NM offshore track
 * (nodes sit seaward of the headland).
 */
export const KURDOGLU_OFFSHORE: LatLng[] = [
  { lat: 36.655, lng: 28.82 },
  { lat: 36.645, lng: 28.8 },
  { lat: 36.635, lng: 28.78 },
  { lat: 36.625, lng: 28.76 },
  { lat: 36.615, lng: 28.74 },
  { lat: 36.605, lng: 28.72 },
];

/** Bozburun / Hisarönü approaches. */
export const BOZBURUN: LatLng[] = [
  { lat: 36.69, lng: 28.05 },
  { lat: 36.68, lng: 28.08 },
  { lat: 36.67, lng: 28.12 },
  { lat: 36.66, lng: 28.16 },
  { lat: 36.65, lng: 28.2 },
  { lat: 36.64, lng: 28.24 },
];

/** Datça south coast — keep routes south of the peninsula spine. */
export const DATCA_SOUTH: LatLng[] = [
  { lat: 36.62, lng: 28.4 },
  { lat: 36.6, lng: 28.2 },
  { lat: 36.58, lng: 28.0 },
  { lat: 36.58, lng: 27.8 },
  { lat: 36.6, lng: 27.6 },
  { lat: 36.62, lng: 27.45 },
  { lat: 36.61, lng: 27.7 },
  { lat: 36.59, lng: 27.9 },
];

/** Simi / Rhodes channel gates (international waters track). */
export const SIMI_RHODES_GATES: LatLng[] = [
  { lat: 36.58, lng: 27.95 },
  { lat: 36.56, lng: 27.85 },
  { lat: 36.55, lng: 27.75 },
  { lat: 36.57, lng: 27.65 },
  { lat: 36.6, lng: 27.55 },
];

/** Marmaris approaches. */
export const MARMARIS: LatLng[] = [
  { lat: 36.84, lng: 28.28 },
  { lat: 36.83, lng: 28.3 },
  { lat: 36.82, lng: 28.25 },
  { lat: 36.81, lng: 28.22 },
  { lat: 36.8, lng: 28.32 },
];

/** Bodrum approaches. */
export const BODRUM: LatLng[] = [
  { lat: 37.03, lng: 27.43 },
  { lat: 37.02, lng: 27.48 },
  { lat: 37.0, lng: 27.42 },
  { lat: 36.99, lng: 27.5 },
  { lat: 36.98, lng: 27.55 },
];

/** All curated corridor nodes (dedupe happens in waypoints). */
export const ALL_CORRIDOR_NODES: LatLng[] = [
  ...FETHIYE_KIZILADA,
  ...GOCEK_FAIRWAYS,
  ...KURDOGLU_OFFSHORE,
  ...BOZBURUN,
  ...DATCA_SOUTH,
  ...SIMI_RHODES_GATES,
  ...MARMARIS,
  ...BODRUM,
];
