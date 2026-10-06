export type SeaAlert = "none" | "caution" | "gale" | "storm";

export interface SeaStateInput {
  windSpeedKts: number;
  windGustKts: number | null;
  waveHeightM: number | null;
  weatherCode: number | null;
}

const THUNDER = new Set([95, 96, 99]);

/**
 * Beaufort-style cockpit bands. WMO thunderstorm codes 95, 96, and 99
 * outrank the wind and wave numbers.
 */
export function classifySeaState(input: SeaStateInput): SeaAlert {
  const wind = finite(input.windSpeedKts);
  const gust = input.windGustKts == null ? null : finite(input.windGustKts);
  const wave = input.waveHeightM == null ? null : finite(input.waveHeightM);
  const thunder = input.weatherCode != null && THUNDER.has(input.weatherCode);
  if (thunder || wind >= 48 || (gust != null && gust >= 55) || (wave != null && wave >= 4)) {
    return "storm";
  }
  if (wind >= 34 || (gust != null && gust >= 40) || (wave != null && wave >= 2.5)) {
    return "gale";
  }
  if (wind >= 22 || (gust != null && gust >= 28) || (wave != null && wave >= 1.5)) {
    return "caution";
  }
  return "none";
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
