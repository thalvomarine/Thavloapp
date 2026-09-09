/**
 * THALVO — single source of truth for device positioning.
 *
 * Hard rules, enforced here so no screen can violate them:
 *  1. A position is either a real, validated device fix or it is absent.
 *     There is NO fallback marina, NO default centre, NO random coordinate.
 *  2. Every fix carries accuracy (metres) and a capture timestamp.
 *  3. A fix older than STALE_AFTER_MS is treated as unusable and must be re-taken.
 *  4. Latitude/longitude are range-checked and null-island is rejected.
 */

export type GeoState =
  | "idle"
  | "unsupported"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable"
  | "timeout"
  | "invalid"
  | "stale";

export interface GeoFix {
  lat: number;
  lng: number;
  /** Horizontal accuracy in metres, as reported by the device. */
  accuracy: number;
  /** Epoch ms when the device produced the fix. */
  capturedAt: number;
}

export const STALE_AFTER_MS = 60_000;
/** Above this the fix is usable but the UI should warn and offer a re-fix. */
export const LOW_ACCURACY_M = 100;

export const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8_000,
  maximumAge: 0,
};

export function isSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

/** Range + sanity validation. Rejects null-island and non-finite values. */
export function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // Null island: almost always a broken sensor or a placeholder value.
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  return true;
}

export function isStale(fix: GeoFix | null, now = Date.now()): boolean {
  if (!fix) return true;
  return now - fix.capturedAt > STALE_AFTER_MS;
}

export function isLowAccuracy(fix: GeoFix | null): boolean {
  return !!fix && fix.accuracy > LOW_ACCURACY_M;
}

/**
 * Coarsen a fix for privacy (~1 km grid). Used when showing a captain's or
 * provider's position to a counterparty before the job is accepted.
 */
export function coarsen(lat: number, lng: number, gridDeg = 0.01): { lat: number; lng: number } {
  const round = (v: number) => Math.round(v / gridDeg) * gridDeg;
  return { lat: Number(round(lat).toFixed(4)), lng: Number(round(lng).toFixed(4)) };
}

export interface GeoFailure {
  state: Exclude<GeoState, "idle" | "requesting" | "granted">;
  /** i18n key describing the failure. */
  messageKey: string;
  /** Safe English default so the UI never renders a raw key. */
  defaultMessage: string;
}

export type GeoResult = { ok: true; fix: GeoFix } | { ok: false; failure: GeoFailure };

const FAILURES: Record<GeoFailure["state"], Omit<GeoFailure, "state">> = {
  unsupported: {
    messageKey: "geo.unsupported",
    defaultMessage: "This device does not support location.",
  },
  denied: {
    messageKey: "geo.denied",
    defaultMessage: "Location permission denied — enable it to continue.",
  },
  unavailable: {
    messageKey: "geo.unavailable",
    defaultMessage: "Your device could not determine a position. Move to open sky and retry.",
  },
  timeout: {
    messageKey: "geo.timeout",
    defaultMessage: "Location request timed out. Please retry.",
  },
  invalid: {
    messageKey: "geo.invalid",
    defaultMessage: "Received an invalid location fix. Please retry.",
  },
  stale: {
    messageKey: "geo.stale",
    defaultMessage: "Your position is out of date. Refresh it before continuing.",
  },
};

function fail(state: GeoFailure["state"]): GeoResult {
  return { ok: false, failure: { state, ...FAILURES[state] } };
}

/** Request one validated fix. Never resolves with a fabricated position. */
export function getFix(options: PositionOptions = GEO_OPTIONS): Promise<GeoResult> {
  if (!isSupported()) return Promise.resolve(fail("unsupported"));

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (!isValidCoordinate(latitude, longitude)) return resolve(fail("invalid"));
        resolve({
          ok: true,
          fix: {
            lat: latitude,
            lng: longitude,
            accuracy: Number.isFinite(accuracy) ? accuracy : Number.NaN,
            capturedAt: pos.timestamp || Date.now(),
          },
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) return resolve(fail("denied"));
        if (err.code === err.POSITION_UNAVAILABLE) return resolve(fail("unavailable"));
        if (err.code === err.TIMEOUT) return resolve(fail("timeout"));
        resolve(fail("unavailable"));
      },
      options,
    );
  });
}

/**
 * Continuous tracking with an explicit lifecycle. Returns a stop function;
 * the caller MUST call it on unmount and when the mission leaves EnRoute.
 * Automatically pauses while the tab is hidden.
 */
export function watchFix(
  onFix: (fix: GeoFix) => void,
  onFailure?: (failure: GeoFailure) => void,
  options: PositionOptions = { ...GEO_OPTIONS, maximumAge: 5_000, timeout: 15_000 },
): () => void {
  if (!isSupported()) {
    onFailure?.({ state: "unsupported", ...FAILURES.unsupported });
    return () => {};
  }

  let watchId: number | null = null;

  const start = () => {
    if (watchId !== null) return;
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (!isValidCoordinate(latitude, longitude)) {
          onFailure?.({ state: "invalid", ...FAILURES.invalid });
          return;
        }
        onFix({
          lat: latitude,
          lng: longitude,
          accuracy: Number.isFinite(accuracy) ? accuracy : Number.NaN,
          capturedAt: pos.timestamp || Date.now(),
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED)
          onFailure?.({ state: "denied", ...FAILURES.denied });
        else if (err.code === err.TIMEOUT) onFailure?.({ state: "timeout", ...FAILURES.timeout });
        else onFailure?.({ state: "unavailable", ...FAILURES.unavailable });
      },
      options,
    );
  };

  const stop = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  };

  const onVisibility = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "hidden") stop();
    else start();
  };

  start();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  return () => {
    stop();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

/** Payload fragment shared by every job-creation flow. */
export function fixToJobFields(fix: GeoFix) {
  return {
    lat: fix.lat,
    lng: fix.lng,
    location_accuracy_m: Number.isFinite(fix.accuracy) ? Math.round(fix.accuracy) : null,
    location_captured_at: new Date(fix.capturedAt).toISOString(),
  };
}

export function formatAccuracy(fix: GeoFix | null): string {
  if (!fix || !Number.isFinite(fix.accuracy)) return "—";
  return fix.accuracy >= 1000
    ? `±${(fix.accuracy / 1000).toFixed(1)} km`
    : `±${Math.round(fix.accuracy)} m`;
}

/**
 * Keep only rows with a real, validated WGS84 position.
 * Also drops legacy 0..1 "normalized" placeholder coordinates, which are never
 * a real device fix in this app's operating regions.
 * Pure: no transformation, no rounding, no fallback, input order preserved.
 */
export function pickValidCoordinates<T extends { lat: unknown; lng: unknown }>(
  rows: readonly T[],
): (T & { lat: number; lng: number })[] {
  return rows.filter((row): row is T & { lat: number; lng: number } => {
    if (!isValidCoordinate(row.lat, row.lng)) return false;
    const lat = row.lat as number;
    const lng = row.lng as number;
    // Legacy normalized placeholders (0..1 on both axes) are not positions.
    return !(Math.abs(lat) < 1 && Math.abs(lng) < 1);
  });
}
