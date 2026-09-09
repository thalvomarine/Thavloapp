#!/usr/bin/env node
/**
 * Assembles `dist/` as the Capacitor `webDir` snapshot.
 *
 * THALVO is a TanStack Start SSR app — `npm run build` never produces a
 * static `index.html` (every route is server-rendered by Nitro on
 * request), so there's nothing a native WebView could boot from `webDir`
 * alone. This script copies whatever the build actually produced
 * (`dist/client` or `.output/public`) up into `dist/`, then writes a minimal offline splash
 * `index.html` so `npx cap sync` always has a real page to show.
 *
 * That splash is only a "no connection yet" placeholder. Production installs
 * should set `CAPACITOR_SERVER_URL` (see `capacitor.config.ts`) so the
 * native shell loads THALVO's live deployed origin instead — Supabase auth,
 * Realtime, and the AI captain server function all need a real server.
 */
import { existsSync, mkdirSync, cpSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const distDir = join(root, "dist");

const sourceDir = existsSync(join(root, "dist", "client"))
  ? join(root, "dist", "client")
  : existsSync(join(root, ".output", "public"))
    ? join(root, ".output", "public")
    : null;

if (!sourceDir) {
  console.error(
    "[capacitor] No build output found (expected dist/client or .output/public). Run `npm run build` first.",
  );
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });
for (const entry of readdirSync(sourceDir)) {
  cpSync(join(sourceDir, entry), join(distDir, entry), { recursive: true, force: true });
}

const OFFLINE_SHELL_HTML = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>THALVO MarineOS</title>
    <meta name="theme-color" content="#0A192F" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <style>
      html, body { margin: 0; height: 100%; background: #0A192F; }
      body {
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, "Segoe UI", Roboto, Inter, sans-serif;
        color: #E6F6FF; text-align: center; padding: 24px;
        box-sizing: border-box;
      }
      .wrap { max-width: 320px; }
      .dot {
        width: 10px; height: 10px; border-radius: 999px; margin: 0 auto 18px;
        background: #00F0FF; box-shadow: 0 0 24px 4px rgba(0,240,255,0.55);
        animation: pulse 1.6s ease-in-out infinite;
      }
      @keyframes pulse { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
      h1 { font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; margin: 0 0 8px; }
      p { font-size: 13px; line-height: 1.5; color: rgba(230,246,255,0.6); margin: 0 0 20px; }
      button {
        font: inherit; font-weight: 600; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
        color: #0A192F; background: #00F0FF; border: none; border-radius: 999px;
        padding: 12px 22px; cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="dot"></div>
      <h1>THALVO MarineOS</h1>
      <p>Bağlantı bekleniyor — kaptan köşkü canlı sunucuya erişim gerektirir. Kapsama alanına girdiğinizde otomatik olarak yeniden bağlanılacaktır.</p>
      <button onclick="location.reload()">Yeniden Dene</button>
    </div>
  </body>
</html>
`;

writeFileSync(join(distDir, "index.html"), OFFLINE_SHELL_HTML);

console.log(`[capacitor] webDir ready at ${distDir} (assets copied from ${sourceDir})`);
