import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { Users } from "lucide-react";

export interface ProviderOpsRow {
  id: string;
  name: string;
  service_type: string | null;
  live_status: string | null;
  rating?: number | null;
  /** true/false from a real read; null when the verification read failed. */
  verified?: boolean | null;
}

interface Props {
  providers: ProviderOpsRow[];
  /** id of the provider currently being written, so its control is disabled. */
  busyId?: string | null;
  onVerify?: (row: ProviderOpsRow) => void;
  onUnverify?: (row: ProviderOpsRow) => void;
}

/** ProviderOpsList — network side of the tower: who is on the grid. */
export function ProviderOpsList({ providers, busyId = null, onVerify, onUnverify }: Props) {
  const { t } = useTranslation();
  const online = providers.filter((p) => p.live_status === "Available").length;
  const canManage = Boolean(onVerify && onUnverify);

  return (
    <GlassPanel padded={false}>
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5">
            <Users className="size-3.5" /> Providers on grid
          </p>
          <p className="text-sm font-semibold text-white mt-0.5">
            {online} online · {providers.length} total
          </p>
        </div>
      </div>
      <ul className="max-h-[320px] overflow-y-auto divide-y divide-white/[0.05]">
        {providers.length === 0 && (
          <li className="p-4 text-center text-[11px] text-white/40">No providers registered yet.</li>
        )}
        {providers.map((p) => {
          const online = p.live_status === "Available";
          const busy = busyId === p.id;
          return (
            <li key={p.id} className="px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className={
                  "size-2 rounded-full shrink-0 " +
                  (online ? "bg-emerald-400 shadow-[0_0_10px_theme(colors.emerald.400)]" : "bg-white/20")
                } />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-white/45 truncate">{p.service_type ?? "Provider"}</p>
                </div>
                <StatusChip tone={online ? "success" : "neutral"}>
                  {online ? "Live" : "Offline"}
                </StatusChip>
              </div>

              {canManage && (
                <div className="mt-2 flex items-center gap-2">
                  <StatusChip tone={p.verified == null ? "warning" : p.verified ? "success" : "neutral"}>
                    {p.verified == null
                      ? t("admin.verify.state_unknown")
                      : p.verified
                        ? t("admin.verify.state_verified")
                        : t("admin.verify.state_unverified")}
                  </StatusChip>
                  {p.verified === true && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onUnverify?.(p)}
                      className="ml-auto h-7 px-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200 hover:bg-rose-500/20 disabled:opacity-40 transition-colors"
                    >
                      {t("admin.verify.unverify")}
                    </button>
                  )}
                  {p.verified === false && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onVerify?.(p)}
                      className="ml-auto h-7 px-2.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-40 transition-colors"
                    >
                      {t("admin.verify.verify")}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
