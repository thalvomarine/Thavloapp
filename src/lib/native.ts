/**
 * Capacitor native-shell bootstrap.
 *
 * `capacitor.config.ts` sets the *static* status bar theme, but Android
 * 15+ ignores `overlaysWebView`/`backgroundColor` from config and some iOS
 * WKWebView states need the style re-asserted after launch — so this runs
 * the same dark-cockpit theme again at runtime, once, on native platforms
 * only. No-ops in the browser/PWA build (`isNativePlatform()` is false),
 * so it's safe to call unconditionally from the root shell.
 */
export async function initNativeShell(): Promise<void> {
  if (typeof window === "undefined") return;

  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: true });
    if (Capacitor.getPlatform() === "android") {
      // No-op on Android 15+, harmless no-op otherwise.
      await StatusBar.setBackgroundColor({ color: "#0A192F" });
    }
  } catch (error) {
    console.warn("[native] status bar bootstrap failed", error);
  }
}
