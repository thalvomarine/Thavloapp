import { supabase } from "@/integrations/supabase/client";

/** Chart point types stored in `marine_zones`. */
export type MarineZoneKind =
  "marina" | "lighthouse" | "restaurant" | "hazard" | "anchorage" | "fuel";

/**
 * Free-form chart-point metadata (bottom composition, shelter character,
 * amenities, hazard type). Populated by the curated coastal seed data —
 * unlike `CommunityReport.seabed`, this is open text/coded strings straight
 * from the source survey rather than a fixed enum, so it's rendered as-is
 * rather than run through an i18n label map.
 */
export interface MarineZoneMetadata {
  bottom?: string;
  protection?: string;
  amenities?: string[];
  hazard_type?: string;
}

export interface MarineZone {
  id: string;
  kind: MarineZoneKind;
  name: string;
  lat: number;
  lng: number;
  vhf_channel: string | null;
  depth_m: number | null;
  description: string | null;
  active: boolean;
  created_at: string;
  metadata: MarineZoneMetadata;
}

export const ZONE_KINDS: MarineZoneKind[] = [
  "marina",
  "lighthouse",
  "restaurant",
  "hazard",
  "anchorage",
  "fuel",
];

export const ZONE_KIND_LABEL_KEYS: Record<MarineZoneKind, string> = {
  marina: "marine.kind_marina",
  lighthouse: "marine.kind_lighthouse",
  restaurant: "marine.kind_restaurant",
  hazard: "marine.kind_hazard",
  anchorage: "marine.kind_anchorage",
  fuel: "marine.kind_fuel",
};

/** Captain-submitted chart advice stored in `community_reports`. */
export type ReportCategory = "hazard" | "anchorage" | "restaurant" | "light_fault" | "general" | "fuel";
export type Seabed = "sand" | "mud" | "weed" | "rock";
export type ReportStatus = "pending_approval" | "approved" | "rejected";

export interface CommunityReport {
  id: string;
  /** Null for anonymous submissions — see `submitted_by` for a free-text name instead. */
  reporter_id: string | null;
  title: string;
  category: ReportCategory;
  lat: number;
  lng: number;
  depth_m: number | null;
  seabed: Seabed | null;
  note: string;
  /** Optional captain / boat name, only used when the reporter isn't signed in. */
  submitted_by: string | null;
  status: ReportStatus;
  created_at: string;
}

export const REPORT_CATEGORIES: ReportCategory[] = [
  "anchorage",
  "hazard",
  "restaurant",
  "fuel",
  "light_fault",
  "general",
];

/** Passage-note sheet: Demirleme, Tehlike/Sığlık, Restoran/Tonoz, İkmal. */
export const NOTE_FORM_CATEGORIES: ReportCategory[] = [
  "anchorage",
  "hazard",
  "restaurant",
  "fuel",
];

export const REPORT_CATEGORY_LABEL_KEYS: Record<ReportCategory, string> = {
  hazard: "marine.report_cat_hazard",
  anchorage: "marine.report_cat_anchorage",
  restaurant: "marine.report_cat_restaurant",
  light_fault: "marine.report_cat_light_fault",
  general: "marine.report_cat_general",
  fuel: "marine.report_cat_fuel",
};

export const SEABEDS: Seabed[] = ["mud", "sand", "weed", "rock"];

export const SEABED_LABEL_KEYS: Record<Seabed, string> = {
  sand: "marine.seabed_sand",
  mud: "marine.seabed_mud",
  weed: "marine.seabed_weed",
  rock: "marine.seabed_rock",
};

/** An approved report becomes a permanent chart pin of this zone kind. */
export const REPORT_TO_ZONE_KIND: Record<ReportCategory, MarineZoneKind> = {
  hazard: "hazard",
  anchorage: "anchorage",
  restaurant: "restaurant",
  light_fault: "lighthouse",
  // "Genel Uyarı" has no dedicated pin shape yet; surface it as a hazard-style marker.
  general: "hazard",
  fuel: "fuel",
};

/** A single chart pin the cockpit can select — either an official zone or an approved captain report. */
export type ChartPoint =
  { kind: "zone"; zone: MarineZone } | { kind: "report"; report: CommunityReport };

export function chartPointCoords(point: ChartPoint): { lat: number; lng: number } {
  return point.kind === "zone"
    ? { lat: point.zone.lat, lng: point.zone.lng }
    : { lat: point.report.lat, lng: point.report.lng };
}

export function chartPointName(point: ChartPoint): string {
  return point.kind === "zone" ? point.zone.name : point.report.title;
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

export async function fetchMarineZones(includeInactive = false): Promise<MarineZone[]> {
  let zonesQuery = supabase
    .from("marine_zones")
    .select(
      "id, kind, name, lat, lng, vhf_channel, depth_m, description, active, created_at, metadata",
    )
    .order("created_at", { ascending: false });
  if (!includeInactive) zonesQuery = zonesQuery.eq("active", true);
  const primary = await zonesQuery;

  // `metadata` (added alongside the curated coastal seed data) may predate
  // its migration actually landing on a given environment — retry without
  // it rather than losing every zone pin to one missing column.
  let rows: Array<Record<string, unknown>> | null = primary.data;
  if (primary.error) {
    let fallbackQuery = supabase
      .from("marine_zones")
      .select("id, kind, name, lat, lng, vhf_channel, depth_m, description, active, created_at")
      .order("created_at", { ascending: false });
    if (!includeInactive) fallbackQuery = fallbackQuery.eq("active", true);
    const fallback = await fallbackQuery;
    if (fallback.error) throw new Error(fallback.error.message);
    rows = fallback.data;
  }

  return (rows ?? []).map((r) => ({
    id: r.id as string,
    kind: r.kind as MarineZoneKind,
    name: r.name as string,
    lat: num(r.lat),
    lng: num(r.lng),
    vhf_channel: (r.vhf_channel as string | null) ?? null,
    depth_m: r.depth_m == null ? null : num(r.depth_m),
    description: (r.description as string | null) ?? null,
    active: r.active as boolean,
    created_at: r.created_at as string,
    metadata: (r.metadata as MarineZoneMetadata | null) ?? {},
  }));
}

/** Human-readable bottom composition for a zone, straight from its metadata. */
export function zoneBottomLabel(zone: MarineZone): string | null {
  const bottom = zone.metadata.bottom;
  return typeof bottom === "string" && bottom.length > 0 ? bottom : null;
}

export async function fetchCommunityReports(status?: ReportStatus): Promise<CommunityReport[]> {
  let q = supabase
    .from("community_reports")
    .select(
      "id, reporter_id, title, category, lat, lng, depth_m, seabed, note, submitted_by, status, created_at",
    )
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...r,
    category: r.category as ReportCategory,
    seabed: (r.seabed as Seabed | null) ?? null,
    status: r.status as ReportStatus,
    lat: num(r.lat),
    lng: num(r.lng),
    depth_m: r.depth_m == null ? null : num(r.depth_m),
  }));
}

/** Chartplotter-style readout: 36°45.28' N, 028°56.14' E */
export function formatDegrees(lat: number, lng: number): string {
  const part = (value: number, pad: number, pos: string, neg: string) => {
    const hemi = value >= 0 ? pos : neg;
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const min = (abs - deg) * 60;
    return `${String(deg).padStart(pad, "0")}°${min.toFixed(2).padStart(5, "0")}' ${hemi}`;
  };
  return `${part(lat, 2, "N", "S")}, ${part(lng, 3, "E", "W")}`;
}

/** Metres to nautical miles, rounded for a scale badge. */
export function toNauticalMiles(metres: number): number {
  return metres / 1852;
}
