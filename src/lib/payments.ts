/**
 * THALVO M9 — Payment / Escrow helpers.
 *
 * The product is honest about what is real:
 *   - Data model, RLS, ledger, commission and payout state ARE real.
 *   - The money movement itself is SIMULATED until Stripe Connect /
 *     iyzico / PayTR is connected. See TODO(payments-provider).
 *
 * All amounts are stored server-side in the smallest currency unit
 * (cents). The platform operates in Turkish Lira (TRY) — every migration
 * writes 'TRY' into escrow_transactions, commission_records,
 * payment_intents and provider_payouts, so TRY is the single source of
 * truth for rendering as well. The helpers below convert to/from
 * whole-unit numbers for UI rendering only — never for math on server
 * writes.
 */

/** The single currency the platform operates in. Matches every stored row. */
export const CURRENCY = "TRY" as const;


export type PaymentIntentStatus =
  | "created"
  | "pending"
  | "secured"
  | "released"
  | "refunded"
  | "failed";

export type PayoutStatus = "pending" | "processing" | "completed" | "failed";

export type EscrowTransactionKind =
  | "secure"
  | "release"
  | "refund"
  | "extra_secure"
  | "extra_release";

/** THALVO's default marketplace commission on labor missions. */
export const THALVO_COMMISSION_RATE = 0.1;

export interface CommissionBreakdown {
  gross: number;
  fee: number;
  net: number;
  rate: number;
}

/** Compute a THALVO commission breakdown in whole currency units. */
export function computeCommission(gross: number, rate = THALVO_COMMISSION_RATE): CommissionBreakdown {
  const g = Math.max(0, Number(gross) || 0);
  const fee = Math.round(g * rate * 100) / 100;
  return { gross: g, fee, net: Math.max(0, g - fee), rate };
}

/** Convert cents (server) → whole currency units (UI). */
export function centsToUnits(cents: number | null | undefined): number {
  if (cents == null) return 0;
  return Number(cents) / 100;
}

/** Outcome of the idempotent `complete_job` RPC. */
export type CompleteJobOutcome = "completed" | "already_completed" | "unknown";

/**
 * Read the `complete_job` RPC payload defensively. Anything that is not an
 * object literal carrying one of the two known statuses is "unknown", so the
 * caller never emits financial telemetry on an unexpected shape.
 */
export function readCompleteJobResult(data: unknown): CompleteJobOutcome {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return "unknown";
  const status = (data as { status?: unknown }).status;
  if (status === "completed") return "completed";
  if (status === "already_completed") return "already_completed";
  return "unknown";
}

// ---------- Status metadata ----------
//
// Labels are exposed as i18n KEYS, never as literal English. Plain modules
// must not import a React hook, so the call site resolves the key with its
// own `t` — see PaymentStatusBadge / EscrowLedgerPanel.

export const PAYMENT_STATUS_LABEL_KEY: Record<PaymentIntentStatus, string> = {
  created: "payments.status.created",
  pending: "payments.status.pending",
  secured: "payments.status.secured",
  released: "payments.status.released",
  refunded: "payments.status.refunded",
  failed: "payments.status.failed",
};

export const PAYMENT_STATUS_TONE: Record<
  PaymentIntentStatus,
  "neutral" | "warning" | "info" | "success" | "danger"
> = {
  created: "neutral",
  pending: "warning",
  secured: "info",
  released: "success",
  refunded: "warning",
  failed: "danger",
};

export const PAYOUT_STATUS_LABEL_KEY: Record<PayoutStatus, string> = {
  pending: "payments.payout.pending",
  processing: "payments.payout.processing",
  completed: "payments.payout.completed",
  failed: "payments.payout.failed",
};

export const PAYOUT_STATUS_TONE: Record<
  PayoutStatus,
  "neutral" | "warning" | "info" | "success" | "danger"
> = {
  pending: "warning",
  processing: "info",
  completed: "success",
  failed: "danger",
};

export const ESCROW_KIND_LABEL_KEY: Record<EscrowTransactionKind, string> = {
  secure: "payments.escrow_kind.secure",
  release: "payments.escrow_kind.release",
  refund: "payments.escrow_kind.refund",
  extra_secure: "payments.escrow_kind.extra_secure",
  extra_release: "payments.escrow_kind.extra_release",
};

