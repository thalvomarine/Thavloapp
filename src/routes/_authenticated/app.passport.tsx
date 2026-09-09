import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { useProfile, useSessionUser } from "@/lib/session";
import { BoatPassportShell } from "@/components/passport/BoatPassportShell";
import { VesselIdentityCard, type VesselIdentity } from "@/components/passport/VesselIdentityCard";
import { VesselHealthTimeline, type TimelineEvent } from "@/components/passport/VesselHealthTimeline";
import { MaintenanceDueCard } from "@/components/passport/MaintenanceDueCard";
import { InstalledPartsCard, type InstalledPart } from "@/components/passport/InstalledPartsCard";
import { DocumentVaultPanel } from "@/components/passport/DocumentVaultPanel";
import { VesselAiPanel } from "@/components/passport/VesselAiPanel";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { Ship, Plus, Activity } from "lucide-react";
import { formatTL } from "@/lib/filter";


export const Route = createFileRoute("/_authenticated/app/passport")({
  ssr: false,
  component: PassportPage,
});

const ACTIVE_STATUSES = ["Pending", "Accepted", "EnRoute", "OnSite", "InProgress", "PartsPending"];

function PassportPage() {
  const { user, loading } = useSessionUser();
  if (loading) return <ThalvoLoader />;
  if (!user) return null;
  return (
    <AppShell userId={user.id}>
      <Passport userId={user.id} />
    </AppShell>
  );
}

interface JobRow {
  id: string;
  problem_category: string | null;
  service_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  description: string | null;
}

function Passport({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { profile } = useProfile(userId);
  const [vessel, setVessel] = useState<VesselIdentity | null>(null);
  const [vesselLoading, setVesselLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState<JobRow[]>([]);
  const [completedJobs, setCompletedJobs] = useState<JobRow[]>([]);
  const [parts, setParts] = useState<InstalledPart[]>([]);

  useEffect(() => {
    (async () => {
      const { data: v } = await supabase
        .from("vessels")
        .select("name, vessel_type, length_m, engine_model, fuel_type, category, created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (v) {
        setVessel({
          name: v.name,
          vessel_type: v.vessel_type,
          length_m: v.length_m ? Number(v.length_m) : null,
          engine_model: v.engine_model,
          fuel_type: v.fuel_type,
          category: v.category,
          manufacturer: null,
          model: null,
          home_marina: profile?.home_marina ?? null,
          flag: null,
          engine_hours: null,
        });
      }
      setVesselLoading(false);
    })();
  }, [userId, profile?.home_marina]);

  useEffect(() => {
    supabase
      .from("jobs")
      .select("id, problem_category, service_type, status, created_at, updated_at, description")
      .eq("client_id", userId)
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        const rows = (data as JobRow[]) ?? [];
        setActiveJobs(rows.filter((r) => ACTIVE_STATUSES.includes(r.status)));
        setCompletedJobs(rows.filter((r) => r.status === "Completed"));
      });

    supabase
      .from("job_parts")
      .select("id, part_name, part_price, source, created_at, jobs!inner(client_id)")
      .eq("jobs.client_id", userId)
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        const rows = (data as Array<{ id: string; part_name: string; part_price: number | null; source: string | null; created_at: string }> ) ?? [];
        setParts(rows.map((r) => ({
          id: r.id, part_name: r.part_name, part_price: r.part_price ? Number(r.part_price) : null,
          source: r.source, installed_at: r.created_at,
        })));
      });
  }, [userId]);

  if (vesselLoading) return <ThalvoLoader />;

  if (!vessel) {
    return (
      <BoatPassportShell title={t("passport.title")} eyebrow={t("passport.eyebrow")}>
        <GlassPanel className="text-center py-10">
          <div className="mx-auto size-14 rounded-2xl bg-sky-400/10 border border-sky-400/25 grid place-items-center text-sky-300 mb-4">
            <Ship className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-white">{t("passport.no_vessel_title")}</h2>
          <p className="text-sm text-white/60 mt-1 max-w-md mx-auto">
            {t("passport.no_vessel_body")}
          </p>
          <Link
            to="/app/profile"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/15 hover:bg-sky-500/25 px-4 py-2 text-sm text-sky-200"
          >
            <Plus className="size-4" /> {t("passport.register_vessel")}
          </Link>
        </GlassPanel>
      </BoatPassportShell>
    );
  }

  const lastCompleted = completedJobs[0]?.updated_at ?? completedJobs[0]?.created_at ?? null;

  const events: TimelineEvent[] = [
    ...activeJobs.filter((j) => j.service_type === "sos" || j.problem_category?.toLowerCase().includes("acil"))
      .map<TimelineEvent>((j) => ({
        id: `sos-${j.id}`, kind: "sos", at: j.created_at,
        title: `${t("passport.sos_event")} · ${j.problem_category || t("passport.emergency")}`,
        detail: j.description ?? undefined,
      })),
    ...completedJobs.map<TimelineEvent>((j) => ({
      id: `job-${j.id}`, kind: "job", at: j.updated_at || j.created_at,
      title: `${t("passport.completed_event")} · ${j.problem_category || j.service_type || t("passport.mission_fallback")}`,
      detail: j.description ?? undefined,
    })),
    ...parts.map<TimelineEvent>((p) => ({
      id: `part-${p.id}`, kind: "part", at: p.installed_at,
      title: `${t("passport.part_installed")} · ${p.part_name}`,
      detail: p.part_price != null ? formatTL(p.part_price) : undefined,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20);

  return (
    <BoatPassportShell
      title={vessel.name || t("passport.title")}
      eyebrow={t("passport.eyebrow")}
      right={<StatusChip tone="info" icon={<Activity className="size-3" />}>{t("passport.active_count", { count: activeJobs.length })}</StatusChip>}
    >
      <VesselIdentityCard vessel={vessel} ownerName={profile?.full_name} />

      <div className="grid gap-3 md:grid-cols-2">
        <MaintenanceDueCard
          lastServiceAt={lastCompleted}
          nextDueAt={null}
          engineHours={vessel.engine_hours ?? null}
        />
        <GlassPanel>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">{t("passport.mission_log")}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{t("passport.active")}</p>
              <p className="text-2xl font-semibold text-white tabular-nums mt-0.5">{activeJobs.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{t("passport.completed")}</p>
              <p className="text-2xl font-semibold text-white tabular-nums mt-0.5">{completedJobs.length}</p>
            </div>
          </div>
          {activeJobs[0] && (
            <Link
              to="/app/job/$id"
              params={{ id: activeJobs[0].id }}
              className="mt-3 block text-xs text-sky-300 hover:text-sky-200"
            >
              {t("passport.open_latest_mission")}
            </Link>
          )}
        </GlassPanel>
      </div>

      <VesselAiPanel
        vessel={vessel}
        context={{
          activeMissions: activeJobs.length,
          completedMissions: completedJobs.length,
          installedParts: parts.map((p) => p.part_name),
          lastServiceAt: lastCompleted,
        }}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <InstalledPartsCard parts={parts} />
        <VesselHealthTimeline events={events} />
      </div>

      <DocumentVaultPanel />

      <p className="text-[10px] text-white/30 text-center pt-2">
        {t("passport.footer_note")}
      </p>
    </BoatPassportShell>
  );
}
