import { createFileRoute, Link } from "@tanstack/react-router";
import { WifiOff, Compass, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/offline")({
  ssr: false,
  component: OfflinePage,
  head: () => ({
    meta: [
      { title: "Offline — THALVO" },
      { name: "description", content: "You are currently offline. THALVO is waiting for your signal." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function OfflinePage() {
  const { t } = useTranslation();
  return (
    <div className="thalvo-dark thalvo-cockpit min-h-dvh flex flex-col items-center justify-center text-white px-6 text-center"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(60% 40% at 50% 30%, rgba(0,180,216,0.18), transparent 70%)" }} />

      <div className="relative">
        <div className="mx-auto grid place-items-center size-20 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
          <WifiOff className="size-8 text-sky-300" />
        </div>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-300/80">{t("offline.eyebrow")}</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">{t("offline.title")}</h1>
        <p className="mt-3 max-w-md mx-auto text-sm text-white/70">
          {t("offline.body")}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-full amber-gradient text-warning-foreground font-black uppercase tracking-[0.18em] px-6 h-11"
          >
            <RefreshCcw className="size-4" /> {t("offline.retry")}
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-colors text-white font-semibold px-6 h-11"
          >
            <Compass className="size-4" /> {t("offline.back")}
          </Link>
        </div>

        <p className="mt-10 text-[10px] uppercase tracking-[0.18em] text-white/40">
          {t("offline.footer")}
        </p>
      </div>
    </div>
  );
}
