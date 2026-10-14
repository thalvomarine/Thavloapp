import { createFileRoute, Link, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { AlertOctagon, RefreshCcw, MapPin } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getValidUser } from "@/lib/auth-guard";
import { sanitizeNext } from "@/lib/nav";
import { MissionShell } from "@/components/mission/MissionShell";
import {
  cockpitFallbackProfile,
  recalledCockpitRole,
  useProfile,
  useSessionUser,
} from "@/lib/session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  staleTime: 60_000,
  beforeLoad: async ({ location }) => {
    const user = await getValidUser();
    // Carry the intended destination so /auth can return the visitor to it.
    // location.href is relative (path + search); /auth re-validates it.
    if (!user) {
      const next = sanitizeNext(location.href);
      throw redirect({ to: "/auth", search: next ? { next } : {} });
    }
    return { user };
  },
  component: AuthenticatedLayout,
  errorComponent: AuthErrorBoundary,
});

/**
 * Keep MissionShell mounted across /app/* navigations so the dock, SOS host,
 * and AI fab do not remount on every tab change (biggest transition cost).
 */
function AuthenticatedLayout() {
  const routeUser = Route.useRouteContext().user;
  const { user: sessionUser } = useSessionUser();
  const user = sessionUser ?? routeUser;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { profile } = useProfile(user?.id);

  if (!user) return null;

  const resolved =
    profile ?? cockpitFallbackProfile(user.id, recalledCockpitRole(user.id) ?? "Client");
  const onMapHome = path === "/app" || path === "/app/";
  const fullBleed =
    onMapHome && (resolved.role === "Client" || resolved.role === "Provider");

  return (
    <MissionShell profile={resolved} fullBleed={fullBleed}>
      <Outlet />
    </MissionShell>
  );
}

/**
 * MarineOS branded error boundary for every authenticated route.
 *
 * Any uncaught render/loader failure inside /_authenticated/* lands here.
 * Offers Retry (re-run loaders + reset boundary) and Return to Map so a
 * pilot user is never stranded on a raw stack trace.
 */
function AuthErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const { t } = useTranslation();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="thalvo-dark thalvo-cockpit flex min-h-dvh flex-col items-center justify-center px-6 text-center text-white"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: "radial-gradient(60% 40% at 50% 30%, rgba(244,63,94,0.15), transparent 70%)",
        }}
      />

      <div className="relative">
        <div className="mx-auto grid size-20 place-items-center rounded-3xl border border-rose-400/30 bg-rose-500/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <AlertOctagon className="size-8 text-rose-300" />
        </div>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.28em] text-rose-300/90">
          {t("shell.auth_error.eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          {t("shell.auth_error.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/70">{t("shell.auth_error.body")}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="amber-gradient inline-flex h-11 items-center gap-2 rounded-full px-6 font-black uppercase tracking-[0.18em] text-warning-foreground"
          >
            <RefreshCcw className="size-4" /> {t("shell.auth_error.retry")}
          </button>
          <Link
            to="/app"
            onClick={() => reset()}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 font-semibold text-white transition-colors hover:bg-white/10"
          >
            <MapPin className="size-4" /> {t("shell.auth_error.return_map")}
          </Link>
        </div>

        <p className="mt-10 text-[10px] uppercase tracking-[0.18em] text-white/40">
          {t("shell.auth_error.footer")}
        </p>
      </div>
    </div>
  );
}
