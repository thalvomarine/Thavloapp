import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { CalendarClock } from "lucide-react";

interface Props {
  lastServiceAt: string | null;
  nextDueAt: string | null;
  engineHours?: number | null;
}

/** Maintenance-due panel. Placeholder-friendly for vessels without records. */
export function MaintenanceDueCard({ lastServiceAt, nextDueAt, engineHours }: Props) {
  const { t } = useTranslation();
  const nextDate = nextDueAt ? new Date(nextDueAt) : null;
  const now = new Date();
  const daysLeft = nextDate ? Math.round((nextDate.getTime() - now.getTime()) / 86400000) : null;
  const tone = daysLeft === null ? "neutral" : daysLeft < 0 ? "danger" : daysLeft < 14 ? "warning" : "success";
  const status =
    daysLeft === null
      ? t("passport.maintenance_not_scheduled")
      : daysLeft < 0
        ? t("passport.maintenance_overdue", { days: Math.abs(daysLeft) })
        : t("passport.maintenance_remaining", { days: daysLeft });

  return (
    <GlassPanel>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-sky-300/80" />
          <p className="text-sm font-medium text-white/90">{t("passport.maintenance")}</p>
        </div>
        <StatusChip tone={tone as never}>{status}</StatusChip>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-white/40">{t("passport.last_service")}</dt>
          <dd className="text-white/85 font-medium mt-0.5">{lastServiceAt ? new Date(lastServiceAt).toLocaleDateString() : "—"}</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-white/40">{t("passport.next_due")}</dt>
          <dd className="text-white/85 font-medium mt-0.5">{nextDate ? nextDate.toLocaleDateString() : "—"}</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 col-span-2">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-white/40">{t("passport.engine_hours")}</dt>
          <dd className="text-white/85 font-medium mt-0.5">{engineHours ?? t("passport.engine_hours_todo")}</dd>
        </div>
      </dl>
    </GlassPanel>
  );
}
