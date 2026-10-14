import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    target: "es2022",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("leaflet")) return "leaflet";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("i18next") || id.includes("react-i18next")) return "i18n";
          if (id.includes("@tanstack/react-router") || id.includes("@tanstack/router-core")) {
            return "router";
          }
          if (id.includes("@tanstack/react-query") || id.includes("@tanstack/query-core")) {
            return "query";
          }
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("/react-dom") || id.includes("/react/")) return "react-vendor";
        },
      },
    },
  },
  resolve: {
    alias: { "@": `${rootDir}src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      srcDirectory: "src",
      server: { entry: "server" },
      client: { entry: "client" },
    }),
    nitro({
      // Pin the Node preset so `VERCEL=1` does not switch Nitro to the
      // serverless output tree (no `.output/public`). Vercel still serves
      // the static `dist/` SPA from vercel.json.
      preset: "node-server",
      defaultPreset: "node-server",
    }),
    viteReact(),
  ],
});
