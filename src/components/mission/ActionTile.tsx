import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

interface Props {
  to?: string;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  hint?: string;
  accent?: "primary" | "aqua" | "amber" | "danger";
}

const ACCENTS: Record<NonNullable<Props["accent"]>, string> = {
  primary: "text-sky-300",
  aqua:    "text-cyan-300",
  amber:   "text-amber-300",
  danger:  "text-rose-300",
};

/**
 * Operational action tile — Linear/Raycast feel. Reusable across screens.
 * Renders as a Link when `to` is provided, otherwise as a button.
 */
export function ActionTile({ to, onClick, icon, label, hint, accent = "primary" }: Props) {
  const inner = (
    <div className="group relative h-full rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300 p-4 flex flex-col gap-3 overflow-hidden">
      <div className={"size-9 rounded-xl bg-white/5 border border-white/10 grid place-items-center " + ACCENTS[accent]}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground tracking-tight">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <span className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
  if (to) {
    return <Link to={to} className="block h-full">{inner}</Link>;
  }
  return <button onClick={onClick} className="block h-full text-left w-full">{inner}</button>;
}
