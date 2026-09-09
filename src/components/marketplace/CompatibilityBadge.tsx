import { Cpu, CircleAlert, CircleCheck } from "lucide-react";

interface Props {
  compatibility?: string[] | null;
  vesselEngine?: string | null;
  vesselType?: string | null;
  className?: string;
}

function matches(compat: string[], engine: string | null | undefined, vtype: string | null | undefined) {
  if (!engine && !vtype) return null;
  const needle = [engine, vtype].filter(Boolean).map((s) => s!.toLowerCase());
  return compat.some((c) => needle.some((n) => c.toLowerCase().includes(n) || n.includes(c.toLowerCase())));
}

/** CompatibilityBadge — does this part match the captain's vessel? */
export function CompatibilityBadge({ compatibility, vesselEngine, vesselType, className = "" }: Props) {
  const list = compatibility ?? [];
  if (list.length === 0) {
    return (
      <span className={"inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 text-white/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] " + className}>
        <Cpu className="size-2.5" /> Universal
      </span>
    );
  }
  const result = matches(list, vesselEngine, vesselType);
  if (result === true) {
    return (
      <span className={"inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] " + className}>
        <CircleCheck className="size-2.5" /> Fits your vessel
      </span>
    );
  }
  if (result === false) {
    return (
      <span className={"inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] " + className}>
        <CircleAlert className="size-2.5" /> Check compatibility
      </span>
    );
  }
  return (
    <span className={"inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 text-white/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] " + className}>
      <Cpu className="size-2.5" /> {list.slice(0, 2).join(" · ")}
    </span>
  );
}
