import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { COVERAGE_BAYS, CoverageChart, type CoverageBayId } from "@/components/public/CoverageChart";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Wordmark } from "@/components/Wordmark";
import { fetchPublicPackages, fetchPublicParts, usePublicData } from "@/lib/public-catalog";
import { formatDm, formatMoney } from "@/lib/formatters";
import { getFix } from "@/lib/geolocation";
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
  const [own, setOwn] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const fix = own ?? COVERAGE_BAYS[bay];
  const position = formatDm(fix.lat, fix.lng);

  const locate = async () => {
    setLocating(true);
    setLocError(null);
    const res = await getFix();
    setLocating(false);
    if (res.ok) {
      setOwn({ lat: res.fix.lat, lng: res.fix.lng });
      return;
    }
    setLocError(t(res.failure.messageKey, { defaultValue: res.failure.defaultMessage }));
  };

  return (
    <div className="thalvo-dark flex h-dvh w-full flex-col overflow-hidden bg-[#06101c] text-white">
      <header className="z-[1100] shrink-0 border-b border-white/[0.08] bg-[#071422] pt-[env(safe-area-inset-top)]">
        <div className="flex h-11 items-center gap-3 px-3">
          <Link to="/" search={{ panel: undefined }} className="flex shrink-0 items-center gap-2">
            <Wordmark size="sm" className="text-white" decorative />
            <span className="thalvo-display text-[14px] tracking-[0.18em] text-white">THALVO</span>
          </Link>
          <p className="hidden truncate text-[11px] text-white/40 sm:block">{t("public.panel_kicker")}</p>
          <p className="thalvo-num hidden text-[12px] text-cyan-100/90 md:block">{position}</p>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher tone="dark" />
            <Link
              to="/auth"
              className="inline-flex h-8 items-center rounded-md bg-[#F5B942] px-3 text-[12px] font-semibold text-[#1A1406]"
            >
              {t("auth.sign_in")}
            </Link>
          </div>
        </div>
        <div className="flex items-end gap-1 px-2">
          {BAYS.map((id) => {
            const on = bay === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setOwn(null);
                  setBay(id);
                }}
                className={
                  "h-9 border-b-2 px-3 text-[13px] font-semibold " +
                  (on ? "border-cyan-300 text-white" : "border-transparent text-white/45")
                }
              >
                {t(`public.coverage_${id}`)}
              </button>
            );
          })}
          <p className="thalvo-num mb-2 ml-auto pr-2 text-[11px] text-cyan-100/80 md:hidden">{position}</p>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <CoverageChart bay={bay} fill own={own} />
        {!panel && (
          <button
            type="button"
            onClick={() => void locate()}
            disabled={locating}
            aria-label={t("chart.locate_me")}
            className="absolute right-3 top-3 z-[1100] grid size-11 place-items-center rounded-full border border-white/15 bg-[#071422]/92 text-[12px] text-cyan-100 disabled:opacity-60"
          >
            {locating ? "…" : "◎"}
          </button>
        )}
        {!panel && locError && (
          <p className="absolute left-3 right-16 top-3 z-[1100] rounded-md bg-[#071422]/92 px-3 py-2 text-[12px] text-amber-100">
            {locError}
          </p>
        )}

        {!panel && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[1100] flex items-end justify-between gap-3">
            <ul className="flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-[#071422]/88 px-2.5 py-1.5">
              {LEGEND.map((item) => (
                <li key={item.id} className="flex items-center gap-1.5 text-[11px] text-white/75">
                  <span className="size-1.5 rounded-full" style={{ background: item.color }} />
                  {t(`marine.kind_${item.id}`)}
                </li>
              ))}
            </ul>
            <div className="hidden shrink-0 gap-3 text-[11px] sm:flex">
              <Link to="/privacy" className="pointer-events-auto text-white/45 hover:text-white">
                {t("public.footer_privacy")}
              </Link>
              <Link to="/terms" className="pointer-events-auto text-white/45 hover:text-white">
                {t("public.footer_terms")}
              </Link>
            </div>
          </div>
        )}

        {panel === "parts" && <PartsPanel />}
        {panel === "services" && <ServicesPanel />}
      </div>

      <nav className="z-[1200] shrink-0 border-t border-white/[0.08] bg-[#071422] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid h-14 max-w-lg grid-cols-3">
          <DockLink panel={undefined} active={!panel} icon={<MapIcon className="size-4" />} label={t("nav.map")} />
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
        "flex h-full flex-col items-center justify-center gap-0.5 border-t-2 text-[11px] font-semibold " +
        (active ? "border-cyan-300 text-cyan-100" : "border-transparent text-white/50")
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
    <aside className="pointer-events-auto absolute z-[1100] flex flex-col overflow-hidden border border-white/10 bg-[#071422]/96 shadow-2xl backdrop-blur-xl max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[78%] max-lg:rounded-t-2xl lg:bottom-3 lg:left-3 lg:top-3 lg:w-[400px] lg:rounded-2xl">
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
      ) : data.length === 0 ? (
        <div className="px-1">
          <p className="text-[15px] font-semibold text-white">{t("public.parts_empty_title")}</p>
          <p className="mt-1.5 text-[13px] leading-snug text-white/55">{t("public.parts_empty_body")}</p>
        </div>
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
