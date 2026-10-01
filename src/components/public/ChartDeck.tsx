import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CoverageChart, type CoverageBayId } from "@/components/public/CoverageChart";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Wordmark } from "@/components/Wordmark";
import { fetchPublicPackages, fetchPublicParts, usePublicData } from "@/lib/public-catalog";
import { formatMoney } from "@/lib/formatters";
import { sanitizeNext } from "@/lib/nav";
import { Map as MapIcon, ShoppingBag, Wrench, X } from "lucide-react";

export type ChartPanel = "parts" | "services";

const BAYS: CoverageBayId[] = ["gocek", "marmaris", "bodrum"];
const NEXT_SHOP = sanitizeNext("/app/shop");
const NEXT_SERVICES = sanitizeNext("/app/services");

const SHELVES = [
  { id: "engine", test: /filter|oil|impeller|belt|engine|motor|yağ|kayış|fuel/i },
  { id: "electrical", test: /electric|battery|akü|elektrik|light/i },
  { id: "hull", test: /anode|hull|zinc|karina|anot|tutya|antifoul/i },
  { id: "safety", test: /safety|fire|life|güvenlik|can|flare/i },
] as const;

const LEGEND = [
  { id: "marina", color: "#22d3ee" },
  { id: "anchorage", color: "#fbbf24" },
  { id: "fuel", color: "#34d399" },
  { id: "hazard", color: "#fb7185" },
] as const;

export function ChartDeck({ panel }: { panel?: ChartPanel }) {
  const { t } = useTranslation();
  const [bay, setBay] = useState<CoverageBayId>("gocek");

  return (
    <div className="thalvo-dark relative h-dvh w-full overflow-hidden bg-[#0A192F] text-white">
      <CoverageChart bay={bay} fill />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex items-start justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          to="/"
          search={{ panel: undefined }}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#071422]/85 py-1 pl-1.5 pr-3 shadow-2xl backdrop-blur-md"
        >
          <Wordmark size="sm" className="text-white" decorative />
          <span className="thalvo-display text-[15px] tracking-[0.14em] text-white">THALVO</span>
        </Link>
        <div className="pointer-events-auto flex items-center gap-2">
          <LanguageSwitcher tone="dark" />
          <Link
            to="/auth"
            className="inline-flex h-9 items-center rounded-full bg-[#F5B942] px-4 text-xs font-semibold text-[#1A1406]"
          >
            {t("auth.sign_in")}
          </Link>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+3.6rem)] z-[1100] flex justify-center px-3">
        <div className="pointer-events-auto flex gap-1 rounded-full border border-white/10 bg-[#071422]/85 p-1 shadow-2xl backdrop-blur-md">
          {BAYS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setBay(id)}
              className={
                "h-8 rounded-full px-3 text-xs font-semibold " +
                (bay === id ? "bg-cyan-400/20 text-cyan-100" : "text-white/65")
              }
            >
              {t(`public.coverage_${id}`)}
            </button>
          ))}
        </div>
      </div>

      {!panel && (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+5.4rem)] left-3 z-[1100] hidden lg:block">
          <div className="pointer-events-auto w-52 rounded-2xl border border-white/10 bg-[#071422]/88 p-3 shadow-2xl backdrop-blur-md">
            <p className="thalvo-display text-[13px] tracking-[0.16em] text-white/80">
              {t("public.legend_title")}
            </p>
            <ul className="mt-2 space-y-1.5">
              {LEGEND.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-[12px] text-white/75">
                  <span className="size-2 rounded-full" style={{ background: item.color }} />
                  {t(`marine.kind_${item.id}`)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-snug text-white/45">{t("public.coverage_note")}</p>
            <div className="mt-2 flex gap-3 text-[11px]">
              <Link to="/privacy" className="text-white/50 hover:text-white">
                {t("public.footer_privacy")}
              </Link>
              <Link to="/terms" className="text-white/50 hover:text-white">
                {t("public.footer_terms")}
              </Link>
            </div>
          </div>
        </div>
      )}

      {panel === "parts" && <PartsPanel />}
      {panel === "services" && <ServicesPanel />}

      <nav
        className="pointer-events-none fixed inset-x-0 z-[1200]"
        style={{ bottom: "max(0.85rem, env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-auto mx-auto w-full max-w-lg px-3">
          <div className="grid h-14 grid-cols-3 items-center rounded-full border border-white/10 bg-[#071422]/92 px-1 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.75)] backdrop-blur-xl">
            <DockLink
              panel={undefined}
              active={!panel}
              icon={<MapIcon className="size-4" />}
              label={t("nav.map")}
            />
            <DockLink
              panel="parts"
              active={panel === "parts"}
              icon={<ShoppingBag className="size-4" />}
              label={t("public.tab_parts")}
            />
            <DockLink
              panel="services"
              active={panel === "services"}
              icon={<Wrench className="size-4" />}
              label={t("public.tab_services")}
            />
          </div>
        </div>
      </nav>
    </div>
  );
}

function DockLink({
  panel,
  active,
  icon,
  label,
}: {
  panel?: ChartPanel;
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      to="/"
      search={{ panel }}
      className={
        "flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide " +
        (active ? "text-cyan-200" : "text-white/60")
      }
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function PanelFrame({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <aside className="pointer-events-auto z-[1100] flex flex-col overflow-hidden border border-white/10 bg-[#071422]/94 shadow-2xl backdrop-blur-xl max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(env(safe-area-inset-bottom)+4.6rem)] max-lg:max-h-[min(72dvh,680px)] max-lg:rounded-t-[28px] lg:absolute lg:bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:left-3 lg:top-[calc(env(safe-area-inset-top)+4.8rem)] lg:w-[420px] lg:rounded-[28px]">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">{kicker}</p>
          <h1 className="thalvo-display mt-1 text-[28px] leading-none text-white">{title}</h1>
        </div>
        <Link
          to="/"
          search={{ panel: undefined }}
          aria-label={t("common.close")}
          className="grid size-9 place-items-center rounded-full border border-white/10 text-white/70 hover:bg-white/10"
        >
          <X className="size-4" />
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
    </aside>
  );
}

function ServicesPanel() {
  const { t, i18n } = useTranslation();
  const load = useMemo(() => () => fetchPublicPackages(), []);
  const { data, error, reload } = usePublicData(load);
  const isTr = i18n.language.startsWith("tr");

  return (
    <PanelFrame title={t("public.services_title")} kicker={t("public.panel_kicker")}>
      <p className="mb-3 px-1 text-[13px] leading-snug text-white/55">{t("public.services_subtitle")}</p>
      {error ? (
        <Retry onRetry={reload} />
      ) : data === null ? (
        <Skeleton rows={4} />
      ) : data.length === 0 ? (
        <p className="px-1 text-sm text-white/60">{t("public.services_empty_title")}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((pkg) => {
            const scope = t(`public.scope_${pkg.key}`, { defaultValue: "" });
            return (
              <li key={pkg.id}>
                <Link
                  to="/auth"
                  search={NEXT_SERVICES ? { next: NEXT_SERVICES } : {}}
                  className="block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 transition-colors hover:border-cyan-300/30 hover:bg-white/[0.06]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[15px] font-semibold text-white">
                      {t(`packages.${pkg.key}`, {
                        defaultValue: isTr ? pkg.title_tr : pkg.title_en,
                      })}
                    </p>
                    {pkg.base_duration_min != null && (
                      <p className="thalvo-num shrink-0 text-[12px] text-cyan-100/80">
                        {t("public.duration_min", { count: pkg.base_duration_min })}
                      </p>
                    )}
                  </div>
                  {scope ? <p className="mt-1.5 text-[13px] leading-snug text-white/55">{scope}</p> : null}
                  <p className="mt-2 text-[11px] tracking-wide text-white/40">{t("public.price_on_request")}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PanelFrame>
  );
}

function PartsPanel() {
  const { t } = useTranslation();
  const load = useMemo(() => () => fetchPublicParts({ limit: 60 }), []);
  const { data, error, reload } = usePublicData(load);

  const grouped = useMemo(() => {
    const buckets = new Map<string, NonNullable<typeof data>>();
    for (const shelf of SHELVES) buckets.set(shelf.id, []);
    const other: NonNullable<typeof data> = [];
    for (const row of data ?? []) {
      const hay = `${row.category} ${row.name}`;
      const shelf = SHELVES.find((s) => s.test.test(hay));
      if (shelf) buckets.get(shelf.id)?.push(row);
      else other.push(row);
    }
    return { buckets, other };
  }, [data]);

  return (
    <PanelFrame title={t("public.parts_title")} kicker={t("public.panel_kicker")}>
      <p className="mb-3 px-1 text-[13px] leading-snug text-white/55">{t("public.parts_subtitle")}</p>
      {error ? (
        <Retry onRetry={reload} />
      ) : data === null ? (
        <Skeleton rows={4} />
      ) : (
        <div className="space-y-4">
          {SHELVES.map((shelf) => {
            const rows = grouped.buckets.get(shelf.id) ?? [];
            return (
              <section key={shelf.id}>
                <h2 className="thalvo-display px-1 text-[18px] tracking-wide text-white/90">
                  {t(`public.shelf_${shelf.id}`)}
                </h2>
                {rows.length === 0 ? (
                  <p className="mt-1 px-1 text-[12px] text-white/40">{t("public.shelf_empty")}</p>
                ) : (
                  <ul className="mt-1.5 space-y-1.5">
                    {rows.map((row) => (
                      <li key={row.id}>
                        <Link
                          to="/auth"
                          search={NEXT_SHOP ? { next: NEXT_SHOP } : {}}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 hover:border-cyan-300/30"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-medium text-white">{row.name}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-white/45">
                              {[row.brand, row.marina].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="thalvo-num block text-[13px] text-white">
                              {formatMoney(row.price)}
                            </span>
                            <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-white/40">
                              {t(
                                row.stock_band === "out"
                                  ? "public.stock_out"
                                  : row.stock_band === "low"
                                    ? "public.stock_low"
                                    : "public.stock_in",
                              )}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          {grouped.other.length > 0 && (
            <section>
              <h2 className="thalvo-display px-1 text-[18px] tracking-wide text-white/90">
                {t("public.shelf_other")}
              </h2>
              <ul className="mt-1.5 space-y-1.5">
                {grouped.other.map((row) => (
                  <li key={row.id}>
                    <Link
                      to="/auth"
                      search={NEXT_SHOP ? { next: NEXT_SHOP } : {}}
                      className="block rounded-xl border border-white/10 px-3 py-2.5 text-[14px] text-white"
                    >
                      {row.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </PanelFrame>
  );
}

function Retry({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
      <p>{t("public.load_error")}</p>
      <button type="button" onClick={onRetry} className="mt-3 text-xs font-semibold text-white underline">
        {t("common.retry")}
      </button>
    </div>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy="true" className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
      ))}
    </div>
  );
}
