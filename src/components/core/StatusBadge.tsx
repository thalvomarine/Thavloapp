import type { ReactNode } from "react";
import type { StatusTone } from "@/types/marine";

interface Props {
  tone?: StatusTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const TONES: Record<StatusTone, string> = {
  neutral: "text-foreground/80 bg-white/5 border-white/10",
  success: "text-emerald-300 bg-emerald-400/10 border-emerald-400/25",
  warning: "text-amber-300 bg-amber-400/10 border-amber-400/25",
  danger: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  info: "text-sky-300 bg-sky-400/10 border-sky-400/25",
};

/**
 * StatusBadge — canonical MarineOS pill.
 *
 * Note: the existing mission/StatusChip renders identical markup and remains
 * for backward compatibility. New code should import from @/components/core.
 */
export function StatusBadge({ tone = "neutral", icon, children, className = "" }: Props) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] " +
        TONES[tone] +
        " " +
        className
      }
    >
      {icon}
      {children}
    </span>
  );
}
