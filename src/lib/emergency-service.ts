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
