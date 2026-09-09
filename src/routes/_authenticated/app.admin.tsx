import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { n, useSessionUser } from "@/lib/session";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { MissionShell } from "@/components/mission/MissionShell";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { Lock, ShieldCheck } from "lucide-react";
import type { LivePin } from "@/components/LiveMap";
import { AdminControlTowerShell } from "@/components/admin/AdminControlTowerShell";
import { AdminKpiRail, type KpiItem } from "@/components/admin/AdminKpiRail";
import { MissionCommandBoard, type MissionRow } from "@/components/admin/MissionCommandBoard";
import { IncidentDetailPanel } from "@/components/admin/IncidentDetailPanel";
import { ProviderOpsList, type ProviderOpsRow } from "@/components/admin/ProviderOpsList";
import { EscrowOpsPanel } from "@/components/admin/EscrowOpsPanel";
import { MarketplaceOpsPanel, type StockAlertRow } from "@/components/admin/MarketplaceOpsPanel";
import { TrustWatchlist, type TrustWatchRow } from "@/components/admin/TrustWatchlist";
import { pickValidCoordinates, isValidCoordinate } from "@/lib/geolocation";
import { computeRouteEta, DEFAULT_RESPONSE_SPEED_KTS, type RouteEta } from "@/lib/geo-eta";
import type { LiveRoute } from "@/components/LiveMap";
import { playSonarPing } from "@/lib/sonar";
import {
  PlatformEventFeed,
  type PlatformEvent,
  type PlatformEventKind,
} from "@/components/admin/PlatformEventFeed";
import { AdminSecurityPanel } from "@/components/security/AdminSecurityPanel";
import {
  AdminPaymentOpsPanel,
  type AdminPaymentIntentRow,
  type AdminPayoutRow,
  type AdminCommissionRow,
} from "@/components/admin/AdminPaymentOpsPanel";
import { EVENT_LABEL_KEYS, type EventType, emitEvent } from "@/lib/events";
import { PanelLoadState } from "@/components/admin/PanelLoadState";
import { PendingRoleRequests, type RoleRequestRow } from "@/components/admin/PendingRoleRequests";
import { AdminConfirmDialog, type AdminActionRequest } from "@/components/admin/AdminConfirmDialog";
import { formatTL } from "@/lib/filter";
import { CommunityReportDesk } from "@/components/admin/CommunityReportDesk";
import { AdminOpsTabs } from "@/components/admin/AdminOpsTabs";
import { MarineZoneTable } from "@/components/admin/MarineZoneTable";
import { AdminPoiDialog } from "@/components/admin/AdminPoiDialog";
import {
  MissionDispatchPanel,
  type DispatchProvider,
  type DispatchStatus,
} from "@/components/admin/MissionDispatchPanel";
import {
  fetchCommunityReports,
  fetchMarineZones,
  REPORT_TO_ZONE_KIND,
  REPORT_CATEGORY_LABEL_KEYS,
  type CommunityReport,
  type MarineZone,
} from "@/lib/marine-data";

/**
 * THALVO Admin Control Tower — /app/admin.
 *
 * SECURITY NOTES:
 * - Access is UI-gated by user_roles (role='admin'). Server-side, the
 *   admin_list_users RPC already enforces has_role('admin').
 * - TODO(admin-rls): add explicit admin-only SELECT policies on jobs,
 *   platform_ledger, parts_catalog for a proper cross-tenant view (today we
 *   rely on RLS returning the caller's rows only for non-admins; admins should
 *   receive network-wide rows via a dedicated policy set).
 * - TODO(audit-log): create admin_events table with append-only inserts to
 *   back PlatformEventFeed instead of client-side derivation.
 * - TODO(admin-actions): flag / dispute / contact-team workflows require
 *   dedicated tables + permission checks.
 */
export const Route = createFileRoute("/_authenticated/app/admin")({
  ssr: false,
  component: AdminControlTowerPage,
});

const ACTIVE_STATUSES = [
  "Requested",
  "Accepted",
  "EnRoute",
  "OnSite",
  "PartsPending",
  "InProgress",
];
const IN_ESCROW_STATUSES = ["Accepted", "EnRoute", "OnSite", "PartsPending", "InProgress"];

function AdminControlTowerPage() {
  const { user, loading: sessionLoading } = useSessionUser();
  const { profile, loading } = n(user?.id);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  if ((!user && sessionLoading) || loading || isAdmin === null) return <ThalvoLoader />;
  if (!profile) return null;

  return (
    <MissionShell profile={profile}>{isAdmin ? <ControlTower /> : <LockedTower />}</MissionShell>
  );
}

function LockedTower() {
  const { t } = useTranslation();
  return (
    <GlassPanel className="min-h-[60vh] grid place-items-center text-center">
      <div className="text-white/70 max-w-sm">
        <Lock className="size-8 mx-auto text-white/40" />
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60">
          {t("admin.tower.restricted")}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          {t("admin.tower.restricted_title")}
        </h2>
        <p className="mt-2 text-[12px] leading-relaxed">{t("admin.tower.restricted_body")}</p>
      </div>
    </GlassPanel>
  );
}

interface JobRow {
  id: string;
  problem_category: string;
  status: string;
  service_type: string | null;
  marina: string | null;
  total_escrow_pool: number | null;
  created_at: string;
  lat: number | string | null;
  lng: number | string | null;
  provider_id: string | null;
}
interface LedgerRow {
  id: string;
  commission_amount: number;
  provider_payout: number;
  created_at: string;
  job_id: string | null;
}
interface ProviderRow {
  id: string;
  service_type: string | null;
  live_status: string | null;
  rating: number | null;
  jobs_completed: number | null;
  profiles: { full_name: string | null; is_available?: boolean } | null;
  lat: number | null;
  lng: number | null;
}
interface OfferRow {
  id: string;
  job_id: string;
  price: number;
  created_at: string;
}
interface PartRow {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  marina: string | null;
  active: boolean;
  supplier_id: string | null;
  profiles: { full_name: string | null } | null;
}
interface PlatformEventDbRow {
  id: string;
  event_type: string;
  severity: string;
  subject_type: string;
  subject_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function glyphForEventKind(type: string): PlatformEventKind {
  if (type.startsWith("sos")) return "sos";
  if (type.startsWith("offer")) return "offer";
  if (type.startsWith("escrow") || type.startsWith("order")) return "escrow";
  if (type.startsWith("stock")) return "stock";
  return "mission";
}

function titleForRow(row: PlatformEventDbRow, t: (k: string) => string): string {
  const key = EVENT_LABEL_KEYS[row.event_type as EventType];
  const base = key ? t(key) : row.event_type;
  const meta = row.metadata ?? {};
  const price = typeof meta.price === "number" ? ` · ${formatTL(Math.round(meta.price))}` : "";
  const amount = typeof meta.amount === "number" ? ` · ${formatTL(Math.round(meta.amount))}` : "";
  return base + price + amount;
}

function detailForRow(row: PlatformEventDbRow): string | undefined {
  const meta = row.metadata ?? {};
  if (typeof meta.marina === "string") return meta.marina;
  if (typeof meta.problem_category === "string") return meta.problem_category;
  if (meta.from && meta.to) return `${meta.from} → ${meta.to}`;
  return undefined;
}

type LoadState = "loading" | "ok" | "error";
type QueryKey =
  | "jobs"
  | "ledger"
  | "providers"
  | "offers"
  | "parts"
  | "events"
  | "payments"
  | "verified"
  | "requests"
  | "reports"
  | "zones";

const INITIAL_STATUS: Record<QueryKey, LoadState> = {
  jobs: "loading",
  ledger: "loading",
  providers: "loading",
  offers: "loading",
  parts: "loading",
  events: "loading",
  payments: "loading",
  verified: "loading",
  requests: "loading",
  reports: "loading",
  zones: "loading",
};

function ControlTower() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [platformEvents, setPlatformEvents] = useState<PlatformEventDbRow[]>([]);
  const [paymentIntents, setPaymentIntents] = useState<AdminPaymentIntentRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [commissions, setCommissions] = useState<AdminCommissionRow[]>([]);
  /** null = the verification read failed, so verification status is unknown. */
  const [verifiedIds, setVerifiedIds] = useState<Set<string> | null>(null);
  const [roleRequests, setRoleRequests] = useState<RoleRequestRow[]>([]);
  const [pendingReports, setPendingReports] = useState<CommunityReport[]>([]);
  const [zones, setZones] = useState<MarineZone[]>([]);
  const [status, setStatus] = useState<Record<QueryKey, LoadState>>(INITIAL_STATUS);
  /** Confirmation + write state for every operator action in this tower. */
  const [action, setAction] = useState<AdminActionRequest | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const mark = useCallback((key: QueryKey, state: LoadState) => {
    setStatus((prev) => (prev[key] === state ? prev : { ...prev, [key]: state }));
  }, []);

  const loadJobs = useCallback(async () => {
    mark("jobs", "loading");
    const { data, error } = await supabase
      .from("jobs")
      .select(
        "id, problem_category, status, service_type, marina, total_escrow_pool, created_at, lat, lng, provider_id",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return mark("jobs", "error");
    setJobs((data as JobRow[]) ?? []);
    mark("jobs", "ok");
  }, [mark]);

  const loadLedger = useCallback(async () => {
    mark("ledger", "loading");
    const { data, error } = await supabase
      .from("platform_ledger")
      .select("id, commission_amount, provider_payout, created_at, job_id")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return mark("ledger", "error");
    setLedger((data as LedgerRow[]) ?? []);
    mark("ledger", "ok");
  }, [mark]);

  const loadProviders = useCallback(async () => {
    mark("providers", "loading");
    const { data, error } = await supabase
      .from("provider_details")
      .select(
        "id, service_type, live_status, rating, jobs_completed, lat, lng, profiles(full_name, is_available)",
      )
      .limit(100);
    if (error) return mark("providers", "error");
    setProviders((data as unknown as ProviderRow[]) ?? []);
    mark("providers", "ok");
  }, [mark]);

  // B3: real verification state. A failed read stays unknown — never `false`.
  const loadVerified = useCallback(async () => {
    mark("verified", "loading");
    const { data, error } = await supabase.from("verified_providers").select("user_id");
    if (error) {
      setVerifiedIds(null);
      return mark("verified", "error");
    }
    setVerifiedIds(new Set((data ?? []).map((r) => r.user_id)));
    mark("verified", "ok");
  }, [mark]);

  const loadOffers = useCallback(async () => {
    mark("offers", "loading");
    const { data, error } = await supabase
      .from("job_offers")
      .select("id, job_id, price, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return mark("offers", "error");
    setOffers((data as OfferRow[]) ?? []);
    mark("offers", "ok");
  }, [mark]);

  const loadParts = useCallback(async () => {
    mark("parts", "loading");
    const { data, error } = await supabase
      .from("parts_catalog")
      .select("id, name, sku, stock, marina, active, supplier_id, profiles:supplier_id(full_name)")
      .limit(500);
    if (error) return mark("parts", "error");
    setParts((data as unknown as PartRow[]) ?? []);
    mark("parts", "ok");
  }, [mark]);

  const loadRequests = useCallback(async () => {
    mark("requests", "loading");
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, boat_name, requested_role, created_at")
      .not("requested_role", "is", null)
      .order("created_at", { ascending: true });
    if (error) return mark("requests", "error");
    setRoleRequests(
      (
        (data ?? []) as Array<{
          id: string;
          full_name: string | null;
          boat_name: string | null;
          requested_role: string | null;
          created_at: string;
        }>
      ).filter((r): r is RoleRequestRow => r.requested_role !== null),
    );
    mark("requests", "ok");
  }, [mark]);

  const loadEvents = useCallback(async () => {
    mark("events", "loading");
    const { data, error } = await supabase
      .from("platform_events")
      .select("id, event_type, severity, subject_type, subject_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) return mark("events", "error");
    setPlatformEvents((data as PlatformEventDbRow[]) ?? []);
    mark("events", "ok");
  }, [mark]);

  const loadPayments = useCallback(async () => {
    mark("payments", "loading");
    const [intents, po, cr] = await Promise.all([
      supabase
        .from("payment_intents")
        .select("id, job_id, status, amount_cents, provider, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("provider_payouts")
        .select("id, job_id, provider_id, status, amount_cents, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("commission_records")
        .select("id, job_id, gross_cents, fee_cents, net_cents, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (intents.error || po.error || cr.error) return mark("payments", "error");
    setPaymentIntents((intents.data as AdminPaymentIntentRow[]) ?? []);
    setPayouts((po.data as AdminPayoutRow[]) ?? []);
    setCommissions((cr.data as AdminCommissionRow[]) ?? []);
    mark("payments", "ok");
  }, [mark]);

  const loadProviderBlock = useCallback(() => {
    void loadProviders();
    void loadVerified();
  }, [loadProviders, loadVerified]);

  const loadReports = useCallback(async () => {
    mark("reports", "loading");
    try {
      setPendingReports(await fetchCommunityReports("pending_approval"));
      mark("reports", "ok");
    } catch {
      mark("reports", "error");
    }
  }, [mark]);

  const loadZones = useCallback(async () => {
    mark("zones", "loading");
    try {
      setZones(await fetchMarineZones(true));
      mark("zones", "ok");
    } catch {
      mark("zones", "error");
    }
  }, [mark]);

  useEffect(() => {
    void loadJobs();
    void loadLedger();
    loadProviderBlock();
    void loadOffers();
    void loadParts();
    void loadEvents();
    void loadPayments();
    void loadRequests();
    void loadReports();
    void loadZones();
  }, [
    loadJobs,
    loadLedger,
    loadProviderBlock,
    loadOffers,
    loadParts,
    loadEvents,
    loadPayments,
    loadRequests,
    loadReports,
    loadZones,
  ]);

  // ---------- Realtime: new contacts surface without a manual refresh ----------
  // Admin RLS already scopes what these reads can return; this only decides
  // *when* to re-read, never what's visible. A new pending report or a new
  // SOS/service call gets a toast + sonar chime so the tower never has to
  // sit on a stale list waiting for a page reload.
  useEffect(() => {
    const channel = supabase
      .channel("admin-tower-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_reports" },
        () => {
          void loadReports();
          toast.info(t("admin.realtime.new_report_toast"));
          playSonarPing("advisory");
        },
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "jobs" }, (payload) => {
        void loadJobs();
        const row = payload.new as { status?: string; problem_category?: string } | null;
        if (row?.status === "Requested") {
          toast.warning(
            t("admin.realtime.new_sos_toast", { category: row.problem_category ?? "" }),
          );
          playSonarPing("alert");
        } else {
          playSonarPing("advisory");
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // loadReports/loadJobs are stable useCallback refs; t/toast/playSonarPing
    // are intentionally excluded to avoid resubscribing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadReports, loadJobs]);

  const missions: MissionRow[] = useMemo(
    () =>
      jobs
        .filter((j) => ACTIVE_STATUSES.includes(j.status))
        .map((j) => ({
          id: j.id,
          problem_category: j.problem_category,
          status: j.status,
          marina: j.marina,
          service_type: j.service_type,
          total_escrow_pool: j.total_escrow_pool == null ? null : Number(j.total_escrow_pool),
          created_at: j.created_at,
          lat: j.lat == null ? null : Number(j.lat),
          lng: j.lng == null ? null : Number(j.lng),
          provider_id: j.provider_id,
          sos: j.status === "Requested",
        })),
    [jobs],
  );

  const providersById = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);

  // ---------- Live route + ETA engine ----------
  // Per-job cruise speed override (knots); defaults to the standard
  // response-boat speed until an operator dials it in for a specific unit.
  const [speedByJob, setSpeedByJob] = useState<Record<string, number>>({});

  const missionEta: Record<string, RouteEta | null> = useMemo(() => {
    const map: Record<string, RouteEta | null> = {};
    for (const m of missions) {
      const provider = m.provider_id ? providersById.get(m.provider_id) : null;
      if (
        !provider ||
        !isValidCoordinate(provider.lat, provider.lng) ||
        !isValidCoordinate(m.lat, m.lng)
      ) {
        map[m.id] = null;
        continue;
      }
      const speedKts = speedByJob[m.id] ?? DEFAULT_RESPONSE_SPEED_KTS;
      map[m.id] = computeRouteEta(
        { lat: Number(provider.lat), lng: Number(provider.lng) },
        { lat: m.lat as number, lng: m.lng as number },
        speedKts,
      );
    }
    return map;
  }, [missions, providersById, speedByJob]);

  const missionRoutes: LiveRoute[] = useMemo(
    () =>
      missions
        .filter((m) => missionEta[m.id] && m.provider_id)
        .map((m) => {
          const provider = providersById.get(m.provider_id as string);
          return provider &&
            isValidCoordinate(provider.lat, provider.lng) &&
            m.lat != null &&
            m.lng != null
            ? {
                id: m.id,
                from: { lat: Number(provider.lat), lng: Number(provider.lng) },
                to: { lat: m.lat, lng: m.lng },
              }
            : null;
        })
        .filter((r): r is LiveRoute => r !== null),
    [missions, missionEta, providersById],
  );

  const onSpeedChange = useCallback((m: MissionRow, speedKts: number) => {
    setSpeedByJob((prev) => ({ ...prev, [m.id]: speedKts }));
  }, []);

  const providerPins: LivePin[] = useMemo(
    () =>
      pickValidCoordinates(providers.filter((p) => p.live_status === "Available")).map((p) => ({
        id: p.id,
        name: p.profiles?.full_name ?? t("admin.tower.provider_fallback"),
        lat: Number(p.lat),
        lng: Number(p.lng),
        kind: p.service_type === "Underwater Diver" ? "diver" : "mechanic",
      })),
    [providers, t],
  );

  const providerRows: ProviderOpsRow[] = useMemo(
    () =>
      providers.map((p) => ({
        id: p.id,
        name: p.profiles?.full_name ?? t("admin.tower.provider_fallback"),
        service_type: p.service_type,
        live_status: p.live_status,
        rating: p.rating,
        // null when the verification read failed — never assumed unverified.
        verified: verifiedIds ? verifiedIds.has(p.id) : null,
      })),
    [providers, verifiedIds, t],
  );

  const trustRows: TrustWatchRow[] = useMemo(
    () =>
      providers.map((p) => ({
        id: p.id,
        name: p.profiles?.full_name ?? t("admin.tower.provider_fallback"),
        rating: p.rating,
        jobs_completed: p.jobs_completed,
        // null when the verification read failed — rendered as "unknown".
        verified: verifiedIds ? verifiedIds.has(p.id) : null,
      })),
    [providers, verifiedIds, t],
  );

  const activeSos = missions.filter((m) => m.sos).length;
  const heldEscrow = jobs
    .filter((j) => IN_ESCROW_STATUSES.includes(j.status))
    .reduce((sum, j) => sum + Number(j.total_escrow_pool ?? 0), 0);
  const commissionToDate = ledger.reduce((s, l) => s + Number(l.commission_amount), 0);
  const payoutToDate = ledger.reduce((s, l) => s + Number(l.provider_payout), 0);
  const providersOnline = providers.filter((p) => p.live_status === "Available").length;
  const openOffers = offers.length;
  const offerVolume = offers.reduce((s, o) => s + Number(o.price), 0);
  const activeParts = parts.filter((p) => p.active).length;
  const outParts = parts.filter((p) => p.active && p.stock === 0).length;
  const toStockRow = (p: PartRow): StockAlertRow => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.stock,
    marina: p.marina,
    owner_name: p.profiles?.full_name ?? null,
    active: p.active,
  });
  const lowStock = parts
    .filter((p) => p.active && p.stock <= 5)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)
    .map(toStockRow);
  const inactiveParts = parts
    .filter((p) => !p.active)
    .slice(0, 12)
    .map(toStockRow);

  const offerCountByJob = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of offers) m.set(o.job_id, (m.get(o.job_id) ?? 0) + 1);
    return m;
  }, [offers]);

  const derivedEvents: PlatformEvent[] = useMemo(() => {
    const evts: PlatformEvent[] = [];
    for (const j of jobs.slice(0, 20)) {
      evts.push({
        id: `job-${j.id}`,
        kind: j.status === "Requested" ? "sos" : "mission",
        title:
          j.status === "Requested"
            ? `${t("admin.tower.event_sos")} · ${j.problem_category}`
            : `${t("admin.tower.event_mission", { status: j.status })} · ${j.problem_category}`,
        detail: j.marina ?? undefined,
        timestamp: j.created_at,
      });
    }
    for (const o of offers.slice(0, 15)) {
      evts.push({
        id: `offer-${o.id}`,
        kind: "offer",
        title: `${t("admin.tower.event_offer")} · ${formatTL(Math.round(Number(o.price)))}`,
        timestamp: o.created_at,
      });
    }
    for (const l of ledger.slice(0, 10)) {
      evts.push({
        id: `ledger-${l.id}`,
        kind: "escrow",
        title: t("admin.tower.event_ledger", {
          payout: formatTL(Math.round(Number(l.provider_payout))),
          commission: formatTL(Math.round(Number(l.commission_amount))),
        }),
        timestamp: l.created_at,
      });
    }
    for (const p of lowStock.slice(0, 5)) {
      evts.push({
        id: `stock-${p.id}`,
        kind: "stock",
        title: `${p.stock === 0 ? t("admin.tower.event_out_of_stock") : t("admin.tower.event_low_stock")} · ${p.name}`,
        detail: p.marina ?? undefined,
        timestamp: new Date().toISOString(),
      });
    }
    return evts.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 40);
  }, [jobs, offers, ledger, lowStock, t]);

  // M7: prefer real platform_events when the table has data. Fall back to
  // the derived view for legacy activity before events were emitted.
  const events: PlatformEvent[] = useMemo(() => {
    if (platformEvents.length === 0) return derivedEvents;
    return platformEvents.map((row) => ({
      id: row.id,
      kind: glyphForEventKind(row.event_type),
      title: titleForRow(row, t),
      detail: detailForRow(row),
      timestamp: row.created_at,
    }));
  }, [platformEvents, derivedEvents, t]);

  const kpis: KpiItem[] = [
    {
      key: "sos",
      label: t("admin.tower.kpi_sos"),
      value: activeSos,
      tone: activeSos > 0 ? "danger" : "neutral",
      hint: activeSos ? t("admin.tower.hint_immediate") : t("admin.tower.hint_all_clear"),
    },
    { key: "active", label: t("admin.tower.kpi_missions"), value: missions.length, tone: "info" },
    {
      key: "providers",
      label: t("admin.tower.kpi_providers"),
      value: providersOnline,
      tone: providersOnline > 0 ? "success" : "warning",
      hint: t("admin.tower.hint_total", { count: providers.length }),
    },
    {
      key: "offers",
      label: t("admin.tower.kpi_offers"),
      value: openOffers,
      tone: "neutral",
      hint: t("admin.tower.hint_volume", { amount: formatTL(Math.round(offerVolume)) }),
    },
    {
      key: "escrow",
      label: t("admin.tower.kpi_escrow"),
      value: formatTL(Math.round(heldEscrow)),
      tone: "info",
    },
    {
      key: "stock",
      label: t("admin.tower.kpi_stock"),
      value: lowStock.length,
      tone: lowStock.length ? "warning" : "success",
      hint: t("admin.tower.hint_stock", { out: outParts, active: activeParts }),
    },
  ];

  // ---------- Operator actions ----------
  // RLS is the real boundary here; these handlers simply call writes the
  // admin policies already allow. No optimistic UI: every action re-reads.
  const requestAction = useCallback((rowId: string, req: AdminActionRequest) => {
    setBusyId(rowId);
    setActionError(null);
    setAction(req);
  }, []);

  const cancelAction = useCallback(() => {
    setAction(null);
    setActionError(null);
    setBusyId(null);
  }, []);

  const confirmAction = useCallback(() => {
    if (!action) return;
    setActionPending(true);
    setActionError(null);
    void (async () => {
      try {
        await action.run();
        setAction(null);
        setBusyId(null);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : String(e));
      } finally {
        setActionPending(false);
      }
    })();
  }, [action]);

  const resolveRole = (role: string) =>
    role === "Provider" || role === "Supplier" ? role : "Client";

  const onApproveRequest = (r: RoleRequestRow) => {
    const name = r.full_name ?? t("admin.requests.unnamed");
    requestAction(r.id, {
      title: t("admin.requests.confirm_approve_title", { name }),
      body: t("admin.requests.confirm_approve_body", { name, role: r.requested_role }),
      confirmLabel: t("admin.requests.approve"),
      run: async () => {
        const { error } = await supabase.rpc("approve_role_request", {
          _user_id: r.id,
          _role: resolveRole(r.requested_role),
        });
        if (error) throw new Error(error.message);
        emitEvent({
          type: "admin.role_approved",
          subject_type: "platform",
          subject_id: r.id,
          metadata: { role: r.requested_role },
        });
        await Promise.all([loadRequests(), loadProviders(), loadVerified()]);
      },
    });
  };

  const onRejectRequest = (r: RoleRequestRow) => {
    const name = r.full_name ?? t("admin.requests.unnamed");
    requestAction(r.id, {
      title: t("admin.requests.confirm_reject_title", { name }),
      body: t("admin.requests.confirm_reject_body", { name, role: r.requested_role }),
      confirmLabel: t("admin.requests.reject"),
      danger: true,
      run: async () => {
        // profiles UPDATE is owner-only, so clearing requested_role must go
        // through approve_role_request. 'Client' takes neither verification
        // insert branch in the function body.
        const { error } = await supabase.rpc("approve_role_request", {
          _user_id: r.id,
          _role: "Client",
        });
        if (error) throw new Error(error.message);
        emitEvent({
          type: "admin.role_request_cleared",
          subject_type: "platform",
          subject_id: r.id,
          metadata: { requested_role: r.requested_role },
        });
        await loadRequests();
      },
    });
  };

  const onVerifyProvider = (p: ProviderOpsRow) => {
    requestAction(p.id, {
      title: t("admin.verify.confirm_verify_title", { name: p.name }),
      body: t("admin.verify.confirm_verify_body", { name: p.name }),
      confirmLabel: t("admin.verify.verify"),
      run: async () => {
        const { data: auth } = await supabase.auth.getUser();
        const { error } = await supabase.from("verified_providers").insert({
          user_id: p.id,
          verified_by: auth.user?.id ?? null,
          notes: "Verified from Control Tower",
        });
        if (error) throw new Error(error.message);
        emitEvent({ type: "admin.provider_verified", subject_type: "platform", subject_id: p.id });
        await loadVerified();
      },
    });
  };

  const onUnverifyProvider = (p: ProviderOpsRow) => {
    requestAction(p.id, {
      title: t("admin.verify.confirm_unverify_title", { name: p.name }),
      body: t("admin.verify.confirm_unverify_body", { name: p.name }),
      confirmLabel: t("admin.verify.unverify"),
      danger: true,
      run: async () => {
        const { error } = await supabase.from("verified_providers").delete().eq("user_id", p.id);
        if (error) throw new Error(error.message);
        emitEvent({
          type: "admin.provider_unverified",
          subject_type: "platform",
          subject_id: p.id,
        });
        await loadVerified();
      },
    });
  };

  const onTogglePart = (row: StockAlertRow, nextActive: boolean) => {
    requestAction(row.id, {
      title: nextActive
        ? t("admin.parts.confirm_reactivate_title", { name: row.name })
        : t("admin.parts.confirm_deactivate_title", { name: row.name }),
      body: nextActive
        ? t("admin.parts.confirm_reactivate_body", {
            name: row.name,
            owner: row.owner_name ?? t("admin.parts.unknown_owner"),
          })
        : t("admin.parts.confirm_deactivate_body", {
            name: row.name,
            owner: row.owner_name ?? t("admin.parts.unknown_owner"),
          }),
      confirmLabel: nextActive ? t("admin.parts.reactivate") : t("admin.parts.deactivate"),
      danger: !nextActive,
      run: async () => {
        const { error } = await supabase
          .from("parts_catalog")
          .update({ active: nextActive })
          .eq("id", row.id);
        if (error) throw new Error(error.message);
        emitEvent({
          type: nextActive ? "admin.listing_reactivated" : "admin.listing_deactivated",
          subject_type: "stock",
          subject_id: row.id,
        });
        await loadParts();
      },
    });
  };

  // ---------- Mission dispatch ----------
  // Admin writes go through the `jobs: admins update` policy. Completing here
  // records the operational outcome only; captain-side escrow release still
  // runs through complete_job on the mission screen.
  const dispatchProviders: DispatchProvider[] = providers.map((p) => ({
    id: p.id,
    name: p.profiles?.full_name ?? t("admin.tower.provider_fallback"),
  }));

  const onAssignMission = (m: MissionRow, providerId: string, providerName: string) => {
    requestAction(m.id, {
      title: t("admin.dispatch.confirm_assign_title", { name: providerName }),
      body: t("admin.dispatch.confirm_assign_body", {
        name: providerName,
        mission: m.problem_category,
      }),
      confirmLabel: t("admin.dispatch.assign"),
      run: async () => {
        const { error } = await supabase
          .from("jobs")
          .update({ provider_id: providerId, status: "Accepted" })
          .eq("id", m.id);
        if (error) throw new Error(error.message);
        await loadJobs();
      },
    });
  };

  const onDispatchStatus = (m: MissionRow, next: DispatchStatus) => {
    requestAction(m.id, {
      title: t("admin.dispatch.confirm_status_title", {
        status: t(`admin.dispatch.status_${next.toLowerCase()}`),
      }),
      body: t("admin.dispatch.confirm_status_body", {
        mission: m.problem_category,
        from: m.status,
        to: next,
      }),
      confirmLabel: t("admin.dispatch.update_status"),
      run: async () => {
        const { error } = await supabase.from("jobs").update({ status: next }).eq("id", m.id);
        if (error) throw new Error(error.message);
        await loadJobs();
      },
    });
  };

  const onCompleteMission = (m: MissionRow) => {
    requestAction(m.id, {
      title: t("admin.dispatch.confirm_complete_title"),
      body: t("admin.dispatch.confirm_complete_body", { mission: m.problem_category }),
      confirmLabel: t("admin.dispatch.complete"),
      run: async () => {
        const { error } = await supabase
          .from("jobs")
          .update({ status: "Completed" })
          .eq("id", m.id);
        if (error) throw new Error(error.message);
        await loadJobs();
      },
    });
  };

  const onCancelMission = (m: MissionRow) => {
    requestAction(m.id, {
      title: t("admin.dispatch.confirm_cancel_title"),
      body: t("admin.dispatch.confirm_cancel_body", { mission: m.problem_category }),
      confirmLabel: t("admin.dispatch.cancel_mission"),
      danger: true,
      run: async () => {
        const { error } = await supabase
          .from("jobs")
          .update({ status: "Cancelled" })
          .eq("id", m.id);
        if (error) throw new Error(error.message);
        await loadJobs();
      },
    });
  };

  // ---------- Captain advice moderation ----------
  const onApproveReport = (r: CommunityReport) => {
    const label = t(REPORT_CATEGORY_LABEL_KEYS[r.category]);
    requestAction(r.id, {
      title: t("admin.reports.confirm_approve_title"),
      body: t("admin.reports.confirm_approve_body", { category: label }),
      confirmLabel: t("admin.reports.approve"),
      run: async () => {
        const { data: auth } = await supabase.auth.getUser();
        const { error: zoneError } = await supabase.from("marine_zones").insert({
          kind: REPORT_TO_ZONE_KIND[r.category],
          name: label,
          lat: r.lat,
          lng: r.lng,
          depth_m: r.depth_m,
          description: r.note,
          created_by: auth.user?.id ?? null,
        });
        if (zoneError) throw new Error(zoneError.message);
        const { error } = await supabase
          .from("community_reports")
          .update({ status: "approved", reviewed_by: auth.user?.id ?? null })
          .eq("id", r.id);
        if (error) throw new Error(error.message);
        await Promise.all([loadReports(), loadZones()]);
        toast.success(t("admin.reports.approved_toast"));
      },
    });
  };

  const onRejectReport = (r: CommunityReport) => {
    requestAction(r.id, {
      title: t("admin.reports.confirm_reject_title"),
      body: t("admin.reports.confirm_reject_body"),
      confirmLabel: t("admin.reports.reject"),
      danger: true,
      run: async () => {
        const { data: auth } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("community_reports")
          .update({ status: "rejected", reviewed_by: auth.user?.id ?? null })
          .eq("id", r.id);
        if (error) throw new Error(error.message);
        await loadReports();
        toast.success(t("admin.reports.rejected_toast"));
      },
    });
  };

  // ---------- Chart point maintenance ----------
  const onToggleZone = (z: MarineZone, next: boolean) => {
    requestAction(z.id, {
      title: next ? t("admin.zones.confirm_publish_title") : t("admin.zones.confirm_hide_title"),
      body: t("admin.zones.confirm_toggle_body", { name: z.name }),
      confirmLabel: next ? t("admin.zones.publish") : t("admin.zones.hide"),
      run: async () => {
        const { error } = await supabase
          .from("marine_zones")
          .update({ active: next })
          .eq("id", z.id);
        if (error) throw new Error(error.message);
        await loadZones();
      },
    });
  };

  const onDeleteZone = (z: MarineZone) => {
    requestAction(z.id, {
      title: t("admin.zones.confirm_delete_title"),
      body: t("admin.zones.confirm_delete_body", { name: z.name }),
      confirmLabel: t("admin.zones.delete"),
      danger: true,
      run: async () => {
        const { error } = await supabase.from("marine_zones").delete().eq("id", z.id);
        if (error) throw new Error(error.message);
        await loadZones();
      },
    });
  };

  const selected = missions.find((m) => m.id === selectedId) ?? missions[0] ?? null;
  const offersForSelected = selected ? (offerCountByJob.get(selected.id) ?? 0) : 0;

  /** Render `node` only when its query succeeded; otherwise show the shared notice. */
  const gate = (key: QueryKey, retry: () => void, node: React.ReactNode) =>
    status[key] === "ok" ? (
      node
    ) : (
      <PanelLoadState state={status[key] === "error" ? "error" : "loading"} onRetry={retry} />
    );

  return (
    <AdminControlTowerShell
      kpi={gate("jobs", () => void loadJobs(), <AdminKpiRail items={kpis} />)}
      left={
        <>
          {gate(
            "requests",
            () => void loadRequests(),
            <PendingRoleRequests
              requests={roleRequests}
              busyId={busyId}
              onApprove={onApproveRequest}
              onReject={onRejectRequest}
            />,
          )}
          {gate(
            "providers",
            loadProviderBlock,
            <>
              <ProviderOpsList
                providers={providerRows}
                busyId={busyId}
                onVerify={onVerifyProvider}
                onUnverify={onUnverifyProvider}
              />
              <TrustWatchlist providers={trustRows} />
            </>,
          )}
        </>
      }
      center={
        <>
          <AdminOpsTabs
            pendingCount={pendingReports.length}
            activeMissionCount={missions.length}
            zoneCount={zones.length}
            approvalDesk={gate(
              "reports",
              () => void loadReports(),
              <CommunityReportDesk
                reports={pendingReports}
                busyId={busyId}
                onApprove={onApproveReport}
                onReject={onRejectReport}
              />,
            )}
            missionBoard={gate(
              "jobs",
              () => void loadJobs(),
              <MissionCommandBoard
                missions={missions}
                providers={providerPins}
                routes={missionRoutes}
                selectedId={selected?.id ?? null}
                onSelect={(id) => {
                  setSelectedId(id);
                  // M7: admin telemetry placeholder — TODO(server): move to server-side audit.
                  emitEvent({
                    type: "admin.mission_viewed",
                    subject_type: "mission",
                    subject_id: id,
                  });
                }}
              />,
            )}
            dispatchPanel={gate(
              "jobs",
              () => void loadJobs(),
              <MissionDispatchPanel
                missions={missions}
                providers={dispatchProviders}
                busyId={busyId}
                etaByMission={missionEta}
                onSpeedChange={onSpeedChange}
                onAssign={onAssignMission}
                onStatus={onDispatchStatus}
                onComplete={onCompleteMission}
                onCancel={onCancelMission}
              />,
            )}
            poiManager={gate(
              "zones",
              () => void loadZones(),
              <>
                <div className="flex items-center justify-end">
                  <AdminPoiDialog onSaved={() => void loadZones()} />
                </div>
                <MarineZoneTable
                  zones={zones}
                  busyId={busyId}
                  onToggleActive={onToggleZone}
                  onDelete={onDeleteZone}
                />
              </>,
            )}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gate(
              "ledger",
              () => void loadLedger(),
              <EscrowOpsPanel
                heldEscrow={heldEscrow}
                commissionToDate={commissionToDate}
                providerPayoutToDate={payoutToDate}
                recentEntries={ledger.slice(0, 8)}
              />,
            )}
            {gate(
              "parts",
              () => void loadParts(),
              <MarketplaceOpsPanel
                totalSkus={parts.length}
                activeSkus={activeParts}
                outOfStock={outParts}
                lowStock={lowStock}
                inactive={inactiveParts}
                busyId={busyId}
                onDeactivate={(row) => onTogglePart(row, false)}
                onReactivate={(row) => onTogglePart(row, true)}
              />,
            )}
          </div>
          {gate(
            "payments",
            () => void loadPayments(),
            <AdminPaymentOpsPanel
              intents={paymentIntents}
              payouts={payouts}
              commissions={commissions}
              /**
               * Static test-mode flag: no payment service provider is wired in
               * yet (see TODO(payments-provider) in src/lib/payments.ts). It is
               * NOT derived from provider state — the panel labels it as such.
               */
              providerConnected={false}
            />,
          )}
        </>
      }
      right={
        <>
          {gate(
            "jobs",
            () => void loadJobs(),
            <IncidentDetailPanel mission={selected} offersCount={offersForSelected} />,
          )}
          {gate("events", () => void loadEvents(), <PlatformEventFeed events={events} />)}
          <AdminSecurityPanel />
          <GlassPanel className="text-[11px] text-white/70 leading-relaxed">
            <p className="flex items-center gap-1.5 text-white/85 font-semibold text-[11px]">
              <ShieldCheck className="size-3.5" /> {t("admin.tower.responsibility_title")}
            </p>
            <p className="mt-1.5">{t("admin.tower.responsibility_body")}</p>
          </GlassPanel>
        </>
      }
      dialog={
        <AdminConfirmDialog
          action={action}
          pending={actionPending}
          error={actionError}
          onConfirm={confirmAction}
          onCancel={cancelAction}
        />
      }
    />
  );
}
