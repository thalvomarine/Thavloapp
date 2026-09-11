import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatTL } from "@/lib/filter";

interface Props {
  onOpen: () => void;
}

/**
 * Marketplace spare-parts cart — viewport-fixed above the dock, never inside
 * a product card. Portaled to `document.body` so `overflow-x-hidden` ancestors
 * cannot trap `position: fixed`.
 */
export function FloatingCartBar({ onOpen }: Props) {
  const { t } = useTranslation();
  const cart = useCart();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  if (!isMounted) return null;

  return createPortal(
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("marketplace.cart_aria")}
      className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] right-4 z-[35] inline-flex items-center gap-2 rounded-full border border-cyan-400/45 bg-[#0A192F]/95 px-3 py-2 text-left shadow-[0_10px_28px_-10px_rgba(0,240,255,0.45)] backdrop-blur-md transition-transform active:scale-95"
    >
      <span className="relative grid size-8 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-white">
        <ShoppingCart className="size-3.5" />
        {cart.count > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-slate-900">
            {cart.count}
          </span>
        )}
      </span>
      <span className="pr-0.5">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200/80">
          {t("shop.cart")}
        </span>
        <span className="block text-[12px] font-bold tabular-nums text-amber-300">
          {formatTL(cart.total)}
        </span>
      </span>
    </button>,
    document.body,
  );
}
