import type { CapacitorConfig } from "@capacitor/cli";

/**
 * THALVO MarineOS — Capacitor native shell config.
 *
 * Capacitor 3+ dropped the old `bundledWebRuntime` toggle (Capacitor 1/2) —
 * the native runtime is always bundled via the `@capacitor/*` npm packages
 * now, so there is nothing to configure here and no `bundledWebRuntime` key
 * exists on `CapacitorConfig` to set.
 *
 * THALVO is a TanStack Start SSR app (Supabase auth/Realtime, an AI server
 * function, admin dispatch) — not a static SPA — so a fully offline,
 * bundled `webDir` snapshot can only ever be a fallback shell. The
 * documented Capacitor pattern for server-backed apps is to point the
 * native WebView at a live origin instead of the bundled `webDir` snapshot.
 *
 * Live-reload against a LAN origin is opt-in via `CAPACITOR_LIVE_URL`
 * (e.g. `CAPACITOR_LIVE_URL=http://192.168.1.195:8081 npx cap sync`).
 * Release / default builds MUST omit `server` so the WebView loads the
 * bundled `webDir` snapshot over the app origin — never hardcoded HTTP
 * LAN + cleartext, which would expose the session to MITM on-device.
 */
const liveUrl = process.env.CAPACITOR_LIVE_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.thalvo.marineos",
  appName: "Thalvo MarineOS",
  webDir: "dist",
  backgroundColor: "#0A192F",
  ...(liveUrl
    ? {
        server: {
          url: liveUrl,
          cleartext: liveUrl.startsWith("http://"),
        },
      }
    : {}),
  ios: {
    backgroundColor: "#0A192F",
    // Let the web layer own the whole surface (status bar + notch/Dynamic
    // Island included) — LiveMap's fullscreen chartplotter is drawn edge to
    // edge and positions its own HUD using `env(safe-area-inset-*)`, same
    // as the web/PWA build, instead of relying on a native content inset.
    contentInset: "never",
  },
  android: {
    backgroundColor: "#0A192F",
  },
  plugins: {
    StatusBar: {
      // Light glyphs/text for the dark #0A192F cockpit background.
      style: "DARK",
      backgroundColor: "#0A192F",
      // Fullscreen overlay: the status bar floats over the map instead of
      // pushing it down. `src/lib/native.ts` re-asserts this at runtime
      // (Android 15+ ignores the static config value for this option).
      overlaysWebView: true,
    },
  },
};

export default config;
