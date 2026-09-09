import type { ReactNode } from "react";

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/** CockpitHeader — the standard MarineOS page/section header. */
export function CockpitHeader({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl font-semibold text-white mt-1 truncate">{title}</h1>
        {subtitle && <p className="text-[12px] text-white/55 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
