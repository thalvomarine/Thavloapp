import type { CapacitorConfig } from "@capacitor/cli";

/**
 * THALVO MarineOS — Capacitor native shell config.
 *
 * `webDir` is `dist/`, assembled by `scripts/prepare-capacitor-www.mjs` from
 * Nitro's real public output (`.output/public`). Do not point `webDir` at
 * `.output/public` directly — that folder has no bootable `index.html`
 * (SSR HTML is produced by the Node server). The prepare script writes a
 * client-bootable SPA shell that loads the hashed Start entry.
 *
 * Live-reload against a LAN origin is opt-in via `CAPACITOR_LIVE_URL`
 * (e.g. `CAPACITOR_LIVE_URL=http://192.168.1.195:8080 npx cap sync`).
 * Leave the env unset for device/TestFlight builds so the WebView loads the
 * bundled `dist/` snapshot over `capacitor://localhost` instead of a
 * machine-local HTTP URL the phone cannot reach. iOS ATS still blocks
 * cleartext unless the host is on the local network (`NSAllowsLocalNetworking`).
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
    CapacitorUpdater: {
      // Capgo: auto-update channel uses the dashboard default unless overridden.
      // `notifyAppReady()` fires from `src/client.tsx` before React mounts.
      // Longer timeout so a cold WebView parse of LiveMap/i18n does not
      // falsely trigger a rollback loop (symptom: app "won't open").
      autoUpdate: true,
      appReadyTimeout: 20000,
    },
  },
};

export default config;
