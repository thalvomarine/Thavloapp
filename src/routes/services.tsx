import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PublicBrowseShell } from "@/components/public/PublicBrowseShell";
import { ServicePackageCard } from "@/components/public/ServicePackageCard";
import { EmptyState } from "@/components/core/EmptyState";
import { Wrench } from "lucide-react";
import { fetchPublicPackages, usePublicData } from "@/lib/public-catalog";

export const Route = createFileRoute("/services")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Marine Service Packages | THALVO" },
      {
        name: "description",
        content:
          "See standard marine mechanic and professional diver service packages available across Aegean and Mediterranean marinas.",
      },
      { property: "og:title", content: "Marine Service Packages | THALVO" },
      {
        property: "og:description",
        content: "Marine mechanic and professional diver service packages with typical duration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicServices,
});

function PublicServices() {
  const { t } = useTranslation();
  const load = useCallback(() => fetchPublicPackages(), []);
  const { data: rows, error, reload } = usePublicData(load);

  return (
    <PublicBrowseShell
      active="services"
      next="/app/services"
      title={t("public.services_title", { defaultValue: "Service packages" })}
      subtitle={t("public.services_subtitle", {
        defaultValue: "Standard jobs with a fixed scope. Pricing is set by each provider.",
      })}
    >
      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          <p>{t("public.load_error")}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : rows === null ? (
        <div aria-busy="true">
          <div aria-hidden className="grid gap-2 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[84px] rounded-2xl border border-white/10 bg-white/[0.04] animate-pulse"
              />
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Wrench className="size-5" />}
          title={t("public.services_empty_title", { defaultValue: "No packages published yet" })}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((p) => (
            <ServicePackageCard
              key={p.id}
              pkg={p}
              actionSlot={
                <Link
                  to="/auth"
                  search={{ next: "/app/services" }}
                  className="h-9 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-900 text-[12px] font-semibold inline-flex items-center transition-colors"
                >
                  {t("public.sign_in_to_book")}
                </Link>
              }
            />
          ))}
        </div>
      )}
    </PublicBrowseShell>
  );
}
