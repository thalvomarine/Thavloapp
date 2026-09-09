import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PublicBrowseShell } from "@/components/public/PublicBrowseShell";
import { PartCard } from "@/components/marketplace/PartCard";
import { EmptyState } from "@/components/core/EmptyState";
import { PackageSearch } from "lucide-react";
import { formatMoney } from "@/lib/formatters";
import { fetchPublicParts, toPartCardData, usePublicData } from "@/lib/public-catalog";

export const Route = createFileRoute("/marketplace")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Marine Spare Parts Marketplace | THALVO" },
      {
        name: "description",
        content:
          "Browse verified marine spare parts from Aegean and Mediterranean dealers — engine, hull, electrical and diving equipment with live stock.",
      },
      { property: "og:title", content: "Marine Spare Parts Marketplace | THALVO" },
      {
        property: "og:description",
        content:
          "Verified marine spare parts with live stock from Aegean and Mediterranean dealers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicMarketplace,
});

function PublicMarketplace() {
  const { t } = useTranslation();
  const load = useCallback(() => fetchPublicParts({ limit: 60 }), []);
  const { data: rows, error, reload } = usePublicData(load);

  return (
    <PublicBrowseShell
      active="parts"
      next="/app/shop"
      title={t("public.parts_title", { defaultValue: "Marine spare parts" })}
      subtitle={t("public.parts_subtitle", {
        defaultValue: "Live dealer stock across Aegean and Mediterranean marinas.",
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
          <div aria-hidden className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[140px] rounded-2xl border border-white/10 bg-white/[0.04] animate-pulse"
              />
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="size-5" />}
          title={t("public.parts_empty_title", { defaultValue: "No parts listed yet" })}
          body={t("public.parts_empty_body", {
            defaultValue: "Verified dealers are still onboarding. Check back soon.",
          })}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <PartCard
              key={r.id}
              part={toPartCardData(r, (c) => t(`marketplace.category.${c}`, { defaultValue: c }))}
              currencyFormat={(n) => formatMoney(n)}
              actionSlot={
                <Link
                  to="/auth"
                  search={{ next: "/app/shop" }}
                  className="flex-1 h-11 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-900 text-[13px] font-semibold tracking-tight transition-colors inline-flex items-center justify-center"
                >
                  {t("public.sign_in_to_order")}
                </Link>
              }
            />
          ))}
        </div>
      )}
    </PublicBrowseShell>
  );
}
