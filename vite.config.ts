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
    }),
    nitro({
      defaultPreset: "node-server",
    }),
    viteReact(),
  ],
});
