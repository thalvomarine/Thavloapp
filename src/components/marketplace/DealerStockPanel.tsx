import { useTranslation } from "react-i18next";
import { Package, Pencil, Trash2 } from "lucide-react";
import { StockStatusBadge } from "./StockStatusBadge";
import { CompatibilityBadge } from "./CompatibilityBadge";

export interface DealerStockRow {
  id: string;
  name: string;
  brand: string;
  category: string;
  sku?: string | null;
  price: number;
  stock: number;
  imageUrl?: string | null;
  compatibility?: string[] | null;
  marina?: string | null;
}

interface Props {
  rows: DealerStockRow[];
  currencyFormat: (n: number) => string;
  onEdit?: (row: DealerStockRow) => void;
  onDelete?: (row: DealerStockRow) => void;
  onAdjustStock?: (row: DealerStockRow, delta: number) => void;
}

/** DealerStockPanel — dealer-side inventory row list with quick stock adjust. */
export function DealerStockPanel({ rows, currencyFormat, onEdit, onDelete, onAdjustStock }: Props) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
        <Package className="mx-auto size-6 text-white/30 mb-2" />
        <p className="text-sm text-white/60">{t("dealer.no_skus")}</p>
        <p className="text-[11px] text-white/40 mt-1">{t("dealer.no_skus_body")}</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex gap-3">
            <div className="size-14 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-white/5 grid place-items-center">
              {r.imageUrl ? <img src={r.imageUrl} alt="" className="size-full object-cover" /> : <Package className="size-5 text-white/30" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{r.brand} · {r.category}</p>
              <p className="text-sm font-semibold text-white truncate">{r.name}</p>
              {r.sku && <p className="text-[10px] text-white/40 font-mono truncate">OEM · {r.sku}</p>}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <StockStatusBadge stock={r.stock} />
                <CompatibilityBadge compatibility={r.compatibility} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-white tabular-nums">{currencyFormat(r.price)}</p>
              {onAdjustStock && (
                <div className="mt-2 inline-flex items-center rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                  <button onClick={() => onAdjustStock(r, -1)} disabled={r.stock <= 0} className="size-7 grid place-items-center text-white/70 hover:bg-white/10 disabled:opacity-30">−</button>
                  <span className="w-8 text-center text-[11px] font-semibold text-white tabular-nums">{r.stock}</span>
                  <button onClick={() => onAdjustStock(r, +1)} className="size-7 grid place-items-center text-white/70 hover:bg-white/10">+</button>
                </div>
              )}
            </div>
          </div>
          {(onEdit || onDelete) && (
            <div className="mt-3 flex gap-2 justify-end">
              {onEdit && (
                <button onClick={() => onEdit(r)} className="h-8 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 text-[11px] font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-1.5">
                  <Pencil className="size-3" /> {t("common.edit")}
                </button>
              )}
              {onDelete && (
                <button onClick={() => onDelete(r)} className="h-8 px-3 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15 text-rose-300 text-[11px] font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-1.5">
                  <Trash2 className="size-3" /> {t("common.remove")}
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
