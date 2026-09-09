import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { formatTL } from "@/lib/filter";
import { AlertTriangle, Ban, CheckCircle2, Gauge, Ship } from "lucide-react";
import type { MissionRow } from "@/components/admin/MissionCommandBoard";
import { formatRouteEta, type RouteEta } from "@/lib/geo-eta";

export interface DispatchProvider {
  id: string;
  name: string;
}

/** Operational statuses an admin can force from the tower. */
export const DISPATCH_STATUSES = [
  "Pending",
  "Accepted",
  "EnRoute",
  "OnSite",
  "InProgress",
] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

interface Props {
  missions: MissionRow[];
  providers: DispatchProvider[];
  busyId: string | null;
  /** Live distance/speed/ETA for missions with a responding boat + known position. */
  etaByMission?: Record<string, RouteEta | null>;
  onSpeedChange?: (mission: MissionRow, speedKts: number) => void;
  onAssign: (mission: MissionRow, providerId: string, providerName: string) => void;
  onStatus: (mission: MissionRow, status: DispatchStatus) => void;
  onComplete: (mission: MissionRow) => void;
  onCancel: (mission: MissionRow) => void;
}

/**
 * MissionDispatchPanel — one-click operational control over live service calls.
 * Writes go through admin RLS policies on `jobs`; no optimistic UI.
 */
export function MissionDispatchPanel({
  missions,
  providers,
  busyId,
  etaByMission = {},
  onSpeedChange,
  onAssign,
  onStatus,
  onComplete,
  onCancel,
}: Props) {
  const { t } = useTranslation();

  return (
    <GlassPanel padded={false} className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {t("admin.dispatch.eyebrow")}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-white">{t("admin.dispatch.title")}</p>
        </div>
        <StatusChip tone={missions.length ? "info" : "neutral"}>
          {t("admin.dispatch.count", { count: missions.length })}
        </StatusChip>
      </div>

      {missions.length === 0 ? (
        <p className="p-6 text-center text-xs text-white/40">{t("admin.dispatch.empty")}</p>
      ) : (
        <ul className="max-h-[520px] divide-y divide-white/[0.05] overflow-y-auto">
          {missions.map((m) => {
            const busy = busyId === m.id;
            return (
              <li key={m.id} className="p-3.5">
                <div className="flex items-start gap-2.5">
                  <div
                    className={
                      "grid size-8 shrink-0 place-items-center rounded-xl border " +
                      (m.sos
                        ? "border-rose-400/40 bg-rose-500/15 text-rose-300"
                        : "border-white/10 bg-white/5 text-white/70")
                    }
                  >
                    {m.sos ? <AlertTriangle className="size-4" /> : <Ship className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[12px] font-semibold text-white">
                        {m.problem_category}
                      </p>
                      <StatusChip tone="neutral">{m.status}</StatusChip>
                    </div>
                    <p className="truncate text-[10px] text-white/50">
                      {m.marina ?? t("admin.dispatch.unknown_marina")} ·{" "}
                      {m.total_escrow_pool ? formatTL(Math.round(m.total_escrow_pool)) : "—"}
                    </p>
                  </div>
                </div>

                {(() => {
                  const eta = etaByMission[m.id];
                  if (!eta) return null;
                  return (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/[0.06] px-2.5 py-1.5">
                      <p className="truncate font-mono text-[10px] text-cyan-100">
                        {formatRouteEta(
                          eta,
                          t("admin.dispatch.eta_distance"),
                          t("admin.dispatch.eta_speed"),
                        )}
                      </p>
                      {onSpeedChange && (
                        <label className="flex shrink-0 items-center gap-1 text-[9px] text-cyan-200/70">
                          <Gauge className="size-3 shrink-0" />
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={Math.round(eta.speedKts)}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              if (Number.isFinite(next) && next > 0) onSpeedChange(m, next);
                            }}
                            className="h-5 w-11 rounded border border-cyan-300/30 bg-[#0a192f] px-1 text-right font-mono text-[10px] text-cyan-100 outline-none focus:border-cyan-300/70"
                          />
                          kts
                        </label>
                      )}
                    </div>
                  );
                })()}

                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      {t("admin.dispatch.assign")}
                    </span>
                    <select
                      disabled={busy || providers.length === 0}
                      defaultValue=""
                      onChange={(e) => {
                        const p = providers.find((x) => x.id === e.target.value);
                        if (p) onAssign(m, p.id, p.name);
                        e.currentTarget.value = "";
                      }}
                      className="h-8 w-full rounded-lg border border-white/15 bg-white/[0.06] px-2 text-[11px] text-white disabled:opacity-50"
                    >
                      <option value="" className="bg-[#0a192f]">
                        {t("admin.dispatch.pick_provider")}
                      </option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#0a192f]">
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      {t("admin.dispatch.status")}
                    </span>
                    <select
                      disabled={busy}
                      value={DISPATCH_STATUSES.includes(m.status as DispatchStatus) ? m.status : ""}
                      onChange={(e) => onStatus(m, e.target.value as DispatchStatus)}
                      className="h-8 w-full rounded-lg border border-white/15 bg-white/[0.06] px-2 text-[11px] text-white disabled:opacity-50"
                    >
                      <option value="" disabled className="bg-[#0a192f]">
                        {m.status}
                      </option>
                      {DISPATCH_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-[#0a192f]">
                          {t(`admin.dispatch.status_${s.toLowerCase()}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onComplete(m)}
                    className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-400/15 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-100 disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-3" />
                    {t("admin.dispatch.complete")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onCancel(m)}
                    className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-rose-400/40 bg-rose-400/10 text-[10px] font-bold uppercase tracking-[0.1em] text-rose-100 disabled:opacity-50"
                  >
                    <Ban className="size-3" />
                    {t("admin.dispatch.cancel_mission")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
  );
}
