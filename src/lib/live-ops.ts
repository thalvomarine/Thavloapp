export type OpsMissionStatus = "en_route" | "preparing" | "pending" | "completed";

export interface OpsMission {
  id: string;
  titleKey: string;
  targetKey: string;
  vessel: string;
  marina: string;
  status: OpsMissionStatus;
  statusKey: string;
  distanceNm: number | null;
  etaMin: number | null;
  lat: number;
  lng: number;
  vhfChannel: string;
  callsign: string;
  phone: string;
  notesKey: string;
}

/** Seeded live-ops board — keeps Missions from rendering as an empty cockpit. */
export const SEED_MISSIONS: OpsMission[] = [
  {
    id: "seed-battery-sarsala",
    titleKey: "ops.mission_battery_title",
    targetKey: "ops.mission_battery_target",
    vessel: "M/Y Boreas",
    marina: "Sarsala Koyu",
    status: "en_route",
    statusKey: "ops.status_en_route",
    distanceNm: 1.2,
    etaMin: 8,
    lat: 36.7908,
    lng: 28.9235,
    vhfChannel: "16",
    callsign: "THALVO-OPS",
    phone: "+90 252 555 16 16",
    notesKey: "ops.mission_battery_notes",
  },
  {
    id: "seed-bilge-gocek",
    titleKey: "ops.mission_bilge_title",
    targetKey: "ops.mission_bilge_target",
    vessel: "S/Y Windfall",
    marina: "Göcek Belediye Marinası",
    status: "preparing",
    statusKey: "ops.status_preparing",
    distanceNm: null,
    etaMin: null,
    lat: 36.7542,
    lng: 28.9338,
    vhfChannel: "16",
    callsign: "THALVO-OPS",
    phone: "+90 252 555 16 16",
    notesKey: "ops.mission_bilge_notes",
  },
];

export const SEED_OPS_STATS = {
  active: 2,
  pending: 1,
  completed: 17,
};
