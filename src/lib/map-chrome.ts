import { useSyncExternalStore } from "react";

/**
 * Global map-HUD chrome lock.
 *
 * Any fullscreen / sheet / menu that would collide with the floating
 * compass / layers / locate stack (and the coordinate badge) flips a
 * named flag here. LiveMap hides that chrome whenever any flag is on.
 */
export type MapChromeOverlay = "sos" | "layers" | "bay" | "note" | "menu" | "zone" | "ai";

type Flags = Record<MapChromeOverlay, boolean>;

const flags: Flags = {
  sos: false,
  layers: false,
  bay: false,
  note: false,
  menu: false,
  zone: false,
  ai: false,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function setMapChromeOverlay(key: MapChromeOverlay, open: boolean) {
  if (flags[key] === open) return;
  flags[key] = open;
  emit();
}

export function isMapChromeHidden(): boolean {
  return Object.values(flags).some(Boolean);
}

export function subscribeMapChrome(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function useMapChromeHidden(): boolean {
  return useSyncExternalStore(subscribeMapChrome, isMapChromeHidden, () => false);
}
