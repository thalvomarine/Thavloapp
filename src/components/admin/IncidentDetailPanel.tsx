import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { AlertTriangle, ExternalLink, Flag, LifeBuoy, MapPin, Ship, Wallet } from "lucide-react";
import type { MissionRow } from "./MissionCommandBoard";
import { Link } from "@tanstack/react-router";
import { formatTL } from "@/lib/filter";

interface Props {
  mission: MissionRow | null;
  offersCount?: number;
}

/**
 * IncidentDetailPanel — right rail focus view for the selected mission.
 * Actions are UI placeholders wired to real routes where possible.
 * TODO(admin-actions): flagging, dispute resolution, contact team require
 *   dedicated tables + admin permissions before going live.
 */
export function IncidentDetailPanel({ mission, offersCount }: Props) {
  if (!mission) {
    return (
      <GlassPanel className="min-h-[320px] grid place-items-center text-center">
        <div className="text-white/50">
          <LifeBuoy className="size-6 mx-auto mb-2 text-white/30" />
          <p className="text-xs uppercase tracking-[0.2em]">Select a mission</p>
          <p className="text-[11px] mt-1">Incident details will appear here.</p>
        </div>
      </GlassPanel>
    );
  }

  const isSos = mission.status === "Requested" || mission.sos;

  return (
    <GlassPanel padded={false} className="overflow-hidden">
      <div className={
        "p-4 border-b border-white/[0.06] " +
        (isSos ? "bg-gradient-to-br from-rose-500/15 via-transparent to-transparent" : "")
      }>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Incident detail
            </p>
            <p className="text-base font-semibold text-white mt-0.5 truncate">
              {mission.problem_category}
            </p>
          </div>
          <StatusChip tone={isSos ? "danger" : "info"} icon={isSos ? <AlertTriangle className="size-3" /> : undefined}>
            {mission.status}
          </StatusChip>
        </div>
      </div>

      <dl className="p-4 space-y-3 text-[12px]">
        <Row icon={<Ship className="size-3.5" />} label="Service">{mission.service_type ?? "—"}</Row>
        <Row icon={<MapPin className="size-3.5" />} label="Marina">{mission.marina ?? "Unknown"}</Row>
        <Row icon={<Wallet className="size-3.5" />} label="Escrow">
          {mission.total_escrow_pool ? formatTL(Math.round(Number(mission.total_escrow_pool))) : "—"}
        </Row>
        <Row icon={<LifeBuoy className="size-3.5" />} label="Offers">{offersCount ?? 0}</Row>
      </dl>

      <div className="p-4 border-t border-white/[0.06] space-y-2">
        <Link
          to="/app/job/$id"
          params={{ id: mission.id }}
          className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[12px] font-semibold"
        >
          <span>Open mission cockpit</span>
          <ExternalLink className="size-3.5" />
        </Link>
        <button
          disabled
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 text-[12px] font-semibold cursor-not-allowed"
          title="Provider profile view — coming with operator role"
        >
          <span>View provider profile</span>
          <ExternalLink className="size-3.5" />
        </button>
        <button
          disabled
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-amber-400/5 border border-amber-400/20 text-amber-300/60 text-[12px] font-semibold cursor-not-allowed"
          title="Requires admin_flags table + audit log"
        >
          <span>Flag for review</span>
          <Flag className="size-3.5" />
        </button>
        <button
          disabled
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-300/60 text-[12px] font-semibold cursor-not-allowed"
          title="Requires disputes workflow"
        >
          <span>Resolve dispute</span>
          <LifeBuoy className="size-3.5" />
        </button>
      </div>
    </GlassPanel>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-white/45 uppercase tracking-[0.14em] text-[10px] font-semibold">
        {icon} {label}
      </dt>
      <dd className="text-white/90 font-medium truncate max-w-[60%] text-right">{children}</dd>
    </div>
  );
}
