import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Navigation2, RefreshCw, Waves } from "lucide-react";
import { fetchMetocean, compassLabel, shelterStatus, type MetoceanSnapshot } from "@/lib/metocean";
import { publishCockpitContext } from "@/lib/ai-captain-context-bus";
import type { ChartRegion } from "@/components/map/ChartHud";

const WEATHER_REGIONS: Array<{ key: ChartRegion; lat: number; lng: number; labelKey: string }> = [
  { key: "gocek", lat: 36.7525, lng: 28.9428, labelKey: "chart.jump_gocek" },
  { key: "marmaris", lat: 36.8525, lng: 28.278, labelKey: "chart.jump_marmaris" },
];

const REFRESH_MS = 10 * 60_000;

/**
 * Instant sea-state widget. Desktop keeps the full panel; phones collapse
 * it to a single chip so it doesn't stack under the search bar and eat
 * the chart. Tap the chip to expand.
 */
export function MetoceanHud() {
  const { t } = useTranslation();
  const [region, setRegion] = useState<ChartRegion>("gocek");
  const [snapshot, setSnapshot] = useState<MetoceanSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const target = WEATHER_REGIONS.find((r) => r.key === region) ?? WEATHER_REGIONS[0];
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      try {
        const snap = await fetchMetocean(target.lat, target.lng, controller.signal);
        if (!cancelled) {
          setSnapshot(snap);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const interval = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [region]);

  useEffect(() => {
    if (!snapshot || !Number.isFinite(snapshot.windSpeedKts)) return;
    publishCockpitContext({
      weather: {
        windKts: snapshot.windSpeedKts,
        windDeg: snapshot.windDirectionDeg,
        windFrom: compassLabel(snapshot.windDirectionDeg),
        waveM: snapshot.waveHeightM,
        pressureHpa: snapshot.pressureHpa,
      },
    });
  }, [snapshot]);

  const shelter = snapshot ? shelterStatus(region, snapshot.windDirectionDeg) : null;
  const regionLabel = t(
    WEATHER_REGIONS.find((r) => r.key === region)?.labelKey ?? "chart.jump_gocek",
  );
  const windLabel = snapshot
    ? `${Math.round(snapshot.windSpeedKts)} kts ${compassLabel(snapshot.windDirectionDeg)}`
    : "—";
  const waveLabel = snapshot?.waveHeightM != null ? `${snapshot.waveHeightM.toFixed(1)}m` : "—";

  const panel = (
    <div className="w-[206px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-cyan-500/30 bg-[#0a192f]/90 text-xs shadow-2xl backdrop-blur-md">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
      <div className="p-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <p className="min-w-0 flex-1 truncate text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-cyan-200/90">
            {t("chart.metocean_title")}
          </p>
          <button
            type="button"
            onClick={() => {
              setRegion((r) => (r === "gocek" ? "marmaris" : "gocek"));
            }}
            title={t("chart.metocean_switch_region")}
            className="grid size-5 shrink-0 place-items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/25"
          >
            <RefreshCw className={"size-2.5 " + (loading ? "animate-spin" : "")} />
          </button>
        </div>

        <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {regionLabel}
        </p>

        {failed && !snapshot ? (
          <p className="mt-2 text-[10px] text-white/40">{t("chart.metocean_unavailable")}</p>
        ) : (
          <div className="mt-2 space-y-1.5 font-mono">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-white/40">
                <Navigation2 className="size-2.5 text-cyan-300/80" />
                {t("chart.metocean_wind")}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-cyan-100">
                {snapshot ? (
                  <Navigation2
                    className="size-3 text-cyan-300"
                    style={{ transform: `rotate(${snapshot.windDirectionDeg}deg)` }}
                  />
                ) : null}
                {windLabel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-white/40">
                <Waves className="size-2.5 text-cyan-300/80" />
                {t("chart.metocean_wave")}
              </span>
              <span className="text-[11px] text-cyan-100">{waveLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.1em] text-white/40">
                {t("chart.metocean_pressure")}
              </span>
              <span className="text-[11px] text-cyan-100">
                {snapshot && Number.isFinite(snapshot.pressureHpa)
                  ? `${Math.round(snapshot.pressureHpa)} hPa`
                  : "—"}
              </span>
            </div>
          </div>
        )}

        {shelter && (
          <p
            className={
              "mt-2 truncate rounded-full border px-2 py-1 text-center text-[9px] font-bold uppercase tracking-[0.08em] " +
              (shelter.sheltered
                ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
                : "border-amber-400/40 bg-amber-400/15 text-amber-100")
            }
          >
            {t(shelter.labelKey)}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Phone: collapsed chip, tap to expand the full panel. */}
      <div className="sm:hidden">
        {expanded ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label={t("common.close")}
              className="absolute -right-1 -top-1 z-10 grid size-5 place-items-center rounded-full border border-white/15 bg-[#0a192f] text-white/70"
            >
              <ChevronDown className="size-3 rotate-180" />
            </button>
            {panel}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={false}
            title={t("chart.metocean_title")}
            className="flex max-w-[min(220px,calc(100vw-5.5rem))] items-center gap-1.5 rounded-full border border-cyan-500/30 bg-[#0a192f]/90 px-2.5 py-1 shadow-2xl backdrop-blur-md"
          >
            <Navigation2 className="size-3 shrink-0 text-cyan-300" />
            <span className="truncate font-mono text-[10px] text-cyan-100">
              {failed && !snapshot
                ? t("chart.metocean_unavailable")
                : `${windLabel} · ${waveLabel}`}
            </span>
            {shelter && (
              <span
                className={
                  "size-1.5 shrink-0 rounded-full " +
                  (shelter.sheltered ? "bg-emerald-400" : "bg-amber-400")
                }
              />
            )}
          </button>
        )}
      </div>

      <div className="hidden sm:block">{panel}</div>
    </>
  );
}
