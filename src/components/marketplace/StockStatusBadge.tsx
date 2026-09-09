import { PackageCheck, PackageX, PackageMinus } from "lucide-react";

interface Props {
  stock: number;
  lowThreshold?: number;
  className?: string;
}

/** StockStatusBadge — In stock / Low stock / Out of stock. */
export function StockStatusBadge({ stock, lowThreshold = 3, className = "" }: Props) {
  const state: "in" | "low" | "out" =
    stock <= 0 ? "out" : stock <= lowThreshold ? "low" : "in";
  const map = {
    in:  { label: `In stock · ${stock}`, cls: "text-emerald-300 bg-emerald-400/10 border-emerald-400/30", Icon: PackageCheck },
    low: { label: `Low stock · ${stock}`, cls: "text-amber-300 bg-amber-400/10 border-amber-400/30",    Icon: PackageMinus },
    out: { label: "Out of stock",         cls: "text-rose-300 bg-rose-500/10 border-rose-500/30",       Icon: PackageX },
  }[state];
  const Icon = map.Icon;
  return (
    <span className={"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] " + map.cls + " " + className}>
      <Icon className="size-2.5" />
      {map.label}
    </span>
  );
}
