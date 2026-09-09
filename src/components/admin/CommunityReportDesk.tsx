import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { Check, Loader2, MapPin, MessageSquareWarning, User, X } from "lucide-react";
import {
  REPORT_CATEGORY_LABEL_KEYS,
  SEABED_LABEL_KEYS,
  formatDegrees,
  type CommunityReport,
} from "@/lib/marine-data";
import { ReportMiniMap } from "@/components/admin/ReportMiniMap";

interface Props {
  reports: CommunityReport[];
  busyId: string | null;
  onApprove: (report: CommunityReport) => void;
  onReject: (report: CommunityReport) => void;
}

/** Captain advice approval desk — nothing reaches the chart without a click here. */
export function CommunityReportDesk({ reports, busyId, onApprove, onReject }: Props) {
  const { t } = useTranslation();
  const [focusedId, setFocusedId] = useState<string | null>(null);

  return (
    <GlassPanel padded={false} className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {t("admin.reports.eyebrow")}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-white">{t("admin.reports.title")}</p>
        </div>
        <StatusChip tone={reports.length ? "warning" : "success"}>
          {t("admin.reports.pending_count", { count: reports.length })}
        </StatusChip>
      </div>

      {reports.length === 0 ? (
        <p className="p-6 text-center text-xs text-white/40">{t("admin.reports.empty")}</p>
      ) : (
        <ul className="max-h-[520px] divide-y divide-white/[0.05] overflow-y-auto">
          {reports.map((r) => {
            const busy = busyId === r.id;
            const focused = focusedId === r.id;
            return (
              <li key={r.id} className="p-3.5">
                <div className="flex items-start gap-2.5">
                  <div className="grid size-8 shrink-0 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
                    <MessageSquareWarning className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-semibold text-white">
                        {r.title || t(REPORT_CATEGORY_LABEL_KEYS[r.category])}
                      </p>
                      <button
                        type="button"
                        onClick={() => setFocusedId(focused ? null : r.id)}
                        aria-pressed={focused}
                        title={t("admin.reports.focus_on_map")}
                        className={
                          "grid size-6 shrink-0 place-items-center rounded-lg border transition-colors " +
                          (focused
                            ? "border-cyan-300/60 bg-cyan-400/25 text-cyan-100"
                            : "border-white/15 bg-white/[0.06] text-white/60 hover:bg-white/[0.12]")
                        }
                      >
                        <MapPin className="size-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan-300/80">
                      {t(REPORT_CATEGORY_LABEL_KEYS[r.category])}
                    </p>
                    <p className="font-mono text-[10px] text-cyan-200/80">
                      {formatDegrees(r.lat, r.lng)}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-white/70">{r.note}</p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-white/45">
                      {r.depth_m != null && <>{t("marine.depth_m", { value: r.depth_m })} · </>}
                      {r.seabed && <>{t(SEABED_LABEL_KEYS[r.seabed])} · </>}
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/45">
                      <User className="size-2.5 shrink-0" />
                      {r.submitted_by ?? t("admin.reports.anonymous")}
                    </p>
                  </div>
                </div>

                {focused && (
                  <div className="mt-2.5">
                    <ReportMiniMap lat={r.lat} lng={r.lng} />
                  </div>
                )}

                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onApprove(r)}
                    className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-400/15 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-100 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Check className="size-3" />
                    )}
                    {t("admin.reports.approve")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onReject(r)}
                    className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-rose-400/40 bg-rose-400/10 text-[10px] font-bold uppercase tracking-[0.1em] text-rose-100 disabled:opacity-50"
                  >
                    <X className="size-3" />
                    {t("admin.reports.reject")}
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
