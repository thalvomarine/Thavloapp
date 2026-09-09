import { useTranslation } from "react-i18next";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export type MissionStage =
  | "draft"
  | "broadcasting"
  | "offers"
  | "selected"
  | "en_route"
  | "started"
  | "completed";

interface Props {
  stage: MissionStage;
  className?: string;
  compact?: boolean;
}

const STAGES: { key: MissionStage; labelKey: string }[] = [
  { key: "draft",        labelKey: "mission.stage_draft" },
  { key: "broadcasting", labelKey: "mission.stage_broadcasting" },
  { key: "offers",       labelKey: "mission.stage_offers" },
  { key: "selected",     labelKey: "mission.stage_selected" },
  { key: "en_route",     labelKey: "mission.stage_en_route" },
  { key: "started",      labelKey: "mission.stage_working" },
  { key: "completed",    labelKey: "mission.stage_completed" },
];

const ORDER: Record<MissionStage, number> = {
  draft: 0, broadcasting: 1, offers: 2, selected: 3, en_route: 4, started: 5, completed: 6,
};

/** Map a Supabase jobs.status + offer count to a MissionStage. */
export function stageFromJob(status: string, offerCount = 0): MissionStage {
  switch (status) {
    case "Pending":     return offerCount > 0 ? "offers" : "broadcasting";
    case "Offered":     return "offers";
    case "Accepted":    return "selected";
    case "EnRoute":     return "en_route";
    case "OnSite":
    case "InProgress":
    case "PartsPending":return "started";
    case "Completed":   return "completed";
    default:            return "draft";
  }
}

/**
 * MissionStatusTrack — horizontal cockpit-grade stage ladder.
 * Renders all mission states. Reusable across /app and /app/job/$id.
 */
export function MissionStatusTrack({ stage, className = "", compact = false }: Props) {
  const { t } = useTranslation();
  const activeIdx = ORDER[stage];
  return (
    <ol className={"relative flex items-center gap-1 " + className}>
      {STAGES.map((s, i) => {
        const state: "done" | "current" | "todo" =
          i < activeIdx ? "done" : i === activeIdx ? "current" : "todo";
        return (
          <li key={s.key} className="flex-1 flex items-center gap-1 min-w-0">
            <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <span
                className={
                  "grid place-items-center rounded-full transition-all " +
                  (compact ? "size-4" : "size-5") + " " +
                  (state === "done"
                    ? "bg-sky-400/20 text-sky-300 border border-sky-400/40"
                    : state === "current"
                      ? "bg-sky-400 text-slate-900 shadow-[0_0_18px_theme(colors.sky.400)]"
                      : "bg-white/5 text-white/30 border border-white/10")
                }
              >
                {state === "done" ? (
                  <CheckCircle2 className={compact ? "size-2.5" : "size-3"} />
                ) : state === "current" ? (
                  <Loader2 className={(compact ? "size-2.5" : "size-3") + " animate-spin"} />
                ) : (
                  <Circle className={compact ? "size-2" : "size-2.5"} />
                )}
              </span>
              {!compact && state === "current" && (
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap text-sky-300">
                  {t(s.labelKey)}
                </span>
              )}

            </div>
            {i < STAGES.length - 1 && (
              <span
                aria-hidden
                className={
                  "h-px flex-1 -mt-4 " +
                  (i < activeIdx ? "bg-sky-400/50" : "bg-white/10")
                }
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
