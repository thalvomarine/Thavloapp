import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/Wordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PartCard } from "@/components/marketplace/PartCard";
import { ServicePackageCard } from "@/components/public/ServicePackageCard";
import { EmptyState } from "@/components/core/EmptyState";
import { formatMoney } from "@/lib/formatters";
import { sanitizeNext } from "@/lib/nav";
import {
  fetchPublicPackages,
  fetchPublicParts,
  toPartCardData,
  usePublicData,
} from "@/lib/public-catalog";
import { SeaBackdrop } from "@/components/brand/SeaBackdrop";
import {
  ArrowRight,
  ChevronDown,
  MapPin,
  PackageSearch,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Wrench,
} from "lucide-react";

const TITLE = "THALVO — Marine parts, service and escrow in one place";
const DESCRIPTION =
  "Browse marine spare parts and service packages, book a verified technician, pay through escrow and keep a full boat passport. No sign-in needed to look around.";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: Landing,
});

const NEXT_SHOP = sanitizeNext("/app/shop");
const NEXT_SERVICES = sanitizeNext("/app/services");

/**
 * The six capabilities below all map to shipped surfaces in this codebase.
 * Do not add a seventh that the product cannot back up.
 */
const FEATURES: {
  key: string;
  icon: ComponentType<{ className?: string }>;
  /** Placement around the crest on large viewports only. */
  pos: string;
}[] = [
  { key: "parts", icon: ShoppingBag, pos: "lg:left-0 lg:top-[6%]" },
  { key: "services", icon: Wrench, pos: "lg:right-0 lg:top-[6%]" },
  { key: "escrow", icon: ShieldCheck, pos: "lg:left-0 lg:top-[42%]" },
  { key: "tracking", icon: MapPin, pos: "lg:right-0 lg:top-[42%]" },
  { key: "passport", icon: ScrollText, pos: "lg:left-[6%] lg:bottom-[6%]" },
  { key: "trust", icon: ShieldCheck, pos: "lg:right-[6%] lg:bottom-[6%]" },
];

function SectionHead({ title, to, label }: { title: string; to: string; label: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-base font-black text-[color:var(--pm-text)]">{title}</h2>
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--pm-gold)] hover:underline"
      >
        {label} <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
      <p>{t("public.load_error")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
      >
        {t("common.retry")}
      </button>
    </div>
  );
}

function Skeletons({ height, count }: { height: string; count: number }) {
  return (
    <div aria-busy="true">
      <div aria-hidden className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={`${height} rounded-2xl border border-white/10 bg-white/[0.05] animate-pulse`}
          />
        ))}
      </div>
    </div>
  );
}

function Hero() {
  const { t } = useTranslation();
  return (
    <section className="relative min-h-[calc(100dvh-4.5rem)] flex flex-col items-center justify-center px-5 pb-14 pt-4">
      <SeaBackdrop variant="chart" fadeBottom className="h-full" />

      <div className="relative z-10 w-full max-w-5xl">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--pm-gold)]">
          {t("public.hero_kicker")}
        </p>

        {/* The crest artwork is cream-on-navy — it must always sit on this dark surface. */}
        <div className="mt-4 flex justify-center">
          <Wordmark size="xl" />
        </div>

        <h1 className="mt-5 text-center text-2xl sm:text-3xl font-black leading-tight text-[color:var(--pm-text)]">
          {t("public.hero_headline")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[color:var(--pm-platinum)]">
          {t("public.hero_sub")}
        </p>

        <h2 className="sr-only">{t("public.features_label")}</h2>
        <ul className="relative mt-8 grid gap-2.5 sm:grid-cols-2 lg:mt-14 lg:block lg:min-h-[340px]">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <li
                key={f.key}
                className={`pm-balloon pm-balloon-${i} pm-panel rounded-2xl px-3.5 py-3 lg:absolute lg:w-[15.5rem] ${f.pos}`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-[color:var(--pm-gold)]/15 text-[color:var(--pm-gold)]">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[color:var(--pm-text)]">
                      {t(`public.feature_${f.key}_title`)}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-[color:var(--pm-platinum)]">
                      {t(`public.feature_${f.key}_desc`)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="pm-scroll-hint relative z-10 mt-10 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-[color:var(--pm-platinum)]">
        {t("public.scroll_hint")}
        <ChevronDown className="size-3.5" aria-hidden />
      </p>
    </section>
  );
}

function Landing() {
  const { t } = useTranslation();

  const loadParts = useCallback(() => fetchPublicParts({ limit: 6, dealerOnly: true }), []);
  const loadPackages = useCallback(() => fetchPublicPackages({ limit: 6 }), []);
  const parts = usePublicData(loadParts);
  const packages = usePublicData(loadPackages);

  let partsBody: ReactNode;
  if (parts.error) partsBody = <LoadError onRetry={parts.reload} />;
  else if (parts.data === null) partsBody = <Skeletons height="h-[140px]" count={2} />;
  else if (parts.data.length === 0)
    partsBody = (
      <EmptyState
        icon={<PackageSearch className="size-5" />}
        title={t("public.parts_empty_title")}
        body={t("public.parts_empty_body")}
      />
    );
  else
    partsBody = (
      <div className="grid gap-3 sm:grid-cols-2">
        {parts.data.map((r) => (
          <PartCard
            key={r.id}
            part={toPartCardData(r, (c) => t(`marketplace.category.${c}`, { defaultValue: c }))}
            currencyFormat={(n) => formatMoney(n)}
            actionSlot={
              <Link
                to="/auth"
                search={NEXT_SHOP ? { next: NEXT_SHOP } : undefined}
                className="pm-gold-cta flex-1 h-11 rounded-xl text-[13px] font-bold inline-flex items-center justify-center transition-opacity hover:opacity-90"
              >
                {t("public.sign_in_to_order")}
              </Link>
            }
          />
        ))}
      </div>
    );

  let servicesBody: ReactNode;
  if (packages.error) servicesBody = <LoadError onRetry={packages.reload} />;
  else if (packages.data === null) servicesBody = <Skeletons height="h-[84px]" count={4} />;
  else if (packages.data.length === 0)
    servicesBody = (
      <EmptyState icon={<Wrench className="size-5" />} title={t("public.services_empty_title")} />
    );
  else
    servicesBody = (
      <div className="grid gap-2 sm:grid-cols-2">
        {packages.data.map((p) => (
          <ServicePackageCard
            key={p.id}
            pkg={p}
            actionSlot={
              <Link
                to="/auth"
                search={NEXT_SERVICES ? { next: NEXT_SERVICES } : undefined}
                className="pm-gold-cta h-9 px-3 rounded-xl text-[12px] font-bold inline-flex items-center transition-opacity hover:opacity-90"
              >
                {t("public.sign_in_to_book")}
              </Link>
            }
          />
        ))}
      </div>
    );

  return (
    <div className="thalvo-premium thalvo-dark relative min-h-dvh flex flex-col overflow-x-hidden">
      <header className="relative z-20 flex items-center justify-between gap-3 px-5 pt-5">
        <Wordmark size="sm" />

        <div className="flex items-center gap-2">
          <LanguageSwitcher tone="dark" />
          <Link
            to="/auth"
            className="h-9 px-4 rounded-full border border-[color:var(--pm-gold)]/40 bg-white/5 hover:bg-white/10 text-xs font-semibold text-[color:var(--pm-gold)] inline-flex items-center"
          >
            {t("auth.sign_in")}
          </Link>
        </div>
      </header>

      <Hero />

      <main className="relative z-10 flex-1 w-full max-w-3xl mx-auto px-5 pt-2 pb-10 space-y-7">
        <section className="space-y-3">
          <SectionHead
            title={t("public.home_parts_heading")}
            to="/marketplace"
            label={t("public.see_all")}
          />
          {partsBody}
        </section>

        <section className="space-y-3">
          <SectionHead
            title={t("public.home_services_heading")}
            to="/services"
            label={t("public.see_all")}
          />
          {servicesBody}
        </section>

        <p className="text-xs text-[color:var(--pm-platinum)]">{t("public.home_note")}</p>
      </main>

      <footer className="relative z-10 text-center text-[11px] text-[color:var(--pm-platinum)]/70 py-6">
        © THALVO · {t("brand.tagline")}
      </footer>
    </div>
  );
}
