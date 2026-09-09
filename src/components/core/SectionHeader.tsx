import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  label: string;
  value?: string;
  action?: ReactNode;
}

/** Compact section header used inside GlassPanel bodies. */
export function SectionHeader({ icon, label, value, action }: Props) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
          {icon}
          {label}
        </p>
        {value && <p className="text-sm font-semibold text-white mt-0.5 truncate">{value}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
