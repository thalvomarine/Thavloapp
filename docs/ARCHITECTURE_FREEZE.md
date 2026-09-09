# M6 — Architecture Freeze

Scope: stabilize THALVO MarineOS without adding new product features. This
milestone consolidates shared UI primitives, formatters and domain types
without touching schema, RLS, auth, SOS, escrow, marketplace, dealer,
passport, reputation, admin or security systems.

## What changed

- Added `src/types/marine.ts` — single import path for shared domain types
  (`OrderStatus`, `TrustTone`, `LeakRisk`, `MissionStatus`, `OfferStatus`,
  `EscrowState`, `ProviderRole`, `DeliveryMethod`, `VesselSummary`,
  `PartSummary`, `MarketplaceOrder`, `StatusTone`).
- Added `src/lib/formatters.ts` — canonical `formatMoney`, `formatEta`,
  `formatDistance`, `formatCoordinates`, `formatDateShort`,
  `formatRelative`, `humanizeStatus`.
- Added `src/lib/marine.ts` — `haversineKm`, `estimateEtaMinutes`,
  `toneForStatus`.
- Added `src/components/core/` — MarineOS primitive barrel:
  `CockpitPage`, `CockpitHeader`, `SectionHeader`, `MetricCard`,
  `StatusBadge`, `Timeline`/`TimelineStep`, `EmptyState`, `RiskBanner`,
  `DataPill`, `MoneyAmount`, `EtaBadge`, `TrustBadge`.

## What did NOT change

- No feature routes were redesigned.
- No Supabase schema, RLS policy, migration or RPC was modified.
- No existing component was deleted. The existing feature components
  (`mission/StatusChip`, `mission/GlassPanel`, `mission/ActionTile`,
  `security/SecurityWarningBanner`, `admin/AdminKpiRail`, `orders/*`, etc.)
  remain the source of truth for their features and continue to render
  identical markup.
- The anti-leak chat guard (`components/JobChat.tsx` +
  `lib/security.ts`) is untouched — RiskBanner is an alternative import
  path with matching styling.

## Adoption policy

New code should import from `@/components/core`, `@/lib/formatters`,
`@/lib/marine`, and `@/types/marine`. Existing screens migrate opportunistically
during future feature work — do not do wholesale rewrites purely to swap
imports, since existing components render identical output.

See `COMPONENT_CATALOG.md`, `DESIGN_TOKENS.md`, `TECHNICAL_DEBT.md`.
