import type { EmergencyServiceCategory } from "@/lib/emergency-service";

export const THALVO_EMERGENCY_SERVICE_EVENT = "thalvo:open-emergency-service";

export interface EmergencyServiceOpenDetail {
  bayName?: string;
  category?: EmergencyServiceCategory;
}

export function openEmergencyService(detail: EmergencyServiceOpenDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<EmergencyServiceOpenDetail>(THALVO_EMERGENCY_SERVICE_EVENT, { detail }),
  );
}
