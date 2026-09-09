import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getFix, fixToJobFields, formatAccuracy, isStale, isLowAccuracy, type GeoFix } from "@/lib/geolocation";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessionUser } from "@/lib/session";
import { PROBLEM_KEYS } from "@/i18n";
import { Anchor, Loader2, MapPin, Wrench } from "lucide-react";
import { toast } from "sonner";
import { emitEvent } from "@/lib/events";
import { sanitizeMultiline } from "@/lib/sanitize";
import { CockpitHeader } from "@/components/core/CockpitHeader";
import { GlassPanel } from "@/components/mission/GlassPanel";


const searchSchema = z.object({ cat: z.enum(["mechanic", "diver"]).default("mechanic") });

export const Route = createFileRoute("/_authenticated/app/report")({
  ssr: false,
  validateSearch: searchSchema,
  component: ReportPage,
});

const MARINAS = ["Göcek D-Marin", "Bodrum Milta", "Marmaris Netsel", "Fethiye Ece", "Kaş Setur"];

function ReportPage() {
  const { cat } = Route.useSearch();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useSessionUser();
  const problems = cat === "diver" ? PROBLEM_KEYS.diver : PROBLEM_KEYS.mechanic;
  const [problem, setProblem] = useState<string>(problems[0]);
  const [marina, setMarina] = useState(MARINAS[0]);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<GeoFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);

  // Single shared positioning path — see src/lib/geolocation.ts.
  const requestLocation = useCallback(async () => {
    setLocating(true); setLocErr(null);
    const res = await getFix();
    if (res.ok) { setCoords(res.fix); setLocErr(null); }
    else { setCoords(null); setLocErr(t(res.failure.messageKey, { defaultValue: res.failure.defaultMessage })); }
    setLocating(false);
  }, [t]);

  useEffect(() => { void requestLocation(); }, [requestLocation]);


  if (!user) return null;

  const submit = async () => {
    if (busy) return; // duplicate-submit guard
    if (!coords) {
      toast.error(t("owner.location_required", { defaultValue: "Location is required to file a report." }));
      return;
    }
    if (isStale(coords)) {
      // Never submit a position the captain may have drifted away from.
      toast.error(t("geo.stale", { defaultValue: "Your position is out of date. Refresh it before continuing." }));
      void requestLocation();
      return;
    }

    setBusy(true);
    // Auto-append emergency maritime health note from the captain's profile.
    const { data: p } = await supabase.from("profiles").select("emergency_health_note").eq("id", user.id).maybeSingle();
    const healthNote = (p as { emergency_health_note: string | null } | null)?.emergency_health_note;
    const finalDescription = [
      sanitizeMultiline(description, 1500),
      healthNote ? `\n🩺 ${t("profile.health_note")}: ${sanitizeMultiline(healthNote, 500)}` : "",
    ].filter(Boolean).join("\n").trim().slice(0, 4000);
    const { data, error } = await supabase.from("jobs").insert({
      client_id: user.id,
      service_type: cat === "diver" ? "Underwater Diver" : "Marine Mechanic",
      problem_category: problem,
      description: finalDescription,
      marina,
      // Real device degrees only, with fix quality recorded alongside.
      ...fixToJobFields(coords),
    }).select("id").single();
    setBusy(false);
    if (!error && data) {
      emitEvent({
        type: "mission.created",
        subject_type: "mission",
        subject_id: data.id,
        metadata: { source: "report", problem_category: problem, category: cat, marina, accuracy_m: Math.round(coords.accuracy) },
      });
      navigate({ to: "/app/job/$id", params: { id: data.id } });
    }
  };


  const isDiver = cat === "diver";

  return (
    <AppShell userId={user.id}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={"size-12 shrink-0 rounded-2xl text-white grid place-items-center " + (isDiver ? "aqua-gradient" : "marine-gradient")}>
            {isDiver ? <Anchor className="size-6" /> : <Wrench className="size-6" />}
          </div>
          <div className="min-w-0">
            <CockpitHeader
              eyebrow={isDiver ? t("owner.cat_diver") : t("owner.cat_mechanic")}
              title={t("owner.report_title")}
            />
          </div>
        </div>

        <GlassPanel className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">{t("owner.problem")}</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {problems.map((p) => (
                <button key={p} onClick={() => setProblem(p)}
                  className={"px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors " +
                    (problem === p
                      ? (isDiver ? "bg-sky-500/20 border-sky-400/50 text-sky-100" : "bg-sky-500/20 border-sky-400/50 text-sky-100")
                      : "bg-white/[0.03] border-white/10 text-white/70 hover:bg-white/10")}>
                  {t(`problems.${p}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">{t("owner.marina")}</label>
            <select value={marina} onChange={(e) => setMarina(e.target.value)}
              className="mt-1 w-full h-11 rounded-xl bg-white/5 border border-white/10 text-white px-3 text-sm outline-none focus:border-sky-400/60">
              {MARINAS.map((m) => <option key={m} className="bg-slate-900">{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">{t("owner.describe")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 text-white p-3 text-sm outline-none focus:border-sky-400/60" />
          </div>
        </GlassPanel>

        <div className={"rounded-2xl border p-3 flex items-center gap-3 text-xs " +
          (coords
            ? isLowAccuracy(coords)
              ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
              : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
            : locating ? "border-white/10 bg-white/[0.04] text-white/70"
            : "border-amber-400/30 bg-amber-500/10 text-amber-100")}>
          {locating ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
          <div className="flex-1 min-w-0">
            {coords ? (
              <span className="font-mono">
                {coords.lat.toFixed(4)}° · {coords.lng.toFixed(4)}° · {formatAccuracy(coords)}
              </span>
            ) : locating ? (
              <span>{t("owner.location_locating", { defaultValue: "Getting your location…" })}</span>
            ) : (
              <span>{locErr ?? t("owner.location_required", { defaultValue: "Location required to file a report." })}</span>
            )}
          </div>
          {!locating && (
            <button onClick={() => { void requestLocation(); }} className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80 hover:opacity-100">
              {coords ? t("common.refresh", { defaultValue: "Refresh" }) : t("common.retry", { defaultValue: "Retry" })}
            </button>
          )}
        </div>


        <button onClick={submit} disabled={busy || !coords}
          className={"w-full h-14 rounded-2xl font-black text-lg text-white inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed " + (isDiver ? "aqua-gradient" : "amber-gradient text-warning-foreground")}>
          {busy && <Loader2 className="size-5 animate-spin" />}
          {t("owner.submit_sos")}
        </button>
      </div>
    </AppShell>
  );
}
