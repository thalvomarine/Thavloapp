import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Navigation2, RefreshCw } from "lucide-react";
import { fetchMetocean, compassLabel, shelterStatus, type MetoceanSnapshot } from "@/lib/metocean";
import { publishCockpitContext } from "@/lib/ai-captain-context-bus";
import type { ChartRegion } from "@/components/map/ChartHud";

const WEATHER_REGIONS: Array<{ key: ChartRegion; lat: number; lng: number; labelKey: string }> = [
  { key: "aegean", lat: 37.15, lng: 27.2, labelKey: "chart.jump_aegean" },
  { key: "mediterranean", lat: 36.35, lng: 29.1, labelKey: "chart.jump_mediterranean" },
];

const REFRESH_MS = 10 * 60_000;

/**
 * Instant sea-state widget — Quiet Glass (B): three-column telemetry,
 * soft borders, calm title. Phones collapse to a chip.
 */
export function MetoceanHud() {
  const { t } = useTranslation();
  const [region, setRegion] = useState<ChartRegion>("aegean");
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
  const windKts = snapshot ? `${Math.round(snapshot.windSpeedKts)} kts` : "—";
  const windDir = snapshot ? compassLabel(snapshot.windDirectionDeg) : "";
  const windLabel = snapshot ? `${windKts} ${windDir}`.trim() : "—";
  const waveLabel = snapshot?.waveHeightM != null ? `${snapshot.waveHeightM.toFixed(1)} m` : "—";
  const pressureLabel =
    snapshot && Number.isFinite(snapshot.pressureHpa)
      ? `${Math.round(snapshot.pressureHpa)}`
      : "—";

  const panel = (
    <div className="w-[232px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-white/12 bg-[#0a192f]/90 text-xs shadow-2xl backdrop-blur-md">
      <div className="p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-[12px] font-semibold text-white">
              {t("chart.metocean_title_short")}
            </p>
            <button
              type="button"
              onClick={() => {
                setRegion((r) => (r === "aegean" ? "mediterranean" : "aegean"));
              }}
              title={t("chart.metocean_switch_region")}
              className="shrink-0 rounded-full border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[9px] font-semibold text-white/70 hover:bg-white/[0.1] hover:text-white"
            >
              {regionLabel}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setRegion((r) => (r === "aegean" ? "mediterranean" : "aegean"));
            }}
            title={t("chart.metocean_switch_region")}
            className="grid size-6 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white/90"
          >
            <RefreshCw className={"size-2.5 " + (loading ? "animate-spin" : "")} />
          </button>
        </div>

        {failed && !snapshot ? (
          <p className="mt-2.5 text-[10px] text-white/40">{t("chart.metocean_unavailable")}</p>
        ) : (
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {(
              [
                [t("chart.metocean_wind"), windKts, windDir],
                [t("chart.metocean_wave"), waveLabel, ""],
                [t("chart.metocean_pressure"), pressureLabel, snapshot ? "hPa" : ""],
              ] as const
            ).map(([label, value, sub]) => (
              <div
                key={label}
                className="rounded-xl bg-white/[0.05] px-1.5 py-2 text-center"
              >
                <div className="truncate text-[9px] text-white/45">{label}</div>
                <div className="mt-0.5 truncate text-[12px] font-semibold tabular-nums text-white">
                  {value}
                </div>
                {sub ? (
                  <div className="mt-0.5 truncate text-[9px] text-white/40">{sub}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {shelter && (
          <p className="mt-2 truncate text-[10px] text-white/45">
            {t("chart.metocean_shelter_label")}:{" "}
            <span
              className={
                shelter.sheltered ? "font-medium text-emerald-200/90" : "font-medium text-amber-200/90"
              }
            >
              {t(shelter.labelKey)}
            </span>
            {windDir ? <span className="text-white/35"> · {windDir}</span> : null}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
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
            className="flex max-w-[min(220px,calc(100vw-5.5rem))] items-center gap-1.5 rounded-xl border border-white/12 bg-[#0a192f]/90 px-2.5 py-1.5 shadow-2xl backdrop-blur-md"
          >
            <Navigation2 className="size-3 shrink-0 text-cyan-300" />
            <span className="truncate font-mono text-[10px] tabular-nums text-white/90">
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
