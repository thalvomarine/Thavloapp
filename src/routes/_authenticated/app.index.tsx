import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { LiveMap, type LivePin } from "@/components/LiveMap";
import { pickValidCoordinates } from "@/lib/geolocation";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { Wordmark } from "@/components/Wordmark";
import { n, useSessionUser, type Profile } from "@/lib/session";
import { MissionShell } from "@/components/mission/MissionShell";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { EmergencyCallRadar } from "@/components/mission/EmergencyCallRadar";
import { AccountMenuButton } from "@/components/mission/AccountMenuButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AiAdvisor, type AiRecommendation } from "@/components/mission/AiAdvisor";
import { openThalvoSos } from "@/lib/sos-bus";
import { MissionStatusTrack, stageFromJob } from "@/components/mission/MissionStatusTrack";
import { emitEvent } from "@/lib/events";
import { Anchor, Wrench, Radio, Gauge, Activity, Loader2, Send, ChevronRight } from "lucide-react";
import { TrustMark } from "@/components/brand/ProductMarks";

export const Route = createFileRoute("/_authenticated/app/")({
  ssr: false,
  component: MissionControl,
});

function MissionControl() {
  const routeUser = Route.useRouteContext().user;
  const { user: sessionUser, loading: sessionLoading } = useSessionUser();
  const user = sessionUser ?? routeUser;
  const { profile, loading } = n(user?.id);
  if ((!user && sessionLoading) || loading) return <ThalvoLoader />;
  if (!profile) return null;
  return (
    <MissionShell profile={profile} fullBleed={profile.role === "Client"}>
      {profile.role === "Client" ? <CaptainCockpit profile={profile} /> : <OperatorCockpit />}
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
  const [isAdmin, setIsAdmin] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    supabase
      .from("provider_details")
      .select("id, service_type, lat, lng, live_status, profiles(full_name)")
      .eq("live_status", "Available")
      .then(({ data }) => {
        if (!data) return;
        setProviders(
          pickValidCoordinates(data)
            // Only providers with a real, validated position are plotted.
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
        .then(({ data }) => setActiveJobs((data as never) ?? []));
    load();
    const ch = supabase
      .channel(`client-jobs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `client_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  useEffect(() => {
    // UI-level gate; server RPCs still enforce has_role('admin') for real data.
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [profile.id]);

  const primaryMission = activeJobs[0] ?? null;

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
    <LiveMap
      providers={providers}
      variant="dark"
      fullscreen
      hud
      enableDetailSheet
      scrollZoom
      headerLeft={<Wordmark size="sm" className="text-white" decorative />}
      headerRight={
        <>
          <LanguageSwitcher tone="dark" />
          <AccountMenuButton profile={profile} isAdmin={isAdmin} compact />
        </>
      }
      brand={brand}
      onRequestEmergency={() => openThalvoSos("mechanic")}
    />
  );
}

/* ============================================================ */
/* OPERATOR COCKPIT (Provider)                                  */
/* ============================================================ */
function OperatorCockpit() {
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
  const [completedJobs, setCompletedJobs] = useState<
    Array<{ id: string; problem_category: string; status: string; updated_at: string }>
  >([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("jobs")
        .select(
          "id, problem_category, description, marina, service_type, profiles!jobs_client_id_fkey(full_name, boat_name)",
        )
        .eq("status", "Pending")
        .order("created_at", { ascending: false });
      setRequests((data as never) ?? []);
      const { data: mine } = await supabase
        .from("jobs")
        .select("id, problem_category, status")
        .eq("provider_id", user.id)
        .not("status", "in", "(Completed,Cancelled)")
        .order("created_at", { ascending: false });
      setActiveJobs((mine as never) ?? []);
      const { data: done } = await supabase
        .from("jobs")
        .select("id, problem_category, status, updated_at")
        .eq("provider_id", user.id)
        .eq("status", "Completed")
        .order("updated_at", { ascending: false })
        .limit(20);
      setCompletedJobs((done as never) ?? []);
    };
    load();
    const ch = supabase
      .channel(`prov-jobs:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, load)
      .subscribe();
    return () => {
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

  return (
    <div className="space-y-6">
      {user && <EmergencyCallRadar userId={user.id} />}
      <section className="mission-rise" style={{ animationDelay: "60ms" }}>
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
                    className="block rounded-2xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                          Mission opportunity
                        </p>
                        <p className="text-sm font-semibold text-white truncate mt-0.5">
                          {t(`problems.${j.problem_category}`, {
                            defaultValue: j.problem_category,
                          })}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t(`status.${j.status}`)}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-white/40" />
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/[0.06]">
                      <MissionStatusTrack stage={stage} compact />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mission-rise" style={{ animationDelay: "90ms" }}>
        <SectionTitle icon={<Activity className="size-3.5" />} eyebrow="Your missions">
          {t("provider.completed_missions", { defaultValue: "Completed missions" })}
        </SectionTitle>
        {completedJobs.length === 0 ? (
          <GlassPanel className="text-sm text-muted-foreground">
            {t("provider.no_completed", { defaultValue: "No completed missions yet." })}
          </GlassPanel>
        ) : (
          <ul className="space-y-2">
            {completedJobs.map((j) => (
              <li key={j.id}>
                <Link
                  to="/app/job/$id"
                  params={{ id: j.id }}
                  className="block rounded-2xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                        {t("status.Completed", { defaultValue: "Completed" })}
                      </p>
                      <p className="text-sm font-semibold text-white truncate mt-0.5">
                        {t(`problems.${j.problem_category}`, { defaultValue: j.problem_category })}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(j.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-white/40" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mission-rise" style={{ animationDelay: "120ms" }}>
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

      <section className="mission-rise" style={{ animationDelay: "180ms" }}>
        <details className="group rounded-2xl border border-white/10 bg-white/[0.03]">
          <summary className="list-none cursor-pointer select-none flex items-center justify-between gap-3 px-4 py-3">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              <Gauge className="size-3.5" /> Overview details
            </span>
            <ChevronRight className="size-4 text-white/40 transition-transform group-open:rotate-90" />
          </summary>
          <div className="px-4 pb-4 pt-1 space-y-4">
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
      </section>
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
