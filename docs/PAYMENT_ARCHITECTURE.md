# M9 — Real Payment / Escrow Architecture v1

THALVO is now ready to earn its first real commission. This phase
introduces the data model, RLS, ledger, commission and payout state
that any real payment provider (Stripe Connect, iyzico, PayTR) can plug
into without a schema rewrite.

## Core principle

Money must stay inside THALVO until the mission is completed.

## What is real

- **Data model.** `payment_intents`, `escrow_transactions`,
  `provider_payouts`, `commission_records`.
- **RLS.** Captain, provider, and admin each see only the rows they
  should. Service role writes system state.
- **Lifecycle.** Accepting an offer opens a payment intent and records a
  `secure` escrow transaction. Captain confirming completion marks the
  intent `released`, appends a `release` escrow transaction, writes a
  commission record, and creates a pending provider payout.
- **Provider view.** Providers see expected net, THALVO fee, and their
  payout status (`pending` / `processing` / `completed` / `failed`).
- **Admin ops.** `/app/admin` has an `AdminPaymentOpsPanel` showing
  held escrow, payouts owed, released volume, commission collected,
  pending / release-ready intents, and provider payouts pending. Manual
  admin actions (verify / release / refund / payout) are UI-disabled
  until a real provider is connected.
- **Copy.** The product is honest — "Simulated funding — real payment
  provider is not connected yet." No fake "insured" or "bank guarantee"
  language anywhere.

## What is still simulated / TODO

- **No real card capture.** `CheckoutModal` still renders card fields
  but does not send them anywhere. Payment intents are opened in
  `secured` status immediately by `record_payment_intent`.
  TODO(payments-provider): switch initial status to `pending` and let a
  Stripe / iyzico / PayTR webhook drive the transition to `secured`.
- **No real payout rail.** `provider_payouts` rows land in status
  `pending`. TODO(payments-provider): trigger a real payout job
  (Stripe Connect transfer, iyzico settlement, PayTR withdrawal) and
  mark `completed` via webhook.
- **No refund / dispute engine.** `escrow_transactions.kind` includes
  `refund`, `extra_secure`, `extra_release` but nothing writes them yet.
  TODO(payments-provider): add `refund_payment_intent`,
  `dispute_payment_intent` RPCs and admin actions.
- **`platform_ledger` is preserved.** Backward compatibility with the
  older admin `EscrowOpsPanel`. New consumers should read
  `commission_records` and `provider_payouts` instead.

## Events emitted (see `src/lib/events.ts`)

| Event                       | When                                        | Emitter                                    |
| --------------------------- | ------------------------------------------- | ------------------------------------------ |
| `payment.intent_created`    | Captain accepts an offer                    | `app.job.$id.tsx` → after `record_payment_intent` |
| `payment.secured`           | Same — simulated funding                    | `app.job.$id.tsx`                          |
| `escrow.secured`            | Same — legacy alias, kept for admin feed    | `app.job.$id.tsx`                          |
| `escrow.release_requested`  | Captain hits "Release escrow"               | `app.job.$id.tsx` `complete` handler       |
| `escrow.released`           | `complete_job` RPC succeeds                 | `app.job.$id.tsx`                          |
| `commission.recorded`       | `complete_job` writes `commission_records`  | `app.job.$id.tsx`                          |
| `payout.requested`          | `complete_job` writes `provider_payouts`    | `app.job.$id.tsx`                          |
| `payout.completed`          | Reserved — writer lands with real provider  | future webhook                             |

All emissions are fire-and-forget. TODO(server-side writers): move
privileged emissions into the `record_payment_intent` and `complete_job`
RPCs so the audit trail is provably server-authored.

## Files added

- `src/lib/payments.ts` — types, `computeCommission`, cents helpers,
  status labels/tones.
- `src/components/payments/PaymentStatusBadge.tsx` — payment intent +
  payout badges.
- `src/components/payments/PaymentIntentPanel.tsx` — captain-facing.
- `src/components/payments/EscrowLedgerPanel.tsx` — per-job append-only
  ledger view.
- `src/components/payments/ProviderPayoutPanel.tsx` — provider-facing
  expected net + fee + status.
- `src/components/payments/CommissionBreakdown.tsx` — inline gross → fee → net.
- `src/components/admin/AdminPaymentOpsPanel.tsx` — admin ops surface.

## Migration summary

- Tables: `payment_intents`, `escrow_transactions`, `provider_payouts`,
  `commission_records`.
- RPCs: `record_payment_intent(_job_id, _offer_id)`, `complete_job`
  upgraded to write commission + payout rows.
- RLS: captain / provider / admin read policies; writes are RPC-only.

## Limitations

- No idempotency layer yet on `record_payment_intent` — a double-click
  can theoretically open two intents on the same offer. Guard rail
  (unique index on `(offer_id, status='secured')`) is TODO before real
  cards land.
- `part_orders` (marketplace) has its own commission line via
  `platform_ledger` and does NOT flow through `payment_intents` yet.
  TODO(payments-provider): unify once dealer settlement lands.
- Currency defaults to EUR. Multi-currency ready at the schema level;
  UI is still EUR-only.

## Known duplicate ledger/payout rows (pre-Pass 1)

Security hardening Pass 1 (migration `20260729225749`) **deduplicated
`commission_records` by deleting rows** and then added the unique
constraint `commission_records_job_id_unique`. The equivalent duplicates
in `platform_ledger` and `provider_payouts` were **not** removed, so the
three financial tables no longer reconcile against each other.

Live counts at the time of Pass A.1:

| Table | Rows | Distinct jobs |
| --- | --- | --- |
| `commission_records` | 8 | 8 |
| `platform_ledger` | 13 | 8 (plus marketplace rows with `job_id IS NULL`) |
| `provider_payouts` | 9 | 8 |
| `escrow_transactions` (`kind='release'`) | 8 | 8 |

### Duplicated rows (job-scoped, `count(*) > 1`)

`platform_ledger` — job `8b8bbee2-44d8-48d1-a7d0-951c2aafef21`:

| id | commission_amount | provider_payout | created_at |
| --- | --- | --- | --- |
| `82cd089d-b854-42db-aa09-aa4c116c5dac` | 870 | 7830 | 2026-07-21 23:58:35.465887+00 |
| `4a706730-a2fe-4a0c-aa13-d02b9b186f33` | 870 | 7830 | 2026-07-21 23:58:36.346214+00 |

`provider_payouts` — job `8b8bbee2-44d8-48d1-a7d0-951c2aafef21`:

| id | amount_cents | status | created_at |
| --- | --- | --- | --- |
| `5fd425aa-cd45-487f-bec1-4ba97a6e72b8` | 783000 | pending | 2026-07-21 23:58:35.465887+00 |
| `c9eaf778-4b07-4f2a-b5af-f414ba592b87` | 783000 | pending | 2026-07-21 23:58:36.346214+00 |

The remaining `platform_ledger` surplus (13 rows vs 8 job-scoped jobs)
is marketplace commission written by `checkout_parts_cart` with
`job_id IS NULL`; those are legitimate, not duplicates.

**Status: unresolved on purpose.** Deleting or merging these rows changes
recorded financial history and requires an explicit product decision
(which row is canonical, whether the double payout was ever paid out, and
whether the ledger should instead carry a reversing entry). Pass A.1
therefore made **zero writes** to these tables and deliberately did *not*
add a unique constraint or index to `platform_ledger` /
`provider_payouts` — an existing-duplicate constraint would either fail
to create or invite a destructive cleanup.

**Forward-looking protection:** `complete_job` now (a) returns a jsonb
result contract so the client emits financial analytics events only on the
first real completion, and (b) inserts a `provider_payouts` row only when
no payout row exists for that job yet (`IF NOT EXISTS` guard inside the
function, not a constraint).
