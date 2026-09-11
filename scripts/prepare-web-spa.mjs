#!/usr/bin/env node
/**
 * Assembles a bootable static SPA in `dist/` from TanStack Start / Nitro
 * client assets. Used by Vercel (`outputDirectory: dist`) and Capacitor
 * (`webDir: dist`). This is not `cap copy` / `cap sync`.
 *
 * Nitro emits JS/CSS to `.output/public` (or, on some hosts,
 * `.vercel/output/static` / `dist/client`) without a client `index.html`.
 * This script copies those assets and writes the hydrate shell.
 */
import {
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  writeFileSync,
  readdirSync,
  readFileSync,
  mkdtempSync,
} from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const distDir = join(root, "dist");

const CANDIDATES = [
  join(root, ".output", "public"),
  join(root, ".vercel", "output", "static"),
  join(root, "dist", "client"),
];

function findSource() {
  for (const dir of CANDIDATES) {
    if (existsSync(join(dir, "assets"))) return dir;
  }
  for (const dir of CANDIDATES) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

const sourceDir = findSource();
if (!sourceDir) {
  console.error(
    "[spa] No client assets found. Looked in: " +
      CANDIDATES.map((d) => relative(root, d) || d).join(", ") +
      ". Run `vite build` first.",
  );
  process.exit(1);
}

const sourceInsideDist =
  sourceDir === distDir || sourceDir.startsWith(distDir + "/") || sourceDir.startsWith(distDir + "\\");

let copyFrom = sourceDir;
let scratch = null;
if (sourceInsideDist) {
  scratch = mkdtempSync(join(tmpdir(), "thalvo-spa-"));
  cpSync(sourceDir, scratch, { recursive: true });
  copyFrom = scratch;
}

if (existsSync(distDir)) {
  for (const entry of readdirSync(distDir)) {
    rmSync(join(distDir, entry), { recursive: true, force: true });
  }
} else {
  mkdirSync(distDir, { recursive: true });
}

cpSync(copyFrom, distDir, { recursive: true });
if (scratch) rmSync(scratch, { recursive: true, force: true });

const assetsDir = join(distDir, "assets");
if (!existsSync(assetsDir)) {
  console.error("[spa] Copied public dir has no assets/. The client bundle is missing.");
  process.exit(1);
}

const assetFiles = readdirSync(assetsDir);
const jsFiles = assetFiles.filter((f) => f.endsWith(".js") && !f.endsWith(".map"));
const cssFiles = assetFiles.filter((f) => f.endsWith(".css") && !f.endsWith(".map"));

function findClientEntry() {
  for (const file of jsFiles) {
    const text = readFileSync(join(assetsDir, file), "utf8");
    if (
      text.includes("hydrateRoot)(document") ||
      text.includes("hydrateRoot(document") ||
      text.includes("thalvo-root")
    ) {
      return file;
    }
  }
  return jsFiles.find((f) => /^index-.*\.js$/.test(f)) ?? null;
}

const entry = findClientEntry();
if (!entry) {
  console.error("[spa] Could not find the TanStack Start client entry in assets/.");
  process.exit(1);
}

const cssLinks = cssFiles
  .map((f) => `    <link rel="stylesheet" href="./assets/${f}" />`)
  .join("\n");

const indexHtml = `<!doctype html>
<html lang="tr" class="h-full w-full max-w-[100vw] overflow-x-hidden bg-[#0A192F]" suppressHydrationWarning>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>THALVO MarineOS</title>
    <meta name="theme-color" content="#0A192F" />
    <meta name="color-scheme" content="dark" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="icon" type="image/png" sizes="192x192" href="./icon-192.png" />
${cssLinks}
    <style>
      html, body { margin: 0; height: 100%; background: #0A192F; }
      #thalvo-root { height: 100%; }
      #thalvo-boot {
        min-height: 100%; display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, "Segoe UI", Roboto, Inter, sans-serif;
        color: #E6F6FF; text-align: center; padding: 24px; box-sizing: border-box;
      }
      #thalvo-boot .dot {
        width: 10px; height: 10px; border-radius: 999px; margin: 0 auto 18px;
        background: #00F0FF; box-shadow: 0 0 24px 4px rgba(0,240,255,0.55);
        animation: thalvo-pulse 1.6s ease-in-out infinite;
      }
      @keyframes thalvo-pulse { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
    </style>
    <script>
      (function () {
        self.$R = self.$R || {};
        self.$_TSR = {
          h: function () { this.hydrated = true; this.c(); },
          e: function () { this.streamEnded = true; this.c(); },
          c: function () {
            if (!(this.hydrated && this.streamEnded)) return;
            try { delete self.$_TSR; } catch (e) {}
            try { delete self.$R.tsr; } catch (e) {}
          },
          p: function (fn) { this.initialized ? fn() : this.buffer.push(fn); },
          buffer: [],
          router: { matches: [] }
        };
        var native = /^(capacitor|ionic|file):$/.test(location.protocol)
          || (self.Capacitor && typeof self.Capacitor.isNativePlatform === "function" && self.Capacitor.isNativePlatform());
        if (!native) return;
        var path = location.pathname || "";
        if (!/index\\.html$/i.test(path)) return;
        if (location.hash && location.hash !== "#") return;
        var next = path + "#/";
        try { history.replaceState(null, "", next); }
        catch (e) { location.replace(next); }
      })();
    </script>
    <script>
      /* Capgo fail-safe: notify as soon as the Capacitor bridge exists,
         even before the hashed React entry finishes downloading/parsing. */
      (function () {
        var tries = 0;
        function ping() {
          tries += 1;
          try {
            var Cap = self.Capacitor;
            if (!Cap || typeof Cap.isNativePlatform !== "function" || !Cap.isNativePlatform()) return;
            var plug = Cap.Plugins && Cap.Plugins.CapacitorUpdater;
            if (plug && typeof plug.notifyAppReady === "function") {
              Promise.resolve(plug.notifyAppReady()).catch(function () {});
              return;
            }
          } catch (e) {}
          if (tries < 40) setTimeout(ping, 250);
        }
        ping();
      })();
    </script>
  </head>
  <body class="h-full w-full max-w-[100vw] overflow-x-hidden bg-[#0A192F]" suppressHydrationWarning>
    <div id="thalvo-root">
      <div id="thalvo-boot">
        <div>
          <div class="dot"></div>
          <p style="margin:0;font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.7">THALVO MarineOS</p>
        </div>
      </div>
    </div>
    <script type="module" src="./assets/${entry}"></script>
  </body>
</html>
`;

writeFileSync(join(distDir, "index.html"), indexHtml);
console.log(`[spa] dist ready at ${distDir}`);
console.log(`[spa] assets from ${sourceDir}`);
console.log(`[spa] client entry ./assets/${entry}`);
