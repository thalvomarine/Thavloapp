import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import appCss from "../styles.css?url";
import "../i18n";
import { Toaster } from "sonner";
import { stripVendorBadge } from "@/lib/strip-vendor-badge";
import { NetworkStatusBanner } from "@/components/pwa/NetworkStatusBanner";
import { initNativeShell } from "@/lib/native";
import { registerPwa } from "@/lib/pwa-register";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-deep px-4 text-white">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black tracking-tight">404</h1>
        <p className="mt-4 opacity-80">{t("shell.not_found.body")}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full amber-gradient text-warning-foreground px-6 py-3 font-bold"
        >
          {t("shell.not_found.cta")}
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useTranslation();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">{t("shell.error.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("shell.error.body")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full marine-gradient text-white px-5 py-2.5 font-medium"
          >
            {t("shell.error.retry")}
          </button>
          <a
            href="/"
            className="rounded-full border border-input bg-background px-5 py-2.5 font-medium"
          >
            {t("shell.error.home")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "viewport-fit=cover, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
      },
      { title: "THALVO | Güvenli Seyir, Anında Müdahale" },
      {
        name: "description",
        content:
          "THALVO | Safe Voyage, Instant Response — certified marine mechanics and professional divers on demand across Göcek, Bodrum and Marmaris.",
      },
      { name: "theme-color", content: "#0A192F" },
      { name: "color-scheme", content: "dark" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "THALVO" },
      { name: "application-name", content: "THALVO" },
      { name: "format-detection", content: "telephone=no" },
      { name: "msapplication-TileColor", content: "#0A192F" },
      { property: "og:title", content: "THALVO | Safe Voyage, Instant Response" },
      {
        property: "og:description",
        content:
          "Certified marine mechanics and professional divers on demand across the Aegean and Mediterranean.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "THALVO" },
      { name: "twitter:card", content: "summary_large_image" },
    ],

    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "192x192", href: "/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "512x512", href: "/icon-512.png" },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", type: "image/png", sizes: "180x180", href: "/favicon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className="h-full w-full max-w-[100vw] overflow-x-hidden bg-[#0A192F]">
      <head>
        <HeadContent />
      </head>
      <body className="h-full w-full max-w-[100vw] overflow-x-hidden bg-[#0A192F]">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    void initNativeShell();
    void registerPwa();
    stripVendorBadge();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <NetworkStatusBanner />
      {/* Root route container: a bounded width + own overflow clip so a
          runaway descendant (e.g. an `overflow-x-auto` tab strip nested in
          a flex ancestor without `min-w-0`) can never stretch the whole
          document horizontally — see also the html/body safeguard in
          styles.css. */}
      <div className="w-full max-w-[100vw] overflow-x-hidden">
        <Outlet />
      </div>
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
