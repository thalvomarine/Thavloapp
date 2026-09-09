import { GlassPanel } from "@/components/mission/GlassPanel";
import { Activity, AlertTriangle, Ship, Users, Wallet, Package } from "lucide-react";
import type { ReactNode } from "react";

export interface KpiItem {
  key: string;
  label: string;
  value: string | number;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  hint?: string;
  icon?: ReactNode;
}

const TONE: Record<NonNullable<KpiItem["tone"]>, string> = {
  neutral: "text-white/80",
  success: "text-emerald-300",
  warning: "text-amber-300",
  danger:  "text-rose-300",
  info:    "text-sky-300",
};

const DEFAULT_ICON: Record<string, ReactNode> = {
  sos: <AlertTriangle className="size-3.5" />,
  active: <Ship className="size-3.5" />,
  providers: <Users className="size-3.5" />,
  offers: <Activity className="size-3.5" />,
  escrow: <Wallet className="size-3.5" />,
  stock: <Package className="size-3.5" />,
};

/** AdminKpiRail — dense top KPI strip for the control tower. */
export function AdminKpiRail({ items }: { items: KpiItem[] }) {
  return (
    <GlassPanel padded={false} className="overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-white/[0.05] divide-y sm:divide-y-0">
        {items.map((k) => (
          <div key={k.key} className="p-3 min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {k.icon ?? DEFAULT_ICON[k.key]} {k.label}
            </p>
            <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${TONE[k.tone ?? "neutral"]}`}>
              {k.value}
            </p>
            {k.hint && <p className="text-[10px] text-white/40 mt-0.5 truncate">{k.hint}</p>}
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
