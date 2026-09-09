import { toast } from "sonner";
import { getFix } from "@/lib/geolocation";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { n, useSessionUser, type Profile } from "@/lib/session";
import { Anchor, Loader2, Plus, Save, Ship, Trash2 } from "lucide-react";
import { CockpitHeader } from "@/components/core/CockpitHeader";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { SectionHeader } from "@/components/core/SectionHeader";
import { StatusBadge } from "@/components/core/StatusBadge";
import { RiskBanner } from "@/components/core/RiskBanner";
import { EmptyState } from "@/components/core/EmptyState";
import { restartOnboarding } from "@/components/onboarding/useFirstRun";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { AboutThalvo } from "@/components/AboutThalvo";
import { sanitizeMultiline, sanitizePlainText } from "@/lib/sanitize";


export const Route = createFileRoute("/_authenticated/app/profile")({
  ssr: false,
  component: ProfilePage,
});

const ENGINE_BRANDS = ["Yamaha", "Volvo Penta", "Yanmar", "Mercury", "Suzuki"];
const EQUIPMENT_KEYS = ["eq_diag", "eq_welding", "eq_boat", "eq_crane", "eq_night"] as const;
const ACCOUNT_TYPES = ["Private Owner", "Commercial Captain", "Sea Enthusiast"];
const VESSEL_TYPES = ["Sailing", "Motor Yacht", "Catamaran", "Inflatable Bot"];
const FUELS = ["Diesel", "Petrol", "Electric", "Hybrid"];

function ProfilePage() {
  const { user, loading: sessionLoading } = useSessionUser();
  const { profile, loading } = n(user?.id);
  if ((!user && sessionLoading) || loading || !profile) return <ThalvoLoader />;
  return (
    <AppShell userId={user!.id}>
      {profile.role === "Provider" ? <ProviderProfile profile={profile} /> : <ClientProfile profile={profile} />}
    </AppShell>
  );
}


/* ============== PROVIDER PROFILE ============== */
function ProviderProfile({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState(profile.company_name ?? "");
  const [baseLocation, setBaseLocation] = useState(profile.base_location ?? "");
  const [isAvailable, setIsAvailable] = useState(profile.is_available);
  const [equipment, setEquipment] = useState<string[]>(profile.equipment ?? []);
  const [brands, setBrands] = useState<string[]>([]);
  const [activeJobs, setActiveJobs] = useState<Array<{ id: string; problem_category: string; status: string; profiles: { boat_name: string | null } | null }>>([]);
  const [completed, setCompleted] = useState<Array<{ id: string; problem_category: string; service_type: string | null; marina: string | null; created_at: string; profiles: { boat_name: string | null } | null }>>([]);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  useEffect(() => {
    supabase.from("provider_details").select("specialized_brands").eq("id", profile.id).maybeSingle()
      .then(({ data }) => setBrands(((data as { specialized_brands: string[] } | null)?.specialized_brands) ?? []));
    supabase.from("jobs")
      .select("id, problem_category, status, profiles!jobs_client_id_fkey(boat_name)")
      .eq("provider_id", profile.id)
      .in("status", ["Accepted", "EnRoute", "OnSite", "InProgress", "PartsPending"])
      .order("created_at", { ascending: false })
      .then(({ data }) => setActiveJobs((data as never) ?? []));
    supabase.from("jobs")
      .select("id, problem_category, service_type, marina, created_at, profiles!jobs_client_id_fkey(boat_name)")
      .eq("provider_id", profile.id).eq("status", "Completed")
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setCompleted((data as never) ?? []));
  }, [profile.id]);

  const toggleBrand = (b: string) => setBrands((p) => p.includes(b) ? p.filter((x) => x !== b) : [...p, b]);
  const toggleEq = (e: string) => setEquipment((p) => p.includes(e) ? p.filter((x) => x !== e) : [...p, e]);

  const save = async () => {
    setSaving(true);
    await supabase.from("profiles").update({
      company_name: sanitizePlainText(companyName, 120) || null,
      base_location: sanitizePlainText(baseLocation, 120) || null,
      is_available: isAvailable,
      equipment,
    }).eq("id", profile.id);

    // Going Available publishes a REAL device fix; going Offline clears it.
    // A provider is never plotted on a captain's map with an invented position.
    let position: { lat: number | null; lng: number | null } = { lat: null, lng: null };
    if (isAvailable) {
      const res = await getFix();
      if (res.ok) {
        position = { lat: res.fix.lat, lng: res.fix.lng };
      } else {
        toast.error(t(res.failure.messageKey, { defaultValue: res.failure.defaultMessage }));
      }
    }

    await supabase.from("provider_details").update({
      specialized_brands: brands,
      live_status: isAvailable ? "Available" : "Offline",
      ...position,
    }).eq("id", profile.id);
    setSaving(false);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1600);
  };

  return (
    <div className="space-y-4">
      <CockpitHeader
        eyebrow={t("profile.title")}
        title={profile.full_name}
        subtitle={[companyName, baseLocation ? `📍 ${baseLocation}` : null].filter(Boolean).join(" · ") || undefined}
        actions={
          <button
            onClick={() => setIsAvailable(!isAvailable)}
            className={
              "px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.14em] border transition-colors " +
              (isAvailable
                ? "bg-emerald-400/15 border-emerald-400/40 text-emerald-200"
                : "bg-white/[0.03] border-white/10 text-white/60")
            }
          >
            ● {isAvailable ? t("profile.available") : t("profile.offline")}
          </button>
        }
      />

      <GlassPanel className="space-y-3">
        <SectionHeader label={t("profile.identity")} />
        <Field label={t("profile.company_name")} value={companyName} onChange={setCompanyName} />
        <Field label={t("profile.base_location")} value={baseLocation} onChange={setBaseLocation} placeholder="Göcek D-Marin" />
      </GlassPanel>

      <GlassPanel>
        <SectionHeader label={t("profile.brand_badges")} />
        <div className="mt-2 flex flex-wrap gap-2">
          {ENGINE_BRANDS.map((b) => (
            <button key={b} onClick={() => toggleBrand(b)}
              className={"px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-[0.12em] border transition-colors " +
                (brands.includes(b)
                  ? "bg-sky-500/20 border-sky-400/50 text-sky-100"
                  : "bg-white/[0.03] border-white/10 text-white/55 hover:bg-white/10")}>
              {b}
            </button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel>
        <SectionHeader label={t("profile.equipment")} />
        <div className="mt-2 grid grid-cols-1 gap-2">
          {EQUIPMENT_KEYS.map((k) => (
            <label key={k} className="flex items-center gap-3 text-sm text-white/80">
              <input type="checkbox" checked={equipment.includes(k)} onChange={() => toggleEq(k)} className="size-4 accent-sky-400" />
              <span>{t(`profile.${k}`)}</span>
            </label>
          ))}
        </div>
      </GlassPanel>

      <button onClick={save} disabled={saving}
        className="w-full h-12 rounded-xl amber-gradient text-warning-foreground font-black uppercase tracking-wider inline-flex items-center justify-center gap-2">
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {savedTick ? t("profile.saved") : t("profile.save")}
      </button>

      <section className="space-y-2">
        <SectionHeader label={t("profile.active_received")} />
        {activeJobs.length === 0 ? (
          <GlassPanel><EmptyState title={t("profile.no_active")} /></GlassPanel>
        ) : (
          <ul className="space-y-2">
            {activeJobs.map((j) => (
              <li key={j.id} className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{t(`problems.${j.problem_category}`, { defaultValue: j.problem_category })}</p>
                  <p className="text-[11px] text-white/50">⚓ {j.profiles?.boat_name ?? "—"}</p>
                </div>
                <StatusBadge tone="info">{t(`status.${j.status}`)}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <SectionHeader label={t("profile.completed_history")} />
        {completed.length === 0 ? (
          <GlassPanel><EmptyState title={t("profile.no_completed")} /></GlassPanel>
        ) : (
          <ul className="space-y-2">
            {completed.map((j) => (
              <li key={j.id} className="glass-panel rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{t(`problems.${j.problem_category}`, { defaultValue: j.problem_category })}</p>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">{t("profile.review_pending", { defaultValue: "Review pending" })}</span>
                </div>
                <p className="text-[11px] text-white/50">⚓ {j.profiles?.boat_name ?? "—"}{j.marina ? ` · 📍 ${j.marina}` : ""}</p>
                {j.service_type && <p className="text-[11px] text-white/40">{j.service_type}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <OnboardingReplayRow userId={profile.id} />
      <AboutThalvo />
      <InstallAppButton />


    </div>
  );
}


/* ============== CLIENT PROFILE ============== */
interface Vessel {
  id: string; owner_id: string; category: string; name: string;
  vessel_type: string | null; length_m: number | null;
  engine_model: string | null; fuel_type: string | null;
}

function ClientProfile({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(profile.full_name);
  const [accountType, setAccountType] = useState(profile.account_type ?? ACCOUNT_TYPES[0]);
  const [healthNote, setHealthNote] = useState(profile.emergency_health_note ?? "");
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [addingVessel, setAddingVessel] = useState(false);
  const [newVessel, setNewVessel] = useState({ name: "", category: "Boat", vessel_type: VESSEL_TYPES[0], length_m: "", engine_model: "", fuel_type: FUELS[0] });

  const loadVessels = () => {
    supabase.from("vessels").select("*").eq("owner_id", profile.id).order("created_at", { ascending: false })
      .then(({ data }) => setVessels((data as never) ?? []));
  };
  useEffect(loadVessels, [profile.id]);

  const save = async () => {
    setSaving(true);
    await supabase.from("profiles").update({
      full_name: sanitizePlainText(fullName, 80) || profile.full_name,
      account_type: accountType,
      emergency_health_note: sanitizeMultiline(healthNote, 500) || null,
    }).eq("id", profile.id);
    setSaving(false); setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1600);
  };

  const addVessel = async () => {
    if (!newVessel.name) return;
    const vesselName = sanitizePlainText(newVessel.name, 80);
    if (!vesselName) return;
    await supabase.from("vessels").insert({
      owner_id: profile.id,
      name: vesselName,
      category: newVessel.category,
      vessel_type: newVessel.vessel_type,
      length_m: newVessel.length_m ? Number(newVessel.length_m) : null,
      engine_model: sanitizePlainText(newVessel.engine_model, 80) || null,
      fuel_type: newVessel.fuel_type,
    });
    setAddingVessel(false);
    setNewVessel({ name: "", category: "Boat", vessel_type: VESSEL_TYPES[0], length_m: "", engine_model: "", fuel_type: FUELS[0] });
    loadVessels();
  };
  const removeVessel = async (id: string) => {
    await supabase.from("vessels").delete().eq("id", id);
    loadVessels();
  };

  return (
    <div className="space-y-4">
      <CockpitHeader
        eyebrow={t("profile.title")}
        title={profile.full_name}
        subtitle={t(`auth.account_${accountType.replace(/\s/g, "_").toLowerCase()}`, accountType)}
      />

      <GlassPanel className="space-y-3">
        <SectionHeader label={t("profile.identity")} />
        <Field label={t("auth.full_name")} value={fullName} onChange={setFullName} />
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">{t("profile.account_type")}</label>
          <select value={accountType} onChange={(e) => setAccountType(e.target.value)}
            className="mt-1 w-full h-11 rounded-xl bg-white/5 border border-white/10 text-white px-3 text-sm outline-none focus:border-sky-400/60">
            {ACCOUNT_TYPES.map((a) => (
              <option key={a} value={a} className="bg-slate-900">{t(`auth.account_${a.replace(/\s/g, "_").toLowerCase()}`, a)}</option>
            ))}
          </select>
        </div>
      </GlassPanel>

      <GlassPanel>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader label={t("profile.vessels")} />
          <button onClick={() => setAddingVessel(true)} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300 inline-flex items-center gap-1">
            <Plus className="size-3.5" /> {t("profile.add_vessel")}
          </button>
        </div>
        {vessels.length === 0 && !addingVessel && (
          <EmptyState title="—" />
        )}
        <ul className="space-y-2">
          {vessels.map((v) => (
            <li key={v.id} className="flex items-start gap-2 rounded-xl bg-white/[0.03] border border-white/10 p-3">
              <Ship className="size-4 mt-0.5 text-sky-300" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{v.name} <span className="text-[10px] font-normal text-white/40 uppercase ml-1">{v.category}</span></p>
                <p className="text-[11px] text-white/50">{v.vessel_type} · {v.length_m ?? "?"}m · {v.fuel_type}</p>
                {v.engine_model && <p className="text-[11px] text-white/50">🔧 {v.engine_model}</p>}
              </div>
              <button onClick={() => removeVessel(v.id)} className="text-white/40 hover:text-rose-300">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        {addingVessel && (
          <div className="mt-3 space-y-2 rounded-xl border border-dashed border-white/15 p-3">
            <Field label={t("profile.vessel_name")} value={newVessel.name} onChange={(v) => setNewVessel({ ...newVessel, name: v })} />
            <div className="grid grid-cols-2 gap-2">
              <Select label={t("profile.vessel_category")} value={newVessel.category} options={["Boat", "RIB"]} onChange={(v) => setNewVessel({ ...newVessel, category: v })} />
              <Select label={t("profile.vessel_type")} value={newVessel.vessel_type} options={VESSEL_TYPES} onChange={(v) => setNewVessel({ ...newVessel, vessel_type: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("profile.vessel_length")} value={newVessel.length_m} onChange={(v) => setNewVessel({ ...newVessel, length_m: v })} type="number" />
              <Select label={t("profile.vessel_fuel")} value={newVessel.fuel_type} options={FUELS} onChange={(v) => setNewVessel({ ...newVessel, fuel_type: v })} />
            </div>
            <Field label={t("profile.vessel_engine")} value={newVessel.engine_model} onChange={(v) => setNewVessel({ ...newVessel, engine_model: v })} />
            <div className="flex gap-2">
              <button onClick={() => setAddingVessel(false)} className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-white/80 text-xs">{t("common.cancel")}</button>
              <button onClick={addVessel} className="flex-1 h-10 rounded-xl amber-gradient text-warning-foreground text-xs font-bold">{t("common.save")}</button>
            </div>
          </div>
        )}
      </GlassPanel>

      <RiskBanner
        risk="medium"
        title={`🩺 ${t("profile.health_note")}`}
        body={t("profile.health_hint")}
      />
      <GlassPanel>
        <textarea value={healthNote} onChange={(e) => setHealthNote(e.target.value)} rows={3}
          className="w-full rounded-xl bg-white/5 border border-white/10 text-white p-3 text-sm outline-none focus:border-sky-400/60" />
      </GlassPanel>

      <button onClick={save} disabled={saving}
        className="w-full h-12 rounded-xl amber-gradient text-warning-foreground font-black uppercase tracking-wider inline-flex items-center justify-center gap-2">
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {savedTick ? t("profile.saved") : t("profile.save")}
      </button>

      <OnboardingReplayRow userId={profile.id} />
      <AboutThalvo />
      <InstallAppButton />



      {/* footer stat */}
      <p className="text-center text-[10px] uppercase tracking-[0.18em] text-white/40">
        <Anchor className="inline size-3 mr-1" />THALVO · {vessels.length} vessels
      </p>
    </div>
  );
}

function OnboardingReplayRow({ userId }: { userId: string }) {
  return (
    <button
      type="button"
      onClick={() => restartOnboarding(userId)}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors px-4 py-3 flex items-center justify-between text-left"
    >
      <span>
        <span className="block text-sm font-semibold text-white">Replay welcome tour</span>
        <span className="block text-[11px] text-white/55">Re-open the THALVO first-run experience.</span>
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">Restart</span>
    </button>
  );
}


function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-muted-foreground">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-11 rounded-xl border border-input bg-background px-3.5 text-sm" />
    </div>
  );
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-11 rounded-xl border border-input bg-background px-3 text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
