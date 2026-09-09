// Marketplace logistics order vocabulary + helpers (Phase 9).
// Statuses are stored as plain text on public.part_orders to avoid an enum migration.

export type OrderStatus =
  | "Draft"
  | "Submitted"
  | "DealerReview"
  | "Confirmed"
  | "Preparing"
  | "OutForDelivery"
  | "Delivered"
  | "Completed"
  | "Cancelled"
  // Legacy row seed from pre-Phase-9 checkouts.
  | "Paid";

export const ORDER_FLOW: OrderStatus[] = [
  "Submitted",
  "DealerReview",
  "Confirmed",
  "Preparing",
  "OutForDelivery",
  "Delivered",
  "Completed",
];

export type OrderTone = "neutral" | "info" | "warning" | "success" | "danger";

export function toneForOrder(status: OrderStatus): OrderTone {
  switch (status) {
    case "Draft":
    case "Submitted":
    case "DealerReview":
      return "warning";
    case "Confirmed":
    case "Preparing":
    case "OutForDelivery":
    case "Paid":
      return "info";
    case "Delivered":
    case "Completed":
      return "success";
    case "Cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

/** i18n key for an order status. Resolve with `t()` at the call site. */
export function labelKeyForOrder(status: OrderStatus): string {
  return `orders.status.${status}`;
}

export type DeliveryMethod = "marina_pickup" | "service_boat";

/** i18n key for a delivery method. Resolve with `t()` at the call site. */
export function labelKeyForDelivery(method: DeliveryMethod | string | null | undefined): string {
  return method === "marina_pickup"
    ? "orders.delivery.marina_pickup"
    : "orders.delivery.service_boat";
}


// Dealer-visible next state given the current state. Returning null means no advance.
export function nextDealerState(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case "Submitted":
    case "DealerReview":
      return "Confirmed";
    case "Confirmed":
      return "Preparing";
    case "Preparing":
      return "OutForDelivery";
    case "OutForDelivery":
      return "Delivered";
    default:
      return null;
  }
}

/** i18n key for the dealer CTA that advances to `next`. Null when terminal. */
export function ctaKeyForNext(next: OrderStatus | null): string | null {
  if (!next) return null;
  switch (next) {
    case "Confirmed":
    case "Preparing":
    case "OutForDelivery":
    case "Delivered":
      return `orders.cta.${next}`;
    default:
      return labelKeyForOrder(next);
  }
}

