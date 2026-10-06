import { supabase } from "@/integrations/supabase/client";
import { isValidCoordinate } from "@/lib/geolocation";

export type EmergencyServiceCategory = "diver" | "mechanic" | "electrician" | "towing";
export type EmergencyUrgency = "urgent" | "standard";
export type EmergencyServiceStatus = "pending" | "en_route" | "on_scene" | "completed";

export interface EmergencyServiceRequest {
  id: string;
  user_id: string;
  vessel_name: string;
  category: EmergencyServiceCategory;
  lat: number;
  lng: number;
  bay_name: string | null;
  description: string;
  urgency_level: EmergencyUrgency;
  assigned_provider_id: string | null;
  status: EmergencyServiceStatus;
  created_at: string;
}

export const EMERGENCY_SERVICE_CATEGORIES: EmergencyServiceCategory[] = [
  "diver",
  "mechanic",
  "electrician",
  "towing",
];

export const EMERGENCY_CATEGORY_LABEL_KEYS: Record<EmergencyServiceCategory, string> = {
  diver: "esvc.cat_diver",
  mechanic: "esvc.cat_mechanic",
  electrician: "esvc.cat_electrician",
  towing: "esvc.cat_towing",
};

export function isEmergencyCategory(value: string): value is EmergencyServiceCategory {
  return (EMERGENCY_SERVICE_CATEGORIES as string[]).includes(value);
}

export function asCoordinate(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Fan a captain/sailor call out to usta accounts with the device fix. */
export async function publishLocatedCall(input: {
  userId: string;
  category: "diver" | "mechanic";
  lat: number;
  lng: number;
  vesselName: string;
  bayName: string | null;
  description: string;
  urgency: EmergencyUrgency;
}): Promise<{ error: string | null }> {
  if (!isValidCoordinate(input.lat, input.lng)) {
    return { error: "invalid-fix" };
  }
  const { error } = await supabase.from("emergency_service_requests").insert({
    user_id: input.userId,
    vessel_name: input.vesselName.slice(0, 80),
    category: input.category,
    lat: input.lat,
    lng: input.lng,
    bay_name: input.bayName ? input.bayName.slice(0, 120) : null,
    description: input.description.slice(0, 2000),
    urgency_level: input.urgency,
    status: "pending",
  });
  return { error: error?.message ?? null };
}
