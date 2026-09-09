import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { ZONE_KIND_LABEL_KEYS, formatDegrees, type MarineZone } from "@/lib/marine-data";

interface Props {
  zones: MarineZone[];
  busyId: string | null;
  onToggleActive: (zone: MarineZone, next: boolean) => void;
  onDelete: (zone: MarineZone) => void;
}

/** Full chart-point data table: every lighthouse, mooring and shoal in one list. */
export function MarineZoneTable({ zones, busyId, onToggleActive, onDelete }: Props) {
  const { t } = useTranslation();

  return (
    <GlassPanel padded={false} className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {t("admin.zones.eyebrow")}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-white">{t("admin.zones.title")}</p>
        </div>
        <StatusChip tone="info">{t("admin.zones.count", { count: zones.length })}</StatusChip>
      </div>

      {zones.length === 0 ? (
        <p className="p-6 text-center text-xs text-white/40">{t("admin.zones.empty")}</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-[#0a192f]/95 text-white/45">
              <tr>
                <th className="px-3 py-2 font-semibold">{t("admin.zones.col_name")}</th>
                <th className="px-3 py-2 font-semibold">{t("admin.zones.col_kind")}</th>
                <th className="px-3 py-2 font-semibold">{t("admin.zones.col_position")}</th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("admin.zones.col_actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {zones.map((z) => {
                const busy = busyId === z.id;
                return (
                  <tr key={z.id} className={z.active ? "" : "opacity-50"}>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-white">{z.name}</p>
                      <p className="text-[10px] text-white/45">
                        {z.vhf_channel && (
                          <>{t("marine.vhf_channel", { channel: z.vhf_channel })} · </>
                        )}
                        {z.depth_m != null && t("marine.depth_m", { value: z.depth_m })}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-white/70">{t(ZONE_KIND_LABEL_KEYS[z.kind])}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-cyan-200/80">
                      {formatDegrees(z.lat, z.lng)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onToggleActive(z, !z.active)}
                          title={z.active ? t("admin.zones.hide") : t("admin.zones.publish")}
                          className="grid size-7 place-items-center rounded-lg border border-white/15 bg-white/[0.06] text-white/75 hover:bg-white/[0.12] disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : z.active ? (
                            <EyeOff className="size-3" />
                          ) : (
                            <Eye className="size-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onDelete(z)}
                          title={t("admin.zones.delete")}
                          className="grid size-7 place-items-center rounded-lg border border-rose-400/30 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20 disabled:opacity-50"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlassPanel>
  );
}
