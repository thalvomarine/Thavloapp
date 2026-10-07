import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
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
import { VesselSpecForm, fuelLabel, vesselCategoryLabel, vesselTypeLabel, type VesselSpec } from "@/components/passport/VesselSpecForm";
import { ENGINE_BRANDS, joinEngine, splitEngine } from "@/lib/marine-catalog";
import { groupMeasure, parseGrouped } from "@/lib/digit-format";
import { toast } from "sonner";
import { sanitizePlainText } from "@/lib/sanitize";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { Ship, Activity } from "lucide-react";
import { formatTL } from "@/lib/filter";


export const Route = createFileRoute("/_authenticated/app/passport")({
  ssr: false,
  component: PassportPage,
});

const ACTIVE_STATUSES = ["Pending", "Accepted", "EnRoute", "OnSite", "InProgress", "PartsPending"];

function blankSpec(): VesselSpec {
  return {
    name: "",
    category: "yacht",
    vesselType: "motor_yacht",
    lengthM: "",
    fuel: "diesel",
    engineBrand: ENGINE_BRANDS[0],
    engineModel: "",
  };
}

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
  if (profile?.role === "Supplier") return <Navigate to="/app/dealer" replace />;
  const [vessel, setVessel] = useState<VesselIdentity | null>(null);
  const [vesselLoading, setVesselLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState<JobRow[]>([]);
  const [completedJobs, setCompletedJobs] = useState<JobRow[]>([]);
  const [parts, setParts] = useState<InstalledPart[]>([]);
  const [registryOpen, setRegistryOpen] = useState(false);
  const [spec, setSpec] = useState<VesselSpec>(blankSpec);
  const [vesselId, setVesselId] = useState<string | null>(null);
  const [savingVessel, setSavingVessel] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: v } = await supabase
        .from("vessels")
        .select("id, name, vessel_type, length_m, engine_model, fuel_type, category, created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (v) {
        const engine = splitEngine(v.engine_model);
        setVesselId(v.id);
        setSpec({
          name: v.name ?? "",
          category: (v.category || "yacht").toLowerCase(),
          vesselType: v.vessel_type || "motor_yacht",
          lengthM: v.length_m ? groupMeasure(String(v.length_m)) : "",
          fuel: (v.fuel_type || "diesel").toLowerCase(),
          engineBrand: engine.brand,
          engineModel: engine.model,
        });
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

  const saveVessel = async () => {
    const name = sanitizePlainText(spec.name, 80);
    if (!name) {
      toast.error(t("vessel.need_name"));
      return;
    }
    setSavingVessel(true);
    const payload = {
      owner_id: userId,
      name,
      category: spec.category,
      vessel_type: spec.vesselType,
      length_m: spec.lengthM ? parseGrouped(spec.lengthM) : null,
      fuel_type: spec.fuel,
      engine_model: joinEngine(spec.engineBrand, spec.engineModel),
    };
    const write = vesselId
      ? supabase.from("vessels").update(payload).eq("id", vesselId).eq("owner_id", userId)
      : supabase.from("vessels").insert(payload).select("id").single();
    const { data, error } = await write;
    setSavingVessel(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!vesselId && data && "id" in data) setVesselId(data.id);
    setVessel({
      name,
      category: spec.category,
      vessel_type: spec.vesselType,
      length_m: payload.length_m,
      engine_model: payload.engine_model,
      fuel_type: spec.fuel,
      manufacturer: null,
      model: null,
      home_marina: profile?.home_marina ?? null,
      flag: null,
      engine_hours: null,
    });
    setRegistryOpen(false);
    toast.success(t("vessel.saved"));
  };

  if (!vessel) {
    return (
      <BoatPassportShell title={t("passport.title")} eyebrow={t("passport.eyebrow")}>
        <GlassPanel className="text-center py-8">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
            <Ship className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-white">{t("passport.no_vessel_title")}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-white/60">{t("passport.no_vessel_body")}</p>
        </GlassPanel>
        <VesselSpecForm value={spec} onChange={setSpec} onSave={() => void saveVessel()} saving={savingVessel} />
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
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setRegistryOpen((open) => !open)}
          className="h-10 rounded-full border border-cyan-300/30 px-4 text-[12px] font-semibold text-cyan-100"
        >
          {t(registryOpen ? "common.close" : "vessel.edit")}
        </button>
      </div>
      {registryOpen && (
        <VesselSpecForm
          value={spec}
          onChange={setSpec}
          onSave={() => void saveVessel()}
          onCancel={() => setRegistryOpen(false)}
          saving={savingVessel}
        />
      )}

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

      <DocumentVaultPanel userId={userId} />

      <p className="text-[10px] text-white/30 text-center pt-2">
        {t("passport.footer_note")}
      </p>
    </BoatPassportShell>
  );
}
