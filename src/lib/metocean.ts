import type { ChartRegion } from "@/components/map/ChartHud";
import { haversineNm } from "@/lib/geo-eta";

/**
 * Metocean (weather + sea state) snapshot for the HUD widget.
 *
 * Source: Open-Meteo — genuinely keyless (no signup, no token), same policy
 * as the Esri basemap swap. Wind + pressure come from the general forecast
 * endpoint, wave height from the separate marine endpoint; the marine call
 * is best-effort and allowed to fail independently (coastal cells without
 * wave data shouldn't blank out the wind reading).
 */
export interface MetoceanSnapshot {
  windSpeedKts: number;
  /** Meteorological convention: direction the wind is blowing FROM. */
  windDirectionDeg: number;
  waveHeightM: number | null;
  pressureHpa: number;
  capturedAt: number;
}

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";

export async function fetchMetocean(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<MetoceanSnapshot> {
  const forecastUrl =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lng}` +
    `&current=wind_speed_10m,wind_direction_10m,surface_pressure&wind_speed_unit=kn`;
  const marineUrl = `${MARINE_URL}?latitude=${lat}&longitude=${lng}&current=wave_height`;

  const weatherRes = await fetch(forecastUrl, { signal });
  if (!weatherRes.ok) throw new Error(`open-meteo forecast ${weatherRes.status}`);
  const weather = await weatherRes.json();

  let waveHeightM: number | null = null;
  try {
    const marineRes = await fetch(marineUrl, { signal });
    if (marineRes.ok) {
      const marine = await marineRes.json();
      const wave = marine?.current?.wave_height;
      waveHeightM = typeof wave === "number" ? wave : null;
    }
  } catch {
    // Wave data is a bonus field — losing it must not fail the whole widget.
    waveHeightM = null;
  }

  return {
    windSpeedKts: Number(weather?.current?.wind_speed_10m),
    windDirectionDeg: Number(weather?.current?.wind_direction_10m),
    pressureHpa: Number(weather?.current?.surface_pressure),
    waveHeightM,
    capturedAt: Date.now(),
  };
}

const COMPASS_POINTS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export function compassLabel(deg: number): string {
  if (!Number.isFinite(deg)) return "—";
  const idx = Math.round(deg / 22.5) % 16;
  return COMPASS_POINTS[(idx + 16) % 16];
}

function angularDelta(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Anchorage exposure heuristic: each bay is described by the compass arc its
 * mouth opens toward. If the wind is blowing from within that arc, the bay
 * is exposed swell-side; otherwise the surrounding land shelters it. This is
 * a coarse cockpit cue, not a substitute for a pilot book.
 */
const REGION_SHELTER: Record<ChartRegion, { openFromDeg: number; openArcDeg: number }> = {
  // Göcek's bay mouth faces broadly south; the meltemi (NW) is blocked by the peninsula.
  gocek: { openFromDeg: 180, openArcDeg: 80 },
  // Marmaris bay opens southwest.
  marmaris: { openFromDeg: 225, openArcDeg: 90 },
  // Bozburun/Selimiye opens south-southwest.
  bozburun: { openFromDeg: 200, openArcDeg: 80 },
};

export interface ShelterStatus {
  sheltered: boolean;
  /** i18n key for the badge label. */
  labelKey: string;
}

export function shelterStatus(region: ChartRegion, windDirectionDeg: number): ShelterStatus {
  const cfg = REGION_SHELTER[region];
  if (!Number.isFinite(windDirectionDeg)) {
    return { sheltered: true, labelKey: "chart.metocean_shelter_unknown" };
  }
  const exposed = angularDelta(windDirectionDeg, cfg.openFromDeg) <= cfg.openArcDeg / 2;
  return {
    sheltered: !exposed,
    labelKey: exposed ? "chart.metocean_shelter_exposed" : "chart.metocean_shelter_safe",
  };
}

/** Known cruising-region reference points, for the nearest-bay shelter heuristic below. */
const REGION_COORDS: Record<ChartRegion, { lat: number; lng: number }> = {
  gocek: { lat: 36.7525, lng: 28.9428 },
  marmaris: { lat: 36.8525, lng: 28.278 },
  bozburun: { lat: 36.689, lng: 28.043 },
};

/** Which of the three headline bays a clicked chart point is closest to. */
export function nearestRegion(lat: number, lng: number): ChartRegion {
  let best: ChartRegion = "gocek";
  let bestNm = Infinity;
  for (const key of Object.keys(REGION_COORDS) as ChartRegion[]) {
    const c = REGION_COORDS[key];
    const nm = haversineNm(lat, lng, c.lat, c.lng);
    if (nm < bestNm) {
      bestNm = nm;
      best = key;
    }
  }
  return best;
}
