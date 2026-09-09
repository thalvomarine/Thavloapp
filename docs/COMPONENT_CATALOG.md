# Component Catalog

## Core primitives (`src/components/core/`)

| Primitive       | Purpose                                                            |
| --------------- | ------------------------------------------------------------------ |
| `CockpitPage`   | Consistent vertical spacing for a feature page body                |
| `CockpitHeader` | Eyebrow + title + subtitle + actions row                           |
| `SectionHeader` | Micro-label + optional value/action inside a GlassPanel            |
| `MetricCard`    | Single KPI cell (label / value / hint) matching AdminKpiRail cells |
| `StatusBadge`   | Canonical MarineOS status pill (5 tones)                           |
| `Timeline` / `TimelineStep` | Vertical operational timeline                          |
| `EmptyState`    | Calm placeholder for feeds / queues / tables                       |
| `RiskBanner`    | Anti-leak / risk banner (safe / low / medium / high)               |
| `DataPill`      | Compact key/value pill for headers and incident detail             |
| `MoneyAmount`   | Tabular EUR value using `formatMoney`                              |
| `EtaBadge`      | Normalized ETA pill using `formatEta`                              |
| `TrustBadge`    | Trust tone pill (reliable / building / watch / risk)               |

## Feature families (unchanged)

- `mission/` — Cockpit shell, glass panel, action tile, SOS dock, offer/mission cards, escrow, provider trust, AI advisor.
- `marketplace/` — Part card, dealer stock, dealer trust badge, stock/delivery/compatibility badges.
- `orders/` — Order timeline, dealer queue, logistics order card, delivery method selector, fulfillment badge, security notice.
- `passport/` — Vessel identity, installed parts, maintenance due, document vault, vessel AI, health timeline.
- `trust/` — Trust score card, reputation panel, trust breakdown/metric row, verification badge, explanation sheet.
- `security/` — Security warning banner, message leak guard, masked contact, security event card, admin security panel.
- `admin/` — Control tower shell, KPI rail, mission command board, incident detail, provider ops list, escrow/marketplace ops, trust watchlist, platform event feed.

## Consolidation mapping

| Existing feature component    | Core primitive with matching semantics |
| ----------------------------- | -------------------------------------- |
| `mission/StatusChip`          | `core/StatusBadge`                     |
| `security/SecurityWarningBanner` | `core/RiskBanner`                   |
| `admin/AdminKpiRail` cells    | `core/MetricCard`                      |

Both variants coexist. New code uses the core primitive; existing code is
migrated opportunistically during feature work.
