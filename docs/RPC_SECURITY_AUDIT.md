# RPC Security Audit — THALVO (public schema, SECURITY DEFINER)

Scope: every `SECURITY DEFINER` function in `public` that is callable via the Data API (i.e. has an `EXECUTE` grant to `authenticated`). Trigger-only functions are listed at the end for completeness but are not RPC-reachable.

Audit baseline: post-migration `20260702233815` — `EXECUTE` on all public `SECURITY DEFINER` functions was revoked from `PUBLIC` and `anon`; only the RPCs listed below remain executable by `authenticated`.

Legend
- **Caller**: what auth surface can invoke it (anon / authenticated / service_role).
- **Internal auth**: `auth.uid()` / `has_role()` checks inside the body.
- **Writes**: tables the function `INSERT`/`UPDATE`/`DELETE`s.
- **Sensitive surface**: payments, escrow, admin, or user roles?

---

## 1. `has_role(_user_id uuid, _role app_role) → boolean`

- **Caller**: authenticated, service_role.
- **Internal auth**: none — pure read helper. Any authenticated user can ask "does user X have role Y?".
- **has_role required**: n/a (this *is* the helper).
- **Writes**: none. Reads `public.user_roles`.
- **Sensitive surface**: user roles (read-only). Existence of a role is disclosed to any signed-in user.
- **Risk**: Low. Membership disclosure is acceptable for RLS use. Do not expand output.
- **Action**: none.

## 2. `admin_list_users() → setof(...)`

- **Caller**: authenticated (self-guarded).
- **Internal auth**: `if not has_role(auth.uid(),'admin') then raise 'forbidden'`.
- **has_role required**: yes (admin).
- **Writes**: none. Reads `profiles` + `auth.users`.
- **Sensitive surface**: admin data (emails, roles). Correctly gated.
- **Risk**: Low.
- **Action**: none.

## 3. `accept_offer(_job_id uuid, _offer_id uuid) → void`

- **Caller**: authenticated.
- **Internal auth**: `update jobs ... where id=_job_id and client_id = auth.uid()`; raises if no rows.
- **has_role required**: no.
- **Writes**: `jobs` (provider_id, initial_labor_cost, total_escrow_pool, eta_minutes, status).
- **Sensitive surface**: sets provider payout basis and escrow pool → **payment-adjacent**.
- **Risk**: Medium. Trusts `_offer_id` price. The current body does not verify the offer belongs to a legitimate provider or that the job status permits acceptance (e.g. not already `Completed`).
- **Action**: TODO — tighten in a future migration:
  - guard on `jobs.status in ('BiddingOpen','OfferReceived',...)`;
  - reject if a `payment_intents` row already exists in `secured`/`released` for this job.
  - No behavior change in this pass.

## 4. `set_sail(_job_id uuid)` / `mark_arrived(_job_id uuid)`

- **Caller**: authenticated.
- **Internal auth**: `update jobs ... where id=_job_id and provider_id = auth.uid()`.
- **has_role required**: no.
- **Writes**: `jobs` (status, dispatched_at).
- **Sensitive surface**: none directly (status transitions only).
- **Risk**: Low. Silent no-op if caller is not the provider — acceptable.
- **Action**: none.

## 5. `add_extra_part(_job_id, _name, _price, _photo, _source) → uuid`

- **Caller**: authenticated (provider).
- **Internal auth**: `exists (... jobs where id=_job_id and provider_id=auth.uid())`.
- **has_role required**: no.
- **Writes**: `job_parts` (Pending), `jobs.status` → `PartsPending`.
- **Sensitive surface**: **payment-adjacent** — creates a line-item the captain will be asked to approve into escrow.
- **Risk**: Medium. `_price` is unbounded and untyped-scale; nothing prevents `1e9`. Approval is captain-consented so no auto-charge, but a hostile provider could DoS the captain UI with huge prices.
- **Action**: TODO — future migration: `check (_price > 0 and _price < 1_000_000)` and cap `_name`/`_source` length. No change now.

## 6. `approve_part(_part_id uuid)` / `reject_part(_part_id uuid)`

- **Caller**: authenticated (captain).
- **Internal auth**: `exists (... jobs where id=p.job_id and client_id=auth.uid())` → raises `Not authorized`.
- **has_role required**: no.
- **Writes**: `job_parts.payment_status`; `jobs.extra_parts_cost`, `jobs.total_escrow_pool`, `jobs.status`.
- **Sensitive surface**: **escrow pool mutation** — `approve_part` increases `total_escrow_pool` by the stored part price.
- **Risk**: Medium. Depends entirely on `add_extra_part` price sanity (see #5). Once tightened there, this is safe.
- **Action**: TODO — after #5 lands, add a defensive `check (p.part_price >= 0)` here too.

## 7. `record_payment_intent(_job_id uuid, _offer_id uuid) → uuid`

- **Caller**: authenticated (captain).
- **Internal auth**: `select jobs where id=_job_id`; `if _job.client_id <> auth.uid() then raise 'not authorized'`.
- **has_role required**: no.
- **Writes**: `payment_intents` (status `secured`), `escrow_transactions` (kind `secure`).
- **Sensitive surface**: **payments/escrow** — creates the "funded" record. Currently `provider='simulated'`; no real charge occurs.
- **Risk**: Medium while simulated (a captain could create arbitrarily many `secured` intents without paying). Acceptable for M9 pre-PSP scope, but must NOT ship to production as-is.
- **Action**: TODO — when real PSP lands, only insert `secured` after webhook confirmation. Add uniqueness/idempotency guard `(job_id, status='secured')`.

## 8. `complete_job(_job_id uuid) → void`

- **Caller**: authenticated (captain).
- **Internal auth**: `where id = _job_id and client_id = auth.uid()`; raises `Not authorized`.
- **has_role required**: no.
- **Writes**: `jobs.status`, `profiles.wallet_balance` (provider), `platform_ledger`, `payment_intents` (→ `released`), `escrow_transactions` (kind `release`), `commission_records`, `provider_payouts`.
- **Sensitive surface**: **payments, escrow, wallet, ledger** — highest-value RPC in the app.
- **Risk**: Medium.
  - Captain-gated correctly.
  - `wallet_balance` is credited immediately, but `provider_payouts.status='pending'` — payout is not "settled" until a real PSP webhook flips it (documented in `PAYMENT_ARCHITECTURE.md`).
  - No idempotency guard: calling twice would double-credit `wallet_balance` if the first call set status to `Completed` but the `where` filter still matches (it will not, because `jobs.status` becomes `Completed` and there is no status filter — **so a second call re-credits**). Currently the second `update` still succeeds because there is no `and status <> 'Completed'` predicate.
- **Action**: TODO (safety) — future migration: add `and status <> 'Completed'` to the initial `select` guard, or a unique `commission_records(job_id)` constraint. Do NOT change behavior in this pass.

## 9. `checkout_parts_cart(_items jsonb, _delivery_marina text[, ...])` (two overloads)

- **Caller**: authenticated (buyer).
- **Internal auth**: `if auth.uid() is null then raise 'auth required'`.
- **has_role required**: no.
- **Writes**: `part_orders`, `part_order_items`, `parts_catalog.stock` (decrement), `platform_ledger`.
- **Sensitive surface**: **payments (marketplace commission)** and **inventory**.
- **Risk**: Medium.
  - Ledger is inserted at checkout time — comment marks this as a phase-9 TODO (should defer to Delivered).
  - Stock decrement is not transactional against a "reserve" step; concurrent checkouts can over-decrement to 0 but `greatest(0, ...)` masks negatives — a customer can order out-of-stock items.
  - Price is trusted from `parts_catalog` (server-side) — good.
- **Action**: TODOs already noted in the function body; leave for phase-9. No behavior change now.

---

## Trigger-only (NOT RPC-reachable — no `authenticated` EXECUTE grant)

- `handle_new_user()` — auth.users AFTER INSERT → seeds `profiles`.
- `prevent_profile_privilege_escalation()` — profiles BEFORE UPDATE → blocks role/wallet self-edit.
- `set_updated_at()` — generic updated_at trigger.
- `mask_job_message()` — job_messages BEFORE INSERT → PII/contact redaction.

These have `SECURITY DEFINER` for privilege reasons but are unreachable from PostgREST/Data API. No action.

---

## Cross-cutting findings

| # | Concern | Severity | RPCs |
|---|---------|----------|------|
| A | Missing idempotency on money-moving RPCs | Medium | `complete_job`, `record_payment_intent` |
| B | Unbounded numeric input | Low-Medium | `add_extra_part` |
| C | Simulated payment intent can be created without a real charge | Medium (until PSP integration) | `record_payment_intent` |
| D | No status-guard on `accept_offer` | Low | `accept_offer` |

None of these are exploitable to steal money today because:
- All money-moving RPCs are captain-scoped (`client_id = auth.uid()`).
- `provider_payouts` remains `pending` — no real payout occurs.
- `platform_ledger` and `wallet_balance` are internal accounting; no external transfer is triggered.

## Grants summary (post-hardening)

- `anon`: no EXECUTE on any `public` SECURITY DEFINER function.
- `PUBLIC`: no EXECUTE on any `public` SECURITY DEFINER function.
- `authenticated`: EXECUTE on the 11 RPCs above only.
- `service_role`: EXECUTE on all (expected for admin/backend tooling).

## Recommended next migration (not applied in this pass)

```sql
-- Idempotency for complete_job (safe, non-breaking)
ALTER TABLE public.commission_records
  ADD CONSTRAINT commission_records_job_id_unique UNIQUE (job_id);

-- Price sanity for add_extra_part
ALTER TABLE public.job_parts
  ADD CONSTRAINT job_parts_price_sane CHECK (part_price >= 0 AND part_price < 1000000);
```

These are queued as TODOs; behavior is unchanged in this audit pass.
