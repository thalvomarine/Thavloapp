/**
 * Cross-route open trigger for the SOS emergency sheet.
 *
 * The captain dock owns the red SOS control (center of the bottom nav) and
 * the sheet itself; the map detail card and any other "call a boat" action
 * dispatch this event so they don't each mount a second SosSheet.
 */
export const THALVO_SOS_OPEN_EVENT = "thalvo:open-sos";

export function openThalvoSos(category: "mechanic" | "diver" = "mechanic", details?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(THALVO_SOS_OPEN_EVENT, { detail: { category, details } }),
  );
}
