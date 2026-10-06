import { compassLabel } from "@/lib/metocean";
import { classifySeaState, type SeaAlert } from "@/lib/thalvo-ai/sea-state";

export type { SeaAlert };

export interface MarineWeatherReport {
  ok: true;
  source: "open-meteo";
  latitude: number;
  longitude: number;
  observedAt: string;
  windSpeedKts: number;
  windGustKts: number | null;
  windDirectionDeg: number;
  windFrom: string;
  waveHeightM: number | null;
  swellHeightM: number | null;
  wavePeriodS: number | null;
  pressureHpa: number | null;
  weatherCode: number | null;
  alert: SeaAlert;
  summaryTr: string;
  summaryEn: string;
}

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";

export async function fetchMarineWeather(lat: number, lng: number): Promise<MarineWeatherReport> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error("invalid_coordinates");
  }
  const latitude = round6(lat);
  const longitude = round6(lng);
  const forecastUrl =
    `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
    "&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure,weather_code" +
    "&wind_speed_unit=kn";
  const marineUrl =
    `${MARINE_URL}?latitude=${latitude}&longitude=${longitude}` +
    "&current=wave_height,wave_period,swell_wave_height";

  const signal = AbortSignal.timeout(8000);
  const forecastRes = await fetch(forecastUrl, { signal });
  if (!forecastRes.ok) throw new Error(`open-meteo forecast ${forecastRes.status}`);
  const forecast = (await forecastRes.json()) as { current?: Record<string, unknown> };
  const current = forecast.current ?? {};

  let marineCurrent: Record<string, unknown> = {};
  try {
    const marineRes = await fetch(marineUrl, { signal: AbortSignal.timeout(8000) });
    if (marineRes.ok) {
      const marine = (await marineRes.json()) as { current?: Record<string, unknown> };
      marineCurrent = marine.current ?? {};
    }
  } catch {
    marineCurrent = {};
  }

  const windSpeedKts = round1(num(current.wind_speed_10m));
  const windGustKts = optionalNum(current.wind_gusts_10m);
  const windDirectionDeg = round1(num(current.wind_direction_10m));
  const waveHeightM = optionalNum(marineCurrent.wave_height);
  const swellHeightM = optionalNum(marineCurrent.swell_wave_height);
  const wavePeriodS = optionalNum(marineCurrent.wave_period);
  const pressureHpa = optionalNum(current.surface_pressure);
  const weatherCode = optionalInt(current.weather_code);
  const alert = classifySeaState({ windSpeedKts, windGustKts, waveHeightM, weatherCode });
  const windFrom = compassLabel(windDirectionDeg);
  const observedAt = typeof current.time === "string" ? current.time : new Date().toISOString();

  const facts = {
    windSpeedKts,
    windGustKts,
    windFrom,
    waveHeightM,
    swellHeightM,
    wavePeriodS,
    pressureHpa,
    alert,
  };

  return {
    ok: true,
    source: "open-meteo",
    latitude,
    longitude,
    observedAt,
    windSpeedKts,
    windGustKts,
    windDirectionDeg,
    windFrom,
    waveHeightM,
    swellHeightM,
    wavePeriodS,
    pressureHpa,
    weatherCode,
    alert,
    summaryTr: summary(facts, "tr"),
    summaryEn: summary(facts, "en"),
  };
}

function summary(
  facts: {
    windSpeedKts: number;
    windGustKts: number | null;
    windFrom: string;
    waveHeightM: number | null;
    swellHeightM: number | null;
    wavePeriodS: number | null;
    pressureHpa: number | null;
    alert: SeaAlert;
  },
  lang: "tr" | "en",
): string {
  const gust =
    facts.windGustKts == null
      ? ""
      : lang === "tr"
        ? `, hamle ${Math.round(facts.windGustKts)} kn`
        : `, gust ${Math.round(facts.windGustKts)} kn`;
  const wave =
    facts.waveHeightM == null
      ? lang === "tr"
        ? "Dalga yüksekliği bu noktada yok."
        : "Wave height is unavailable at this point."
      : lang === "tr"
        ? `Dalga ${facts.waveHeightM.toFixed(1)} m${facts.wavePeriodS == null ? "" : `, periyot ${Math.round(facts.wavePeriodS)} sn`}${facts.swellHeightM == null ? "" : `, şiş ${facts.swellHeightM.toFixed(1)} m`}.`
        : `Waves ${facts.waveHeightM.toFixed(1)} m${facts.wavePeriodS == null ? "" : `, period ${Math.round(facts.wavePeriodS)} s`}${facts.swellHeightM == null ? "" : `, swell ${facts.swellHeightM.toFixed(1)} m`}.`;
  const pressure =
    facts.pressureHpa == null
      ? ""
      : lang === "tr"
        ? ` Basınç ${Math.round(facts.pressureHpa)} hPa.`
        : ` Pressure ${Math.round(facts.pressureHpa)} hPa.`;
  const band =
    lang === "tr"
      ? { none: "Uyarı yok.", caution: "Dikkat: sert deniz.", gale: "Fırtına uyarısı: seyir riskli.", storm: "Şiddetli fırtına: barınağa dön veya demirde kal." }
      : { none: "No weather warning.", caution: "Caution: rough sea.", gale: "Gale warning: passage is risky.", storm: "Storm: return to shelter or stay secured." };
  const wind =
    lang === "tr"
      ? `Rüzgâr ${Math.round(facts.windSpeedKts)} kn, ${facts.windFrom} yönünden${gust}.`
      : `Wind ${Math.round(facts.windSpeedKts)} kn from ${facts.windFrom}${gust}.`;
  return `${wind} ${wave}${pressure} ${band[facts.alert]}`;
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error("weather_field_missing");
  return n;
}

function optionalNum(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return round1(value);
}

function optionalInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
