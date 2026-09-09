import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { AlertOctagon, CheckCircle2, Wrench, Package, Receipt } from "lucide-react";

export type TimelineKind = "sos" | "job" | "part" | "invoice" | "note";

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  title: string;
  detail?: string;
  at: string; // ISO
}

const ICONS: Record<TimelineKind, { icon: React.ReactNode; tone: string }> = {
  sos:     { icon: <AlertOctagon className="size-3.5" />, tone: "text-rose-300 bg-rose-500/10 border-rose-500/30" },
  job:     { icon: <CheckCircle2 className="size-3.5" />, tone: "text-emerald-300 bg-emerald-400/10 border-emerald-400/25" },
  part:    { icon: <Package className="size-3.5" />, tone: "text-sky-300 bg-sky-400/10 border-sky-400/25" },
  invoice: { icon: <Receipt className="size-3.5" />, tone: "text-amber-300 bg-amber-400/10 border-amber-400/25" },
  note:    { icon: <Wrench className="size-3.5" />, tone: "text-white/70 bg-white/5 border-white/10" },
};

interface Props {
  events: TimelineEvent[];
}

/** Health timeline — living log of vessel events. */
export function VesselHealthTimeline({ events }: Props) {
  const { t } = useTranslation();
  if (events.length === 0) {
    return (
      <GlassPanel className="text-sm text-white/60">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1.5">
          {t("passport.health_timeline")}
        </p>
        {t("passport.timeline_empty")}
      </GlassPanel>
    );
  }
  return (
    <GlassPanel padded={false}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
          {t("passport.health_timeline")}
        </p>
        <span className="text-[10px] text-white/40">
          {t("passport.timeline_count", { count: events.length })}
        </span>
      </div>
      <ol className="p-4 space-y-3">
        {events.map((e) => {
          const s = ICONS[e.kind];
          return (
            <li key={e.id} className="flex gap-3">
              <div className={"mt-0.5 shrink-0 size-7 rounded-full border grid place-items-center " + s.tone}>{s.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-white/90 truncate">{e.title}</p>
                  <span className="text-[10px] text-white/40 shrink-0">{new Date(e.at).toLocaleDateString()}</span>
                </div>
                {e.detail && <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{e.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </GlassPanel>
  );
}
