import type { ReactNode } from "react";
import { Radio } from "lucide-react";

interface Props {
  kpi: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  /** Portal-rendered overlays (confirmation dialogs) owned by the page. */
  dialog?: ReactNode;
}

/**
 * MarineOS admin cockpit — 3-column control tower.
 * Left = filters/ops lists, center = mission board / map, right = incident detail.
 */
export function AdminControlTowerShell({ kpi, left, center, right, dialog }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40">
            MarineOS · Control Tower
          </p>
          <h1 className="text-xl font-semibold text-white mt-1 flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Live operations
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-white/50">
          <Radio className="size-3.5" /> Network telemetry
        </div>
      </div>

      {kpi}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <aside className="lg:col-span-3 space-y-4">{left}</aside>
        <section className="lg:col-span-6 space-y-4">{center}</section>
        <aside className="lg:col-span-3 space-y-4">{right}</aside>
      </div>
      {dialog}
    </div>
  );
}
