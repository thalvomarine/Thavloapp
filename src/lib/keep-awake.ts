/**
 * Screen wake lock for active passage (Seyre Başla).
 * Native: @capacitor-community/keep-awake
 * Web: navigator.wakeLock (when available)
 */

let webWakeLock: WakeLockSentinel | null = null;

export async function activateKeepAwake(): Promise<void> {
  try {
    if (typeof window === "undefined") return;

    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { KeepAwake } = await import("@capacitor-community/keep-awake");
      await KeepAwake.keepAwake();
      console.log("[KeepAwake] Active (native)");
      return;
    }

    if (navigator.wakeLock?.request) {
      try {
        webWakeLock = await navigator.wakeLock.request("screen");
        webWakeLock.addEventListener("release", () => {
          webWakeLock = null;
        });
        console.log("[KeepAwake] Active (wakeLock)");
      } catch (err) {
        console.warn("[KeepAwake] wakeLock unavailable:", err);
      }
    }
  } catch (err) {
    console.warn("[KeepAwake] activate failed:", err);
  }
}

export async function releaseKeepAwake(): Promise<void> {
  try {
    if (typeof window === "undefined") return;

    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { KeepAwake } = await import("@capacitor-community/keep-awake");
      await KeepAwake.allowSleep();
      console.log("[KeepAwake] Released (native)");
      return;
    }

    if (webWakeLock) {
      await webWakeLock.release();
      webWakeLock = null;
      console.log("[KeepAwake] Released (wakeLock)");
    }
  } catch (err) {
    console.warn("[KeepAwake] release failed:", err);
  }
}
