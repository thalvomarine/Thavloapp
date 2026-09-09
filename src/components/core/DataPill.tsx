import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  label: string;
  value?: ReactNode;
  className?: string;
}

/**
 * DataPill — compact key/value pill used in cockpit headers, cards and
 * incident detail panels ("Distance · 4.2 km", "ETA · 18 min").
 */
export function DataPill({ icon, label, value, className = "" }: Props) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70 " +
        className
      }
    >
      {icon}
      <span className="uppercase tracking-[0.14em] text-[9px] text-white/45">{label}</span>
      {value != null && <span className="font-semibold text-white">{value}</span>}
    </span>
  );
}
