/**
 * Map / realtime scheduling — keep Leaflet off the React render path
 * during pan, resize, and bursty postgres_changes.
 */

const IDLE_FALLBACK_MS = 80;

/** Cap idle budgets on Capacitor — requestIdleCallback often waits until timeout. */
export function idleBudget(ms: number, nativeMs = 100): number {
  if (typeof window === "undefined") return ms;
  try {
    const Cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    if (Cap?.isNativePlatform?.()) return Math.min(ms, nativeMs);
  } catch {
    /* ignore */
  }
  return ms;
}

export function runWhenIdle(fn: () => void, timeout = 400): () => void {
  if (typeof window === "undefined") {
    fn();
    return () => {};
  }
  const budget = idleBudget(timeout);
  const ric = window.requestIdleCallback?.bind(window);
  if (ric) {
    const id = ric(() => fn(), { timeout: budget });
    return () => window.cancelIdleCallback?.(id);
  }
  const timer = window.setTimeout(fn, Math.min(IDLE_FALLBACK_MS, budget));
  return () => window.clearTimeout(timer);
}

export function debounce(fn: () => void, wait: number): (() => void) & { cancel: () => void } {
  let timer: number | null = null;
  const wrapped = (() => {
    if (timer != null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      fn();
    }, wait);
  }) as (() => void) & { cancel: () => void };
  wrapped.cancel = () => {
    if (timer != null) window.clearTimeout(timer);
    timer = null;
  };
  return wrapped;
}

/** Collect realtime events and flush once after a quiet window. */
export function createRealtimeBuffer(flush: () => void, wait = 180): {
  ping: () => void;
  dispose: () => void;
} {
  let timer: number | null = null;
  let pending = false;
  return {
    ping() {
      pending = true;
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (!pending) return;
        pending = false;
        flush();
      }, wait);
    },
    dispose() {
      if (timer != null) window.clearTimeout(timer);
      timer = null;
      pending = false;
    },
  };
}
