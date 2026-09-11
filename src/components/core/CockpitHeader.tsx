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
    <div className="flex min-w-0 w-full flex-col gap-2">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 truncate text-xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[12px] text-white/55">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex min-w-0 w-full flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
