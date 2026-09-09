import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { Package } from "lucide-react";

export interface StockAlertRow {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  marina: string | null;
  /** Dealer / supplier that owns the listing, so the operator knows whose it is. */
  owner_name?: string | null;
  active?: boolean;
}

interface Props {
  totalSkus: number;
  activeSkus: number;
  outOfStock: number;
  lowStock: StockAlertRow[];
  /** Deactivated listings, offered separately so they can be reactivated. */
  inactive?: StockAlertRow[];
  busyId?: string | null;
  onDeactivate?: (row: StockAlertRow) => void;
  onReactivate?: (row: StockAlertRow) => void;
}

/** MarketplaceOpsPanel — inventory overview + low stock alerts. */
export function MarketplaceOpsPanel({
  totalSkus, activeSkus, outOfStock, lowStock,
  inactive = [], busyId = null, onDeactivate, onReactivate,
}: Props) {
  const { t } = useTranslation();
  const canManage = Boolean(onDeactivate && onReactivate);

  return (
    <GlassPanel padded={false}>
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5">
            <Package className="size-3.5" /> Marketplace inventory
          </p>
          <p className="text-sm font-semibold text-white mt-0.5">
            {activeSkus} active · {totalSkus} total
          </p>
        </div>
        {outOfStock > 0 && <StatusChip tone="warning">{outOfStock} out</StatusChip>}
      </div>
      <ul className="divide-y divide-white/[0.05] max-h-[260px] overflow-y-auto">
        {lowStock.length === 0 && (
          <li className="p-4 text-center text-[11px] text-white/40">All SKUs healthy.</li>
        )}
        {lowStock.map((p) => (
          <li key={p.id} className="px-4 py-2.5 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-white truncate">{p.name}</p>
              <p className="text-[10px] text-white/45 truncate">
                {p.sku ?? "—"} · {p.marina ?? "No marina"}
                {canManage && ` · ${p.owner_name ?? t("admin.parts.unknown_owner")}`}
              </p>
            </div>
            <StatusChip tone={p.stock === 0 ? "danger" : "warning"}>
              {p.stock === 0 ? "Out" : `${p.stock} left`}
            </StatusChip>
            {canManage && (
              <button
                type="button"
                disabled={busyId === p.id}
                onClick={() => onDeactivate?.(p)}
                className="h-7 px-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200 hover:bg-rose-500/20 disabled:opacity-40 transition-colors"
              >
                {t("admin.parts.deactivate")}
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <div className="border-t border-white/[0.06]">
          <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {t("admin.parts.inactive_title")}
          </p>
          <ul className="divide-y divide-white/[0.05] max-h-[200px] overflow-y-auto">
            {inactive.length === 0 && (
              <li className="p-4 text-center text-[11px] text-white/40">{t("admin.parts.inactive_empty")}</li>
            )}
            {inactive.map((p) => (
              <li key={p.id} className="px-4 py-2.5 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-white/45 truncate">
                    {p.sku ?? "—"} · {p.owner_name ?? t("admin.parts.unknown_owner")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => onReactivate?.(p)}
                  className="h-7 px-2.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-40 transition-colors"
                >
                  {t("admin.parts.reactivate")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassPanel>
  );
}
