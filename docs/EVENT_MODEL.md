# M7 — Event Model

THALVO's business events land in `public.platform_events`. This is the
foundation for trust score, AI memory, admin audit trail, escrow ledger,
notifications, analytics and dispute resolution.

## Schema

```
platform_events
  id            uuid  PK
  actor_id      uuid  nullable — who triggered it
  subject_type  text  not null — 'job' | 'offer' | 'order' | 'escrow' | 'chat' | 'mission' | 'stock' | 'platform'
  subject_id    uuid  nullable — id of the affected row
  event_type    text  not null — dotted: '<subject>.<action>'
  severity      text  default 'info' — 'info' | 'success' | 'warning' | 'critical'
  metadata      jsonb default '{}'
  created_at    timestamptz default now()
```

Indexes: `created_at DESC`, `actor_id`, `(subject_type, subject_id)`,
`event_type`.

## RLS

- Admins (`has_role(auth.uid(), 'admin')`) can read all events.
- Users can read events where `actor_id = auth.uid()`.
- Authenticated users can insert events only where `actor_id = auth.uid()`
  or `actor_id IS NULL` (the client emitter fills it from
  `auth.getUser()`).
- Service role has full access for future server-side writers.

## Event vocabulary (v1)

| Event                    | Severity  | Subject   | Emitter (today)                              |
| ------------------------ | --------- | --------- | -------------------------------------------- |
| `sos.created`            | critical  | job       | `SosSheet.tsx` after job insert              |
| `mission.created`        | info      | mission   | `app.services.tsx`, `app.report.tsx`         |
| `offer.submitted`        | info      | offer     | `app.index.tsx` provider list                |
| `offer.accepted`         | success   | offer     | `app.job.$id.tsx` after `accept_offer` RPC   |
| `escrow.secured`         | success   | escrow    | `app.job.$id.tsx` alongside `offer.accepted` |
| `escrow.viewed`          | info      | escrow    | reserved — not yet emitted                   |
| `order.submitted`        | info      | order     | `app.shop.tsx` after `checkout_parts_cart`   |
| `order.status_advanced`  | info      | order     | `DealerOrderQueue.tsx`                       |
| `chat.high_risk_blocked` | warning   | chat      | `JobChat.tsx` guard                          |
| `admin.mission_viewed`   | info      | mission   | `app.admin.tsx` mission selection            |

New events: add to `EventType`, `EVENT_LABELS`, `EVENT_SEVERITY` in
`src/lib/events.ts` — that is the single registry.

## Client emitter — `emitEvent`

```ts
import { emitEvent } from "@/lib/events";

emitEvent({
  type: "order.submitted",
  subject_type: "order",
  subject_id: orderId,
  metadata: { item_count: 3, delivery_method: "marina_pickup" },
});
```

Rules:

- **Fire-and-forget.** `emitEvent` never awaits and never throws. If the
  insert fails, the primary user action still completes.
- **Never gate UX on event success.** Do not `await` the emit.
- **Never put secrets or PII in `metadata`.** Chat, phone numbers, IBANs
  and full addresses stay out of `metadata`; the row is admin-visible.

## What's real vs TODO

- **Real:** table, RLS, indexes, `emitEvent` helper, integration at the
  ten call sites listed above, admin feed prefers `platform_events` when
  present and falls back to derived activity when empty.
- **TODO (server-side writers).** Every current emitter is client-side.
  Privileged events (`offer.accepted`, `order.status_advanced`,
  `escrow.secured`) SHOULD be inserted inside the corresponding
  `SECURITY DEFINER` RPC (`accept_offer`, `checkout_parts_cart`, a new
  `advance_order`). Until that ships, client emissions are treated as
  telemetry, not as audit truth. The `actor_id = auth.uid()` RLS check
  prevents identity forgery but not lies about `event_type` /
  `metadata`.
- **TODO (notifications).** No consumer subscribes to
  `platform_events` yet. Add a realtime channel on the admin tower and
  a per-user feed once the shape is stable.
- **TODO (reputation).** `lib/trust.ts` still derives scores from
  ratings + volume. Fold event counts (offer.accepted / order.delivered
  / chat.high_risk_blocked) into the reputation model in the next
  phase.
- **TODO (analytics).** Add a materialized view or `pg_cron`
  aggregation for platform-wide dashboards; direct `SELECT` from
  `platform_events` is fine at current volume.
- **TODO (retention).** Add a retention policy (e.g. 180 days) before
  the table grows past millions of rows.

## Do not

- Do not emit events inside render — always in event handlers or effect
  callbacks after the primary action.
- Do not read secrets, tokens, or masked chat body into `metadata`.
- Do not use `platform_events` as a queue or transactional outbox —
  it is append-only telemetry, not a job runner.
