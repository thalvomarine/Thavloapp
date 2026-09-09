/**
 * Cross-component open trigger for the THALVO Compass AI assistant.
 *
 * The fullscreen map cockpit folds its own AI launcher into a bottom-right
 * FAB stack (see `ChartFabStack`) instead of showing `ThalvoAiFab`'s own
 * floating button, but the chat sheet + its server-fn wiring still live in
 * `ThalvoAiFab`. Dispatching this event opens it from anywhere without
 * threading modal state through LiveMap -> MissionShell.
 */
export const THALVO_AI_OPEN_EVENT = "thalvo:open-ai";

export function openThalvoAi() {
  window.dispatchEvent(new CustomEvent(THALVO_AI_OPEN_EVENT));
}
