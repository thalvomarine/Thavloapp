import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatTL } from "@/lib/filter";

interface Props {
  onOpen: () => void;
}

/** Marketplace-only floating cart — sits above the dock, hidden on the chart. */
export function FloatingCartBar({ onOpen }: Props) {
  const { t } = useTranslation();
  const cart = useCart();
  if (typeof document === "undefined") return null;

  return createPortal(
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("marketplace.cart_aria")}
      className="fixed right-4 z-40 inline-flex items-center gap-2.5 rounded-full border border-cyan-400/40 bg-[#0a192f]/92 px-3.5 py-2.5 text-left shadow-[0_10px_28px_-10px_rgba(0,240,255,0.45)] backdrop-blur-md transition-transform active:scale-95"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
    >
      <span className="relative grid size-9 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-white">
        <ShoppingCart className="size-4" />
        {cart.count > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-4 h-4 place-items-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-slate-900">
            {cart.count}
          </span>
        )}
      </span>
      <span className="pr-1">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200/70">
          {t("shop.cart")}
        </span>
        <span className="block text-[13px] font-bold tabular-nums text-amber-300">
          {formatTL(cart.total)}
        </span>
      </span>
    </button>,
    document.body,
  );
}
