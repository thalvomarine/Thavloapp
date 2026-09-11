import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Cpu, Plus, Ship, Siren, Sparkles } from "lucide-react";

export interface PartCardData {
  id: string;
  name: string;
  brand: string;
  category: string;
  categoryLabel?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  price: number;
  stock: number;
  compatibility?: string[] | null;
  dealerName?: string | null;
  dealerVerified?: boolean;
  marina?: string | null;
  deliveryMode?: "marina_pickup" | "service_boat";
  deliveryMinutes?: number | null;
  distanceKm?: number | null;
  emergencyCompatible?: boolean;
}

interface Props {
  part: PartCardData;
  vesselEngine?: string | null;
  vesselType?: string | null;
  currencyFormat: (n: number) => string;
  onAdd?: (p: PartCardData) => void;
  onNotify?: (p: PartCardData) => void;
  onAskAi?: (p: PartCardData) => void;
  actionSlot?: ReactNode;
}

export function PartCard({ part, currencyFormat, onAdd, onNotify, onAskAi, actionSlot }: Props) {
  const { t } = useTranslation();
  const outOfStock = part.stock <= 0;
  const lowStock = !outOfStock && part.stock <= 2;

  const stockLabel = outOfStock
    ? t("marketplace.product.out_of_stock")
    : lowStock
      ? t("marketplace.product.running_low")
      : part.deliveryMode === "service_boat"
        ? t("marketplace.product.stock_same_day", {
            marina: part.marina ?? t("marketplace.vessel_fallback"),
          })
        : t("marketplace.product.stock_ready");

  const stockDot = outOfStock ? "bg-rose-400" : lowStock ? "bg-amber-400" : "bg-emerald-400";
  const stockTone = outOfStock
    ? "border-rose-400/25 bg-rose-500/10 text-rose-200"
    : lowStock
      ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
      : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";

  const compat = part.compatibility ?? [];
  const compatVisible = compat.slice(0, 2);
  const compatMore = Math.max(0, compat.length - compatVisible.length);
  const dealerText = part.dealerName
    ? t("marketplace.product.sold_by", { dealer: part.dealerName })
    : t("marketplace.product.verified_dealer");

  return (
    <article className="rounded-2xl border border-cyan-500/20 bg-slate-900/80 p-4 backdrop-blur-md transition-all hover:border-cyan-400/40">
      <div className="flex gap-4">
        <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-cyan-400/35 bg-[#132337] shadow-[inset_0_0_18px_rgba(0,240,255,0.08)]">
          {part.imageUrl ? (
            <img
              src={part.imageUrl}
              alt={part.name}
              loading="lazy"
              className="h-24 w-24 rounded-xl object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#1a2f4a] text-cyan-300"
              aria-label={t("marketplace.product.no_image")}
            >
              <Ship className="size-7" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {part.brand && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                  {part.brand}
                </p>
              )}
              <h3 className="mt-0.5 line-clamp-1 text-base font-medium text-slate-100">
                {part.name}
              </h3>
              {part.sku && (
                <p className="mt-0.5 font-mono text-xs text-slate-400">{part.sku}</p>
              )}
            </div>
            <div className="flex shrink-0 items-start gap-1">
              {onAskAi && (
                <button
                  type="button"
                  onClick={() => onAskAi(part)}
                  aria-label="Ask AI"
                  className="grid size-8 place-items-center rounded-lg border border-white/10 bg-slate-800/80 text-cyan-300 transition-colors hover:bg-slate-700/80"
                >
                  <Sparkles className="size-3.5" />
                </button>
              )}
              <p className="text-lg font-bold tabular-nums text-amber-400">
                {currencyFormat(part.price)}
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={
                "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                stockTone
              }
            >
              <span className={"size-1.5 shrink-0 rounded-full " + stockDot} />
              <span className="truncate">{stockLabel}</span>
            </span>
            {part.emergencyCompatible && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                <Siren className="size-2.5" /> SOS
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 truncate text-[11px] text-slate-400">
        {dealerText}
        {part.marina ? <span className="text-slate-300"> · {part.marina}</span> : null}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {compat.length === 0 ? (
          <span className="text-[11px] italic text-slate-500">
            {t("marketplace.product.check_compatibility")}
          </span>
        ) : (
          <>
            {compatVisible.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300"
              >
                <Cpu className="size-2.5 text-cyan-300/70" /> {c}
              </span>
            ))}
            {compatMore > 0 && (
              <span className="text-[10px] font-semibold text-slate-400">
                {t("marketplace.product.more_compatibility", { count: compatMore })}
              </span>
            )}
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end">
        {actionSlot ??
          (outOfStock ? (
            <button
              type="button"
              onClick={() => onNotify?.(part)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200"
            >
              <Bell className="size-3.5" />
              {t("marketplace.product.notify_me")}
            </button>
          ) : (
            onAdd && (
              <button
                type="button"
                onClick={() => onAdd(part)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-950/40 transition-transform hover:from-cyan-400 hover:to-blue-500 active:scale-95"
              >
                <Plus className="size-3.5" />
                {t("marketplace.product.add_to_cart")}
              </button>
            )
          ))}
      </div>
    </article>
  );
}
