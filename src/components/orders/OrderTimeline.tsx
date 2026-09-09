import { ORDER_FLOW, labelKeyForOrder, type OrderStatus } from "@/lib/orders";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

interface Props {
  status: OrderStatus;
  cancelled?: boolean;
}

/**
 * Vertical mission-dispatch timeline for a marketplace order.
 * Uses calm blue for the active leg, green for completed steps, amber for pending.
 */
export function OrderTimeline({ status, cancelled }: Props) {
  const { t } = useTranslation();
  const currentIndex = cancelled ? -1 : ORDER_FLOW.indexOf(status);

  return (
    <ol className="relative border-l border-white/10 pl-4 space-y-3">
      {ORDER_FLOW.map((step, idx) => {
        const done = !cancelled && idx < currentIndex;
        const active = !cancelled && idx === currentIndex;
        return (
          <li key={step} className="relative">
            <span
              className={
                "absolute -left-[21px] top-0.5 grid size-3.5 place-items-center rounded-full border " +
                (done
                  ? "bg-emerald-400 border-emerald-300"
                  : active
                  ? "bg-sky-400 border-sky-300 shadow-[0_0_10px_theme(colors.sky.400)]"
                  : "bg-white/5 border-white/15")
              }
            >
              {done && <Check className="size-2 text-slate-900" strokeWidth={3} />}
            </span>
            <p
              className={
                "text-[12px] font-semibold tracking-tight " +
                (done ? "text-emerald-200" : active ? "text-white" : "text-white/40")
              }
            >
              {t(labelKeyForOrder(step))}
            </p>
          </li>
        );
      })}
      {cancelled && (
        <li className="relative">
          <span className="absolute -left-[21px] top-0.5 size-3.5 rounded-full bg-rose-500 border border-rose-400" />
          <p className="text-[12px] font-semibold tracking-tight text-rose-300">{t("orders.status.Cancelled")}</p>
        </li>
      )}
    </ol>
  );
}
