/**
 * Map / realtime scheduling — keep Leaflet off the React render path
 * during pan, resize, and bursty postgres_changes.
 */

const IDLE_FALLBACK_MS = 200;

export function runWhenIdle(fn: () => void, timeout = 1200): () => void {
  if (typeof window === "undefined") {
    fn();
    return () => {};
  }
  const ric = window.requestIdleCallback?.bind(window);
  if (ric) {
    const id = ric(() => fn(), { timeout });
    return () => window.cancelIdleCallback?.(id);
  }
  const timer = window.setTimeout(fn, Math.min(IDLE_FALLBACK_MS, timeout));
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
