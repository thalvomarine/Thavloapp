import { GlassPanel } from "@/components/mission/GlassPanel";
import { Activity, AlertTriangle, Package, Ship, Wallet } from "lucide-react";
import type { ReactNode } from "react";

export type PlatformEventKind = "sos" | "mission" | "offer" | "escrow" | "stock";

export interface PlatformEvent {
  id: string;
  kind: PlatformEventKind;
  title: string;
  detail?: string;
  timestamp: string;
}

const ICON: Record<PlatformEventKind, ReactNode> = {
  sos:     <AlertTriangle className="size-3.5 text-rose-300" />,
  mission: <Ship className="size-3.5 text-sky-300" />,
  offer:   <Activity className="size-3.5 text-white/70" />,
  escrow:  <Wallet className="size-3.5 text-emerald-300" />,
  stock:   <Package className="size-3.5 text-amber-300" />,
};

/**
 * PlatformEventFeed — chronological network activity.
 * TODO(audit-log): swap client-side derivation for a real
 *   admin_events table + append-only audit trail.
 */
export function PlatformEventFeed({ events }: { events: PlatformEvent[] }) {
  return (
    <GlassPanel padded={false}>
      <div className="p-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5">
          <Activity className="size-3.5" /> Platform event feed
        </p>
      </div>
      <ol className="divide-y divide-white/[0.05] max-h-[320px] overflow-y-auto">
        {events.length === 0 && (
          <li className="p-4 text-center text-[11px] text-white/40">No events yet.</li>
        )}
        {events.map((e) => (
          <li key={e.id} className="px-4 py-2.5 flex gap-2.5">
            <div className="mt-0.5 shrink-0">{ICON[e.kind]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-white truncate">{e.title}</p>
              {e.detail && <p className="text-[11px] text-white/50 truncate">{e.detail}</p>}
            </div>
            <span className="text-[10px] text-white/40 shrink-0 tabular-nums">
              {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </li>
        ))}
      </ol>
    </GlassPanel>
  );
}
