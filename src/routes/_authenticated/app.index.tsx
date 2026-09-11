import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { LiveMap, type LivePin } from "@/components/LiveMap";
import { pickValidCoordinates } from "@/lib/geolocation";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { Wordmark } from "@/components/Wordmark";
import { n, useSessionUser, type Profile, cockpitFallbackProfile, recalledCockpitRole } from "@/lib/session";
import { MissionShell } from "@/components/mission/MissionShell";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { EmergencyCallRadar } from "@/components/mission/EmergencyCallRadar";
import { ActiveJobPool } from "@/components/mission/ActiveJobPool";
import { ensureAdminAccess } from "@/lib/superadmin";
import { AccountMenuButton } from "@/components/mission/AccountMenuButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AiAdvisor, type AiRecommendation } from "@/components/mission/AiAdvisor";
import { openThalvoSos } from "@/lib/sos-bus";
import { MissionStatusTrack, stageFromJob } from "@/components/mission/MissionStatusTrack";
import { emitEvent } from "@/lib/events";
import { createRealtimeBuffer, runWhenIdle } from "@/lib/schedule";
import { Anchor, Wrench, Radio, Gauge, Activity, Loader2, Send, ChevronRight } from "lucide-react";
import { TrustMark } from "@/components/brand/ProductMarks";

const EMPTY_PINS: LivePin[] = [];

const MapHeaderActions = ({ profile }: { profile: Profile }) => {
  const { user } = useSessionUser();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    return runWhenIdle(() => {
      void ensureAdminAccess(user).then(setIsAdmin);
    }, 1400);
  }, [user]);
  return (
    <>
      <LanguageSwitcher tone="dark" />
      <AccountMenuButton profile={profile} isAdmin={isAdmin} compact />
    </>
  );
};

export const Route = createFileRoute("/_authenticated/app/")({
  ssr: false,
  component: MissionControl,
});

function MissionControl() {
  const routeUser = Route.useRouteContext().user;
  const { user: sessionUser, loading: sessionLoading } = useSessionUser();
  const user = sessionUser ?? routeUser;
  const { profile } = n(user?.id);
  // Auth is enough to paint the chart. Profile / admin / job lists fill in behind it.
  if (!user && sessionLoading) return <ThalvoLoader />;
  if (!user) return null;
  const cockpitProfile =
    profile ?? cockpitFallbackProfile(user.id, recalledCockpitRole(user.id) ?? "Client");
  const mapCockpit = cockpitProfile.role === "Client" || cockpitProfile.role === "Provider";
  return (
    <MissionShell profile={cockpitProfile} fullBleed={mapCockpit}>
      {cockpitProfile.role === "Provider" ? (
        <OperatorCockpit profile={cockpitProfile} />
      ) : (
        <CaptainCockpit profile={cockpitProfile} />
      )}
    </MissionShell>
  );
}

/* ============================================================ */
/* CAPTAIN COCKPIT — fullscreen Navily-style map chartplotter    */
/* ============================================================ */
function CaptainCockpit({ profile }: { profile: Profile }) {
  const { user } = useSessionUser();
  const [providers, setProviders] = useState<LivePin[]>([]);
  const [activeJobs, setActiveJobs] = useState<
    {
      id: string;
      problem_category: string;
      status: string;
      service_type: string;
      marina: string;
      dispatched_at: string | null;
      eta_minutes: number | null;
    }[]
  >([]);
  const { t } = useTranslation();

  useEffect(() => {
    return runWhenIdle(() => {
      supabase
        .from("provider_details")
        .select("id, service_type, lat, lng, live_status, profiles(full_name)")
        .eq("live_status", "Available")
        .then(({ data, error }) => {
          if (error) {
            console.warn("[cockpit] provider_details unavailable", error.message);
            return;
          }
          if (!data) return;
          setProviders(
            pickValidCoordinates(data)
              .map((r) => ({
                id: r.id,
                name:
                  (r as { profiles: { full_name: string } | null }).profiles?.full_name ?? "Provider",
                lat: r.lat,
                lng: r.lng,
                kind: r.service_type === "Underwater Diver" ? "diver" : "mechanic",
              })),
          );
        });
    }, 900);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = () =>
      supabase
        .from("jobs")
        .select("id, problem_category, status, service_type, marina, dispatched_at, eta_minutes")
        .eq("client_id", user.id)
        .not("status", "in", "(Completed,Cancelled)")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.warn("[cockpit] jobs unavailable", error.message);
            setActiveJobs([]);
            return;
          }
          setActiveJobs((data as never) ?? []);
        });
    const stopIdle = runWhenIdle(() => {
      void load();
    }, 800);
    const buffer = createRealtimeBuffer(load, 180);
    const ch = supabase
      .channel(`client-jobs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `client_id=eq.${user.id}` },
        () => buffer.ping(),
      )
      .subscribe();
    return () => {
      stopIdle();
      buffer.dispose();
      supabase.removeChannel(ch);
    };
  }, [user]);

  const primaryMission = activeJobs[0] ?? null;

  const headerRight = useMemo(
    () => <MapHeaderActions profile={profile} />,
    [profile],
  );

  const brand: ReactNode = primaryMission ? (
    <Link
      to="/app/job/$id"
      params={{ id: primaryMission.id }}
      className="flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/15 px-3 py-1.5 text-[10px] font-semibold text-sky-100 shadow-2xl backdrop-blur-md"
    >
      <span className="relative flex size-1.5 shrink-0">
        <span className="absolute inset-0 rounded-full bg-sky-400 animate-ping opacity-70" />
        <span className="relative size-1.5 rounded-full bg-sky-400" />
      </span>
      <span className="truncate">
        {t(`status.${primaryMission.status}`, { defaultValue: primaryMission.status })}
      </span>
    </Link>
  ) : null;

  return (
    <div className="relative h-full min-h-[500px] w-full">
    <LiveMap
      providers={providers}
      variant="dark"
      fullscreen
      hud
      enableDetailSheet
      scrollZoom
      headerLeft={<Wordmark size="sm" className="text-white" decorative />}
      headerRight={headerRight}
      brand={brand}
      onRequestEmergency={() => openThalvoSos("mechanic")}
    />
    </div>
  );
}

/* ============================================================ */
/* OPERATOR COCKPIT (Provider)                                  */
/* ============================================================ */
function OperatorCockpit({ profile }: { profile: Profile }) {
  const { user } = useSessionUser();
  const { t } = useTranslation();
  const [requests, setRequests] = useState<
    Array<{
      id: string;
      problem_category: string;
      description: string;
      marina: string;
      service_type: string;
      profiles: { full_name: string; boat_name: string | null } | null;
    }>
  >([]);
  const [activeJobs, setActiveJobs] = useState<
    Array<{ id: string; problem_category: string; status: string }>
  >([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const pending = await supabase
          .from("jobs")
          .select(
            "id, problem_category, description, marina, service_type, profiles!jobs_client_id_fkey(full_name, boat_name)",
          )
          .eq("status", "Pending")
          .order("created_at", { ascending: false });
        if (pending.error) console.warn("[cockpit] jobs pending unavailable", pending.error.message);
        setRequests((pending.data as never) ?? []);
        const mine = await supabase
          .from("jobs")
          .select("id, problem_category, status")
          .eq("provider_id", user.id)
          .not("status", "in", "(Completed,Cancelled)")
          .order("created_at", { ascending: false });
        if (mine.error) console.warn("[cockpit] jobs mine unavailable", mine.error.message);
        setActiveJobs((mine.data as never) ?? []);
      } catch (e) {
        console.warn("[cockpit] jobs load failed", e);
        setRequests([]);
        setActiveJobs([]);
      }
    };
    const stopIdle = runWhenIdle(() => {
      void load();
    }, 800);
    const buffer = createRealtimeBuffer(() => {
      void load();
    }, 180);
    const ch = supabase
      .channel(`prov-jobs:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => buffer.ping())
      .subscribe();
    return () => {
      stopIdle();
      buffer.dispose();
      supabase.removeChannel(ch);
    };
  }, [user]);

  const recs: AiRecommendation[] =
    requests.length > 0
      ? [
          {
            id: "open-requests",
            title: t("advisor.open_requests_title"),
            detail: t("advisor.open_requests_detail", { count: requests.length }),
            tone: "warning" as const,
          },
        ]
      : [];

  const headerRight = useMemo(
    () => <MapHeaderActions profile={profile} />,
    [profile],
  );

  return (
    <div className="relative h-full min-h-[500px] w-full">
      <LiveMap
        providers={EMPTY_PINS}
        variant="dark"
        fullscreen
        hud
        scrollZoom
        headerLeft={<Wordmark size="sm" className="text-white" decorative />}
        headerRight={headerRight}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-28 z-[50] flex justify-center px-16">
        <details className="pointer-events-auto w-full max-w-[20rem] overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#0A192F]/92 shadow-2xl backdrop-blur-md">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
            <span>{t("ops_alerts.pool_title")}</span>
            <ChevronRight className="size-4 shrink-0 text-cyan-200/70" />
          </summary>
          <div className="max-h-[36vh] space-y-4 overflow-y-auto px-3 pb-3">
            {user && <EmergencyCallRadar userId={user.id} hideChart />}
            {user && <ActiveJobPool userId={user.id} />}
            <section>
              <SectionTitle icon={<Activity className="size-3.5" />} eyebrow="Your missions">
                Active jobs
              </SectionTitle>
              {activeJobs.length === 0 ? (
                <GlassPanel className="text-sm text-muted-foreground">
                  No active jobs. Watch the feed below.
                </GlassPanel>
              ) : (
                <ul className="space-y-2">
                  {activeJobs.map((j) => {
                    const stage = stageFromJob(j.status);
                    return (
                      <li key={j.id}>
                        <Link
                          to="/app/job/$id"
                          params={{ id: j.id }}
                          className="block rounded-2xl border border-white/10 bg-white/[0.05] p-4 hover:bg-white/[0.08]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                                Mission opportunity
                              </p>
                              <p className="mt-0.5 truncate text-sm font-semibold text-white">
                                {t(`problems.${j.problem_category}`, {
                                  defaultValue: j.problem_category,
                                })}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {t(`status.${j.status}`)}
                              </p>
                            </div>
                            <ChevronRight className="size-4 text-white/40" />
                          </div>
                          <div className="mt-3 border-t border-white/[0.06] pt-3">
                            <MissionStatusTrack stage={stage} compact />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section>
              <SectionTitle icon={<Radio className="size-3.5" />} eyebrow="Incoming">
                Request feed
              </SectionTitle>
              {requests.length === 0 ? (
                <GlassPanel className="text-sm text-muted-foreground">
                  No pending requests in your area right now.
                </GlassPanel>
              ) : (
                <ul className="space-y-2">
                  {requests.map((r) => (
                    <RequestCard key={r.id} request={r} />
                  ))}
                </ul>
              )}
            </section>
            <details className="group rounded-2xl border border-white/10 bg-white/[0.03]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none">
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                  <Gauge className="size-3.5" /> Overview details
                </span>
                <ChevronRight className="size-4 text-white/40 transition-transform group-open:rotate-90" />
              </summary>
              <div className="space-y-4 px-4 pt-1 pb-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard
                    label="Active jobs"
                    value={activeJobs.length}
                    icon={<Activity className="size-4" />}
                    accent="text-sky-300"
                  />
                  <StatCard
                    label="Open requests"
                    value={requests.length}
                    icon={<Radio className="size-4" />}
                    accent="text-amber-300"
                  />
                  <Link to="/app/reputation" className="block">
                    <StatCard
                      label="THALVO Trust"
                      value="Open reputation →"
                      icon={<TrustMark size={18} />}
                      accent="text-emerald-300"
                    />
                  </Link>
                </div>
                <AiAdvisor recommendations={recs} title="THALVO AI · Operator brief" />
              </div>
            </details>
          </div>
        </details>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Small primitives                                             */
/* ============================================================ */
function SectionTitle({
  eyebrow,
  icon,
  children,
}: {
  eyebrow: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {icon}
        {eyebrow}
      </span>
      <span className="text-sm font-semibold text-white/90">{children}</span>
    </div>
  );
}
function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <GlassPanel className="flex items-center justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          {label}
        </p>
        <p className="text-2xl font-semibold text-white mt-1 tracking-tight">{value}</p>
      </div>
      <span
        className={
          "size-10 rounded-xl bg-white/5 border border-white/10 grid place-items-center " + accent
        }
      >
        {icon}
      </span>
    </GlassPanel>
  );
}

function RequestCard({
  request,
}: {
  request: {
    id: string;
    problem_category: string;
    description: string;
    marina: string;
    service_type: string;
    profiles: { full_name: string; boat_name: string | null } | null;
  };
}) {
  const { t } = useTranslation();
  const { user } = useSessionUser();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [eta, setEta] = useState("");
  const [note, setNote] = useState("");
  const [available, setAvailable] = useState<"available" | "standby">("available");
  const [busy, setBusy] = useState(false);
  const isDiver = request.service_type === "Underwater Diver";

  const submit = async () => {
    if (!user || !price || !eta) return;
    setBusy(true);
    // TODO(payments): once escrow is live, treat this as a bid on a funded mission,
    // and surface availability + certifications to the captain server-side.
    const notePayload = [available === "standby" ? "[On standby]" : "[Available now]", note.trim()]
      .filter(Boolean)
      .join(" ");
    await supabase.from("job_offers").insert({
      job_id: request.id,
      provider_id: user.id,
      price: Number(price),
      eta_minutes: Number(eta),
      note: notePayload || null,
    });
    // M7: best-effort — server should emit once offer submission moves into an RPC.
    emitEvent({
      type: "offer.submitted",
      subject_type: "offer",
      subject_id: request.id,
      metadata: { job_id: request.id, price: Number(price), eta_minutes: Number(eta) },
    });
    setBusy(false);
    setOpen(false);
    setPrice("");
    setEta("");
    setNote("");
  };

  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <div
          className={
            "size-10 rounded-xl grid place-items-center " +
            (isDiver
              ? "bg-cyan-500/15 border border-cyan-400/30 text-cyan-300"
              : "bg-sky-500/15 border border-sky-400/30 text-sky-300")
          }
        >
          {isDiver ? <Anchor className="size-5" /> : <Wrench className="size-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/90 inline-flex items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-70" />
              <span className="relative size-1.5 rounded-full bg-rose-400" />
            </span>
            Funded mission · Broadcasting
          </p>
          <p className="text-sm font-semibold text-white mt-1">
            {t(`problems.${request.problem_category}`, { defaultValue: request.problem_category })}
          </p>
          <p className="text-[11px] text-white/50 mt-0.5">
            📍 {request.marina} · ⚓ {request.profiles?.boat_name ?? "—"}
          </p>
          {request.description && (
            <p className="mt-2 text-[12px] text-white/70 whitespace-pre-wrap">
              {request.description}
            </p>
          )}
          <p className="mt-2 text-[10px] text-white/40 uppercase tracking-[0.14em]">
            Payment held in THALVO escrow · released on completion
          </p>
        </div>
      </div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-semibold"
        >
          {t("provider.submit_offer")}
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="numeric"
              placeholder={t("provider.your_price")}
              className="h-10 rounded-xl border border-white/15 bg-white/5 text-white placeholder:text-white/40 px-3 text-sm outline-none focus:border-sky-400/60"
            />
            <input
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              inputMode="numeric"
              placeholder={t("provider.your_eta")}
              className="h-10 rounded-xl border border-white/15 bg-white/5 text-white placeholder:text-white/40 px-3 text-sm outline-none focus:border-sky-400/60"
            />
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("provider.note")}
            className="w-full h-10 rounded-xl border border-white/15 bg-white/5 text-white placeholder:text-white/40 px-3 text-sm outline-none focus:border-sky-400/60"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAvailable("available")}
              className={
                "flex-1 h-9 rounded-xl text-[11px] font-semibold uppercase tracking-[0.14em] border " +
                (available === "available"
                  ? "bg-emerald-400/15 border-emerald-400/40 text-emerald-300"
                  : "bg-white/5 border-white/10 text-white/50")
              }
            >
              Available now
            </button>
            <button
              type="button"
              onClick={() => setAvailable("standby")}
              className={
                "flex-1 h-9 rounded-xl text-[11px] font-semibold uppercase tracking-[0.14em] border " +
                (available === "standby"
                  ? "bg-amber-400/15 border-amber-400/40 text-amber-300"
                  : "bg-white/5 border-white/10 text-white/50")
              }
            >
              On standby
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 h-10 rounded-xl border border-white/15 text-white/70 text-sm"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 h-10 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-900 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{" "}
              {t("provider.submit_offer")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
