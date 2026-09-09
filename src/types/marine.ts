/**
 * THALVO shared marine vocabulary — M6 Architecture Freeze.
 *
 * Re-exports the domain types that were previously scattered across
 * feature modules so downstream code has ONE canonical import path:
 *
 *   import type { OrderStatus, TrustTone, LeakRisk } from "@/types/marine";
 *
 * Existing modules continue to own the source of truth for their types
 * (orders.ts, trust.ts, security.ts). This file only aggregates.
 */

export type { OrderStatus, OrderTone, DeliveryMethod } from "@/lib/orders";
export type { TrustTone, TrustInputs, TrustMetric, TrustReport } from "@/lib/trust";
export type { LeakRisk, LeakReport } from "@/lib/security";
export type { Profile } from "@/lib/session";

// Domain vocabulary that is used in props/UI but had no single home yet.

export type MissionStatus =
  | "Draft"
  | "Broadcast"
  | "Matching"
  | "InProgress"
  | "Completed"
  | "Cancelled";

export type OfferStatus = "Pending" | "Accepted" | "Declined" | "Expired";

export type EscrowState = "None" | "Held" | "Released" | "Refunded" | "Disputed";

export type ProviderRole = "Mechanic" | "Diver" | "Towing" | "Fuel" | "Cleaning" | "Other";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface VesselSummary {
  id: string;
  name: string;
  boat_type: string | null;
  length_m: number | null;
  home_marina: string | null;
}

export interface PartSummary {
  id: string;
  name: string;
  sku: string | null;
  price_eur: number | null;
  stock: number | null;
}

export interface MarketplaceOrder {
  id: string;
  status: string;
  total_eur: number | null;
  delivery_method: string | null;
  dealer_id: string | null;
  vessel_id: string | null;
  created_at: string;
}
