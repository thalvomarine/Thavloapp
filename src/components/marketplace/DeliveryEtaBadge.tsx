import { Anchor, Clock, Truck } from "lucide-react";

interface Props {
  mode: "marina_pickup" | "service_boat";
  minutes?: number | null;
  distanceKm?: number | null;
  className?: string;
}

/** DeliveryEtaBadge — logistics-first ETA hint. */
export function DeliveryEtaBadge({ mode, minutes, distanceKm, className = "" }: Props) {
  const isPickup = mode === "marina_pickup";
  const Icon = isPickup ? Anchor : Truck;
  const label = isPickup ? "Marina pickup" : "Service boat delivery";
  const suffix =
    minutes != null
      ? ` · ${minutes} min`
      : distanceKm != null
        ? ` · ${distanceKm.toFixed(1)} km`
        : "";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/10 text-sky-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] " +
        className
      }
    >
      <Icon className="size-2.5" />
      {label}
      {suffix && <span className="text-sky-200/90 inline-flex items-center gap-0.5"><Clock className="size-2.5" />{suffix}</span>}
    </span>
  );
}
