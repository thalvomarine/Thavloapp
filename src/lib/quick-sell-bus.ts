/**
 * Opens the captain boat listing sheet (Hızlı Sat) from THALVO AI or elsewhere
 * without threading modal state through MissionShell → Marketplace.
 */
export const THALVO_QUICK_SELL_EVENT = "thalvo:open-quick-sell";

export function openThalvoQuickSell() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(THALVO_QUICK_SELL_EVENT));
}
