import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { AlertOctagon, RefreshCcw, MapPin } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    // Carry the intended destination so /auth can return the visitor to it.
    // location.href is relative (path + search); /auth re-validates it.
    if (error || !data.user) throw redirect({ to: "/auth", search: { next: location.href } });
    return { user: data.user };
  },
  component: () => <Outlet />,
  errorComponent: AuthErrorBoundary,
});

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
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="thalvo-dark thalvo-cockpit min-h-dvh flex flex-col items-center justify-center px-6 text-center text-white"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(60% 40% at 50% 30%, rgba(244,63,94,0.15), transparent 70%)" }} />

      <div className="relative">
        <div className="mx-auto grid place-items-center size-20 rounded-3xl border border-rose-400/30 bg-rose-500/10 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
          <AlertOctagon className="size-8 text-rose-300" />
        </div>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.28em] text-rose-300/90">{t("shell.auth_error.eyebrow")}</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">{t("shell.auth_error.title")}</h1>
        <p className="mt-3 max-w-md mx-auto text-sm text-white/70">
          {t("shell.auth_error.body")}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center gap-2 rounded-full amber-gradient text-warning-foreground font-black uppercase tracking-[0.18em] px-6 h-11"
          >
            <RefreshCcw className="size-4" /> {t("shell.auth_error.retry")}
          </button>
          <Link
            to="/app"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-colors text-white font-semibold px-6 h-11"
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

