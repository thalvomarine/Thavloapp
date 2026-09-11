/**
 * Deep Navy Route Deck — NM / ETA / speed dial / legs / lock controls.
 */

import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  Lock,
  Navigation2,
  Plus,
  RotateCcw,
  Unlock,
} from "lucide-react";
import { ROUTE_SPEED_OPTIONS_KTS, type SeaRouteLeg } from "@/lib/sea-route";

type Props = {
  distanceNm: number;
  etaMinutes: number | null;
  speedKts: number;
  legs: SeaRouteLeg[];
  optimizing: boolean;
  locked: boolean;
  onSpeed: (kts: number) => void;
  onReset: () => void;
  onAddVia: () => void;
  onLock: () => void;
  onUnlock: () => void;
};

function formatEta(min: number | null, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (min == null || !Number.isFinite(min)) return "—";
  const total = Math.max(1, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return t("chart.route_deck_eta_min", { min: m });
  return t("chart.route_deck_eta_hm", { h, m });
}

export const RouteDeck = memo(function RouteDeck({
  distanceNm,
  etaMinutes,
  speedKts,
  legs,
  optimizing,
  locked,
  onSpeed,
  onReset,
  onAddVia,
  onLock,
  onUnlock,
}: Props) {
  const { t } = useTranslation();
  const [legsOpen, setLegsOpen] = useState(false);

  return (
    <div className="pointer-events-auto w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#0B1528]/90 shadow-2xl shadow-cyan-950/40 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3 border-b border-cyan-500/10 px-3.5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400/70">
            {t("chart.route_deck_title")}
          </p>
          <p className="mt-1 font-mono text-[22px] font-semibold leading-none text-cyan-100">
            {optimizing || !Number.isFinite(distanceNm)
              ? "…"
              : `${distanceNm.toFixed(1)}`}
            <span className="ml-1 text-[12px] font-medium text-cyan-300/70">NM</span>
          </p>
          <p className="mt-1.5 font-mono text-[12px] text-cyan-200/80">
            {optimizing ? t("chart.route_deck_optimizing") : formatEta(etaMinutes, t)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-cyan-400/55">
            {t("chart.route_deck_speed")}
          </p>
          <div className="flex overflow-hidden rounded-lg border border-cyan-500/25">
            {ROUTE_SPEED_OPTIONS_KTS.map((k) => {
              const on = Math.round(speedKts) === k;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={optimizing}
                  onClick={() => onSpeed(k)}
                  className={`px-2 py-1 font-mono text-[11px] transition ${
                    on
                      ? "bg-cyan-400/20 text-[#00F2FE]"
                      : "bg-transparent text-cyan-200/60 hover:bg-cyan-400/10"
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setLegsOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[11px] text-cyan-200/75 hover:bg-cyan-400/5"
      >
        <span>
          {t("chart.route_deck_legs", { count: legs.length })}
        </span>
        {legsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {legsOpen && (
        <ul className="max-h-36 space-y-1 overflow-y-auto border-t border-cyan-500/10 px-3.5 py-2">
          {legs.length === 0 && (
            <li className="text-[11px] text-cyan-200/50">{t("chart.route_deck_no_legs")}</li>
          )}
          {legs.map((leg, i) => (
            <li
              key={`leg-${i}-${leg.bearingDeg}`}
              className="flex items-center justify-between gap-2 font-mono text-[10px] text-cyan-100/85"
            >
              <span>
                {t("chart.route_deck_leg_row", {
                  n: i + 1,
                  brg: Math.round(leg.bearingDeg).toString().padStart(3, "0"),
                  card: leg.bearingLabel,
                  nm: leg.distanceNm.toFixed(1),
                  min:
                    leg.etaMinutes != null
                      ? Math.max(1, Math.round(leg.etaMinutes))
                      : "—",
                })}
              </span>
              {leg.risk === "narrow" && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                  {t("chart.route_deck_narrow")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1.5 border-t border-cyan-500/10 px-2.5 py-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-400/25 bg-rose-500/10 px-2 py-2 text-[11px] font-semibold text-rose-200"
        >
          <RotateCcw size={12} />
          {t("chart.route_deck_reset")}
        </button>
        <button
          type="button"
          onClick={onAddVia}
          disabled={locked}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2 py-2 text-[11px] font-semibold text-cyan-100 disabled:opacity-40"
        >
          <Plus size={12} />
          {t("chart.route_deck_add_via")}
        </button>
        {locked ? (
          <button
            type="button"
            onClick={onUnlock}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-cyan-400/35 bg-[#00F2FE]/15 px-2 py-2 text-[11px] font-semibold text-[#00F2FE]"
          >
            <Unlock size={12} />
            {t("chart.route_deck_unlock")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onLock}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-cyan-400/35 bg-[#00F2FE]/15 px-2 py-2 text-[11px] font-semibold text-[#00F2FE]"
          >
            <Lock size={12} />
            <Navigation2 size={12} />
            {t("chart.route_deck_lock")}
          </button>
        )}
      </div>
    </div>
  );
});
