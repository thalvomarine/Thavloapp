# Technical Debt Register

Tracks known deficiencies after M6 Architecture Freeze so future phases
can pick them up without re-discovering.

## Security

- **Server-side leak enforcement.** The chat leak guard is currently
  client-side plus a DB masking trigger. High-risk classification MUST
  also fail server-side via a Supabase RPC before we advertise the
  guarantee. See `src/lib/security.ts` and `components/JobChat.tsx`.
- **`security_events` audit table.** Blocked send attempts are not
  persisted. Add a table + RLS + admin read policy in a future phase.
- **`MaskedContact` reveal.** Currently UI-only; must be gated by a
  server RPC that checks role and logs the reveal.

## Reputation

- **Event-sourced reputation.** `lib/trust.ts` derives scores from
  ratings + volume only. Real event sources (arrival timestamps,
  dispute log, KYC state, response speed) are marked `null` and
  rendered as "Building score" placeholders.

## Orders / logistics

- **Multi-dealer cart split.** `checkout_parts_cart` derives a single
  dealer from cart contents; carts spanning multiple dealers are not
  yet split into multiple orders.
- **Payment + escrow.** No real payment capture. Escrow release on
  delivery is a UI state, not a ledger event.
- **Courier / service-boat dispatch.** Delivery ETA is a heuristic;
  no dispatcher assignment or GPS tracking yet.

## Admin

- **Admin RLS override.** Cross-tenant visibility relies on existing
  policies; dedicated `admin`-only override policies + `admin_events`
  audit log are not yet in place.
- **Destructive actions.** "Resolve dispute", "Flag for review", etc.
  are disabled placeholders.

## Design system

- The legacy `mission/StatusChip`, `security/SecurityWarningBanner`
  and `admin/AdminKpiRail` cells duplicate the new
  `core/StatusBadge`, `core/RiskBanner` and `core/MetricCard`
  respectively. Removal is deferred until every call site has been
  migrated during normal feature work.
- Some panels still hand-format currency via `.toFixed(2)`. Migrate
  to `formatMoney` from `@/lib/formatters` when touched.

## Performance

- `MissionShell` re-queries `user_roles` on every mount; a cached
  role hook in `src/hooks/` would cut a round-trip per navigation.
- The admin `LiveMap` re-renders on every provider list change; a
  memoized selector on the tower shell would help at scale.
