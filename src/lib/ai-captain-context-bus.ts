import {
  EMPTY_COCKPIT_CONTEXT,
  type CaptainCockpitContext,
} from "@/lib/ai-captain-types";

let snapshot: CaptainCockpitContext = { ...EMPTY_COCKPIT_CONTEXT };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

/** LiveMap / Metocean / passport publish the latest cockpit facts here. */
export function publishCockpitContext(partial: Partial<CaptainCockpitContext>) {
  snapshot = { ...snapshot, ...partial };
  emit();
}

export function getCockpitContext(): CaptainCockpitContext {
  return snapshot;
}

export function subscribeCockpitContext(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
