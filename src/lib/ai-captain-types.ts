export type CaptainSosType = "mechanic" | "diver";
export type CaptainLayerType = "seamarks" | "hazards" | "moorings" | "reports" | "fleet";

export interface CaptainPosition {
  lat: number;
  lng: number;
  source: "gps" | "chart";
}

export interface CaptainSelectedBay {
  name: string;
  kind: string;
  depthM: number | null;
  seabed: string | null;
  protection: string | null;
  lat: number;
  lng: number;
}

export interface CaptainWeather {
  windKts: number;
  windDeg: number;
  windFrom: string;
  waveM: number | null;
  pressureHpa: number;
}

export interface CaptainVessel {
  name: string | null;
  type: string | null;
  lengthM: number | null;
  draftM: number | null;
  engine: string | null;
}

export interface CaptainCockpitContext {
  position: CaptainPosition | null;
  selectedBay: CaptainSelectedBay | null;
  weather: CaptainWeather | null;
  vessel: CaptainVessel | null;
}

export const EMPTY_COCKPIT_CONTEXT: CaptainCockpitContext = {
  position: null,
  selectedBay: null,
  weather: null,
  vessel: null,
};

export interface NearbyChartPoint {
  name: string;
  kind: string;
  lat: number;
  lng: number;
  depthM: number | null;
  seabed: string | null;
  protection: string | null;
  rangeNm: number | null;
}

export type CaptainAction =
  | { tool: "focusBay"; bayName: string; lat: number; lng: number; zoom: number }
  | { tool: "createSosOrMission"; type: CaptainSosType; details: string }
  | { tool: "filterLayers"; layerType: CaptainLayerType; enabled: boolean };

export const CAPTAIN_LAYER_ALIASES: Record<string, CaptainLayerType> = {
  seamarks: "seamarks",
  lights: "seamarks",
  light: "seamarks",
  fener: "seamarks",
  fenerler: "seamarks",
  hazards: "hazards",
  hazard: "hazards",
  shoal: "hazards",
  shoals: "hazards",
  siglik: "hazards",
  sığlık: "hazards",
  sığlıklar: "hazards",
  reef: "hazards",
  moorings: "moorings",
  mooring: "moorings",
  tonoz: "moorings",
  alarga: "moorings",
  anchorage: "moorings",
  reports: "reports",
  tavsiye: "reports",
  fleet: "fleet",
  filo: "fleet",
};

export function resolveCaptainLayer(raw: string): CaptainLayerType | null {
  const key = raw.trim().toLowerCase();
  return CAPTAIN_LAYER_ALIASES[key] ?? null;
}
