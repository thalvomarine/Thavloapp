#!/usr/bin/env node
/**
 * Capacitor `webDir` helper. Delegates to the shared static SPA assembler.
 * Never invoked from `npm run build` (Vercel). Use `npm run cap:prepare`
 * or `npm run cap:sync` / `npm run build:mobile` locally.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

if (process.env.VERCEL) {
  console.log("[capacitor] Skipping on Vercel — static SPA is assembled by prepare-web-spa.mjs.");
  process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [join(here, "prepare-web-spa.mjs")], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status === null ? 1 : result.status);
