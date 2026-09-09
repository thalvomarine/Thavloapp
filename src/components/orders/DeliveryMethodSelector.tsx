import { Anchor, Waves } from "lucide-react";
import type { DeliveryMethod } from "@/lib/orders";

interface Props {
  value: DeliveryMethod;
  onChange: (v: DeliveryMethod) => void;
  disablePickup?: boolean;
  disableBoat?: boolean;
}

/**
 * Segmented control between marina pickup and service boat delivery.
 * Dark MarineOS styling — operational, not e-commerce.
 */
export function DeliveryMethodSelector({ value, onChange, disablePickup, disableBoat }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Option
        active={value === "marina_pickup"}
        disabled={disablePickup}
        icon={<Anchor className="size-4" />}
        title="Marina pickup"
        hint="Captain picks up at dealer berth"
        onClick={() => !disablePickup && onChange("marina_pickup")}
      />
      <Option
        active={value === "service_boat"}
        disabled={disableBoat}
        icon={<Waves className="size-4" />}
        title="Service boat"
        hint="Delivered to your vessel"
        onClick={() => !disableBoat && onChange("service_boat")}
      />
    </div>
  );
}

function Option({
  active,
  disabled,
  icon,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "text-left rounded-2xl border px-3 py-2.5 transition-colors disabled:opacity-40 " +
        (active
          ? "border-sky-400/60 bg-sky-400/10 text-white"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10")
      }
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
        {icon}
        {title}
      </span>
      <span className="block mt-1 text-[11px] text-white/50 leading-snug">{hint}</span>
    </button>
  );
}
