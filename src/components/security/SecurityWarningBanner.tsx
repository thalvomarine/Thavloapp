import { AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import type { LeakRisk } from "@/lib/security";

interface Props {
  risk: LeakRisk;
  title?: string;
  body?: string;
  className?: string;
}

const TONE: Record<LeakRisk, { wrap: string; icon: React.ReactNode; label: string }> = {
  safe:   { wrap: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200", icon: <ShieldCheck className="size-4" />, label: "Protected" },
  low:    { wrap: "border-white/15 bg-white/[0.04] text-white/80", icon: <ShieldAlert className="size-4" />, label: "Heads up" },
  medium: { wrap: "border-amber-400/30 bg-amber-400/10 text-amber-200", icon: <AlertTriangle className="size-4" />, label: "Warning" },
  high:   { wrap: "border-rose-500/40 bg-rose-500/10 text-rose-200", icon: <AlertTriangle className="size-4" />, label: "Blocked" },
};

/** Calm inline security banner. Reused by MessageLeakGuard + admin panels. */
export function SecurityWarningBanner({ risk, title, body, className = "" }: Props) {
  const tone = TONE[risk];
  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[12px] leading-relaxed ${tone.wrap} ${className}`}
    >
      <span className="shrink-0 mt-0.5">{tone.icon}</span>
      <div className="min-w-0">
        <p className="font-semibold">
          <span className="uppercase tracking-[0.14em] text-[10px] mr-1.5 opacity-80">{tone.label}</span>
          {title}
        </p>
        {body && <p className="opacity-80 mt-0.5">{body}</p>}
      </div>
    </div>
  );
}
