import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, MapPinned, Radar } from "lucide-react";
import { GlassPanel } from "@/components/mission/GlassPanel";

type OpsTab = "approval" | "dispatch" | "poi";

interface Props {
  approvalDesk: ReactNode;
  missionBoard: ReactNode;
  dispatchPanel: ReactNode;
  poiManager: ReactNode;
  pendingCount: number;
  activeMissionCount: number;
  zoneCount: number;
}

/**
 * AdminOpsTabs — the 3 operational desks of the Control Tower, unified
 * behind one tab strip: Approval Desk, Mission Dispatch, POI Manager.
 * Each tab keeps its own panels/state; this component only owns which one
 * is visible, so switching tabs never re-fetches or resets a child form.
 */
export function AdminOpsTabs({
  approvalDesk,
  missionBoard,
  dispatchPanel,
  poiManager,
  pendingCount,
  activeMissionCount,
  zoneCount,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<OpsTab>("approval");

  const tabs: Array<{ key: OpsTab; labelKey: string; icon: typeof ClipboardCheck; count: number }> =
    [
      {
        key: "approval",
        labelKey: "admin.ops_tabs.approval",
        icon: ClipboardCheck,
        count: pendingCount,
      },
      {
        key: "dispatch",
        labelKey: "admin.ops_tabs.dispatch",
        icon: Radar,
        count: activeMissionCount,
      },
      { key: "poi", labelKey: "admin.ops_tabs.poi", icon: MapPinned, count: zoneCount },
    ];

  return (
    <GlassPanel padded={false} className="overflow-hidden">
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/[0.06] p-2">
        {tabs.map((tb) => {
          const active = tab === tb.key;
          const Icon = tb.icon;
          return (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              aria-pressed={active}
              className={
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors " +
                (active
                  ? "border-cyan-300/60 bg-cyan-400/20 text-cyan-100 shadow-[0_0_16px_rgba(0,240,255,0.18)]"
                  : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.08] hover:text-white/80")
              }
            >
              <Icon className="size-3.5 shrink-0" />
              {t(tb.labelKey)}
              <span
                className={
                  "grid min-w-[18px] place-items-center rounded-full px-1 text-[9px] font-bold " +
                  (active ? "bg-cyan-300/25 text-cyan-50" : "bg-white/10 text-white/50")
                }
              >
                {tb.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4 p-3">
        {tab === "approval" && approvalDesk}
        {tab === "dispatch" && (
          <>
            {missionBoard}
            {dispatchPanel}
          </>
        )}
        {tab === "poi" && poiManager}
      </div>
    </GlassPanel>
  );
}
