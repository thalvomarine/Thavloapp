import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import type { LeakRisk } from "@/lib/security";

export interface SecurityEvent {
  id: string;
  risk: LeakRisk;
  summary: string;
  detail?: string;
  timestamp?: string;
  categories?: string[];
}

const TONE: Record<LeakRisk, { border: string; icon: React.ReactNode; label: string; text: string }> = {
  safe:   { border: "border-emerald-400/25", icon: <ShieldCheck className="size-3.5 text-emerald-300" />, label: "Safe", text: "text-emerald-300" },
  low:    { border: "border-white/10",       icon: <ShieldAlert className="size-3.5 text-white/60" />,   label: "Low",  text: "text-white/70" },
  medium: { border: "border-amber-400/30",   icon: <AlertTriangle className="size-3.5 text-amber-300" />, label: "Warning", text: "text-amber-300" },
  high:   { border: "border-rose-500/40",    icon: <AlertTriangle className="size-3.5 text-rose-300" />,  label: "Blocked", text: "text-rose-300" },
};

/** SecurityEventCard — compact row for detected risky activity. */
export function SecurityEventCard({ event }: { event: SecurityEvent }) {
  const tone = TONE[event.risk];
  return (
    <div className={`rounded-xl border ${tone.border} bg-white/[0.03] px-3 py-2.5 flex items-start gap-2.5`}>
      <div className="mt-0.5 shrink-0">{tone.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-white truncate">{event.summary}</p>
        {event.detail && <p className="text-[11px] text-white/50 truncate">{event.detail}</p>}
        {event.categories && event.categories.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {event.categories.map((c) => (
              <span key={c} className="text-[9px] uppercase tracking-[0.14em] rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-white/60">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${tone.text}`}>{tone.label}</span>
        {event.timestamp && (
          <p className="text-[10px] text-white/40 mt-0.5 tabular-nums">
            {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}
