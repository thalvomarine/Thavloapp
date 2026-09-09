# M8 — UI Consistency Pass

Goal: make every authenticated THALVO route feel like one premium MarineOS
product without adding features, changing schema, or breaking flows.

## Reference language

Mission Control (`/app`) is the visual reference. All dark cockpit surfaces
now share the same header typography, glass panels, radii and spacing via
`src/components/core/*` primitives.

## Header unification

`MarketplaceShell` and `BoatPassportShell` now delegate their header markup to
`CockpitHeader`. That makes the eyebrow / title / subtitle typography
identical across:

- `/app/marketplace`, `/app/shop`, `/app/dealer` — MarketplaceShell
- `/app/orders` — MarketplaceShell
- `/app/passport`, `/app/reputation` — BoatPassportShell
- `/app` (Mission Control), `/app/admin` — MissionShell / AdminControlTowerShell

Both shells gained an optional `subtitle` prop that maps directly to
`CockpitHeader.subtitle` for one-line context lines.

## Route-level primitive swaps

`/app/orders`:

- Empty state (`GlassPanel` + ad-hoc markup) → `EmptyState` from core.
- Top-right count chip (`StatusChip`) → `StatusBadge` from core.
- Order total in detail sheet (`formatTL` + span) → `MoneyAmount`.
- Marketplace CTA switched from `<a href>` to typed `<Link to>`.

## Colour discipline

The pass reinforces the M6 colour rules:

- Sky / blue → operational (LIVE ticks, active status, primary CTAs).
- Emerald → completed, delivered, protected.
- Amber → pending, warning, low stock.
- Rose / red → SOS emergency and blocked leaks only.

No component was migrated onto a stronger tone than it previously used.

## Not touched (intentional)

- `/app/services`, `/app/shop`, `/app/profile`, `/app/supplier` still render
  on the classic `AppShell` light surface. Converting these to dark cockpit
  is a redesign, not a consistency pass, and is tracked in
  `docs/TECHNICAL_DEBT.md` for a later phase.
- No schema, RLS, RPC, auth or routing changes.
- `AppShell` / `MissionShell` navigation, SOS dock and Thalvo AI fab
  untouched.

## Verification

- Typecheck: passes.
- All authenticated routes still resolve to the same components and data
  loaders as before M8.
- Mission Control, Job detail, Marketplace, Dealer, Orders, Passport,
  Reputation and Admin Tower all render on the same dark cockpit surface
  with matching header typography.

## Remaining debt

- Dark-cockpit migration for `/app/services`, `/app/shop`, `/app/profile`,
  `/app/supplier` (tracked in `docs/TECHNICAL_DEBT.md`).
- Retire `mission/StatusChip` in favour of `core/StatusBadge` opportunistically.
- Retire ad-hoc `.text-white/…` chip markup inside `admin/*` panels once the
  admin tower gets its next data pass.
