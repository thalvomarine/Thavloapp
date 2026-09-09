import type { ReactNode } from "react";

interface Props {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const TONES: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "text-foreground/80 bg-white/5 border-white/10",
  success: "text-emerald-300 bg-emerald-400/10 border-emerald-400/25",
  warning: "text-amber-300 bg-amber-400/10 border-amber-400/25",
  danger:  "text-rose-300 bg-rose-500/10 border-rose-500/30",
  info:    "text-sky-300 bg-sky-400/10 border-sky-400/25",
};

/** Compact operational status pill — used in headers, map overlays, cards. */
export function StatusChip({ tone = "neutral", icon, children, className = "" }: Props) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] " +
        TONES[tone] + " " + className
      }
    >
      {icon}
      {children}
    </span>
  );
}
