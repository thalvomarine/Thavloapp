import type { ReactNode } from "react";
import { GlassPanel } from "@/components/mission/GlassPanel";
import type { StatusTone } from "@/types/marine";

interface Props {
  label: string;
  value: string | number;
  tone?: StatusTone;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}

const TONE: Record<StatusTone, string> = {
  neutral: "text-white/80",
  success: "text-emerald-300",
  warning: "text-amber-300",
  danger: "text-rose-300",
  info: "text-sky-300",
};

/**
 * MetricCard — single-cell KPI tile. Aligns visually with the AdminKpiRail
 * cells so a KPI extracted into its own panel keeps the same silhouette.
 */
export function MetricCard({
  label,
  value,
  tone = "neutral",
  hint,
  icon,
  className = "",
}: Props) {
  return (
    <GlassPanel className={"p-3 " + className}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {icon}
        {label}
      </p>
      <p className={"mt-1.5 text-2xl font-semibold tabular-nums " + TONE[tone]}>{value}</p>
      {hint && <p className="text-[10px] text-white/40 mt-0.5 truncate">{hint}</p>}
    </GlassPanel>
  );
}
