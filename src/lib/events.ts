/**
 * THALVO event backbone — M7 Event Architecture v1.
 *
 * Best-effort event emitter. NEVER awaits — the caller keeps flowing even
 * if the insert fails. All events land in `public.platform_events`.
 *
 * TODO(M7-server-writes): today many events are emitted from the client
 * for pragmatic reasons (existing RPCs like `accept_offer` and
 * `checkout_parts_cart` do not yet emit their own events). Once the
 * server-side event writer is in place, remove the corresponding client
 * `emitEvent` call and add a server-side insert inside the RPC. Client
 * inserts of privileged events (offer.accepted, order.status_advanced)
 * are advisory — the RLS `actor_id = auth.uid()` check prevents forgery
 * of another user's identity but does not prevent a hostile client from
 * lying about `event_type` or `metadata`. Treat client-emitted events as
 * telemetry, not as trust primitives, until the server writer ships.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  AlertTriangle,
  Activity,
  Wallet,
  Package,
  ShieldCheck,
  Ship,
} from "lucide-react";

// ---------- Vocabulary ----------

export type EventSubjectType =
  | "job"
  | "offer"
  | "order"
  | "escrow"
  | "chat"
  | "mission"
  | "stock"
  | "platform";

export type EventSeverity = "info" | "success" | "warning" | "critical";

/**
 * Canonical event type strings. Keep flat and dotted — subject.action.
 * Adding a new type here is the ONLY place to register a label + tone.
 */
export type EventType =
  | "sos.created"
  | "mission.created"
  | "offer.submitted"
  | "offer.accepted"
  | "escrow.viewed"
  | "escrow.secured"
  | "order.submitted"
  | "order.status_advanced"
  | "chat.high_risk_blocked"
  | "admin.mission_viewed"
  | "admin.role_approved"
  | "admin.role_request_cleared"
  | "admin.provider_verified"
  | "admin.provider_unverified"
  | "admin.listing_deactivated"
  | "admin.listing_reactivated"
  | "payment.intent_created"
  | "payment.secured"
  | "escrow.release_requested"
  | "escrow.released"
  | "commission.recorded"
  | "payout.requested"
  | "payout.completed";

// ---------- Label keys & tones ----------
//
// This module is plain (non-React), so it exposes i18n KEYS. Call sites
// resolve them with their own `t` function.

export const EVENT_LABEL_KEYS: Record<EventType, string> = {
  "sos.created": "events.sos_created",
  "mission.created": "events.mission_created",
  "offer.submitted": "events.offer_submitted",
  "offer.accepted": "events.offer_accepted",
  "escrow.viewed": "events.escrow_viewed",
  "escrow.secured": "events.escrow_secured",
  "order.submitted": "events.order_submitted",
  "order.status_advanced": "events.order_status_advanced",
  "chat.high_risk_blocked": "events.chat_high_risk_blocked",
  "admin.mission_viewed": "events.admin_mission_viewed",
  "admin.role_approved": "events.admin_role_approved",
  "admin.role_request_cleared": "events.admin_role_request_cleared",
  "admin.provider_verified": "events.admin_provider_verified",
  "admin.provider_unverified": "events.admin_provider_unverified",
  "admin.listing_deactivated": "events.admin_listing_deactivated",
  "admin.listing_reactivated": "events.admin_listing_reactivated",
  "payment.intent_created": "events.payment_intent_created",
  "payment.secured": "events.payment_secured",
  "escrow.release_requested": "events.escrow_release_requested",
  "escrow.released": "events.escrow_released",
  "commission.recorded": "events.commission_recorded",
  "payout.requested": "events.payout_requested",
  "payout.completed": "events.payout_completed",
};


export const EVENT_SEVERITY: Record<EventType, EventSeverity> = {
  "sos.created": "critical",
  "mission.created": "info",
  "offer.submitted": "info",
  "offer.accepted": "success",
  "escrow.viewed": "info",
  "escrow.secured": "success",
  "order.submitted": "info",
  "order.status_advanced": "info",
  "chat.high_risk_blocked": "warning",
  "admin.mission_viewed": "info",
  "admin.role_approved": "success",
  "admin.role_request_cleared": "info",
  "admin.provider_verified": "success",
  "admin.provider_unverified": "warning",
  "admin.listing_deactivated": "warning",
  "admin.listing_reactivated": "info",
  "payment.intent_created": "info",
  "payment.secured": "success",
  "escrow.release_requested": "info",
  "escrow.released": "success",
  "commission.recorded": "success",
  "payout.requested": "info",
  "payout.completed": "success",
};

// Reused by admin feed so a raw row from platform_events can render.
export type EventKindGlyph = "sos" | "mission" | "offer" | "escrow" | "stock" | "chat" | "security";

export function glyphForEvent(type: string): EventKindGlyph {
  if (type.startsWith("sos")) return "sos";
  if (type.startsWith("offer")) return "offer";
  if (type.startsWith("escrow")) return "escrow";
  if (type.startsWith("order")) return "escrow";
  if (type.startsWith("chat")) return "chat";
  if (type.startsWith("stock")) return "stock";
  if (type.startsWith("admin")) return "security";
  return "mission";
}

/** Icon type re-export to avoid importing lucide across every consumer. */
export type EventIconName =
  | typeof AlertTriangle
  | typeof Ship
  | typeof Activity
  | typeof Wallet
  | typeof Package
  | typeof ShieldCheck;

// ---------- Row shape (Supabase-adjacent, kept local to avoid a hard type dep) ----------

export interface PlatformEventRow {
  id: string;
  actor_id: string | null;
  subject_type: string;
  subject_id: string | null;
  event_type: string;
  severity: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ---------- Emit ----------

export interface EmitEventInput {
  type: EventType;
  subject_type: EventSubjectType;
  subject_id?: string | null;
  metadata?: Record<string, unknown>;
  /** Override severity; defaults to EVENT_SEVERITY[type]. */
  severity?: EventSeverity;
}

/**
 * Best-effort emit. Does NOT throw. Fire-and-forget from a UI action:
 *
 *   emitEvent({ type: "sos.created", subject_type: "job", subject_id: id });
 *
 * If the network / RLS blocks the insert, the primary user action still
 * completes. Failures are logged to the console but never surfaced.
 */
export function emitEvent(input: EmitEventInput): void {
  const payload = {
    actor_id: null as string | null, // resolved async below
    subject_type: input.subject_type,
    subject_id: input.subject_id ?? null,
    event_type: input.type,
    severity: input.severity ?? EVENT_SEVERITY[input.type],
    metadata: input.metadata ?? {},
  };

  // Resolve actor asynchronously; do not block caller.
  void (async () => {
    try {
      const { data } = await supabase.auth.getUser();
      payload.actor_id = data.user?.id ?? null;
      const { error } = await supabase
        .from("platform_events")
        .insert({ ...payload, metadata: payload.metadata as never });
      if (error && typeof console !== "undefined") {
        console.debug("[events] insert failed", input.type, error.message);
      }
    } catch (e) {
      if (typeof console !== "undefined") {
        console.debug("[events] emit threw", input.type, e);
      }
    }
  })();
}

// ---------- Grouping / read helpers ----------

/** Group events by ISO date (YYYY-MM-DD) for feed sectioning. */
export function groupEventsByDay<T extends { created_at: string }>(
  events: T[],
): Array<{ day: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const e of events) {
    const day = e.created_at.slice(0, 10);
    const list = map.get(day) ?? [];
    list.push(e);
    map.set(day, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, items]) => ({ day, items }));
}

/**
 * Localised title for a raw row. Pass the caller's `t`; unknown event types
 * fall back to the raw string rather than to English copy.
 */
export function titleForEvent(
  row: Pick<PlatformEventRow, "event_type">,
  t: (key: string) => string,
): string {
  const key = EVENT_LABEL_KEYS[row.event_type as EventType];
  return key ? t(key) : row.event_type;
}

