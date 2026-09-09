/**
 * Cross-route “focus the chart” trigger.
 *
 * Missions / Marketplace persist the target before navigating to `/app`,
 * then LiveMap consumes it on mount (and also listens live if already open).
 */
export const THALVO_MAP_FOCUS_EVENT = "thalvo:map-focus";

export interface MapFocusTarget {
  lat: number;
  lng: number;
  zoom?: number;
  label?: string;
}

const STORAGE_KEY = "thalvo.map.focus";

export function requestMapFocus(target: MapFocusTarget) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(target));
  } catch {
    /* private mode / quota — event still fires */
  }
  window.dispatchEvent(new CustomEvent<MapFocusTarget>(THALVO_MAP_FOCUS_EVENT, { detail: target }));
}

export function consumeMapFocus(): MapFocusTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as MapFocusTarget;
    if (typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}
