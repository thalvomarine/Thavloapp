import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { askThalvoAi } from "@/lib/thalvo-ai.functions";
import { emitEvent } from "@/lib/events";
import { PROBLEM_KEYS } from "@/i18n";
import { useOnlineStatus } from "@/lib/pwa";
import { getFix, fixToJobFields, formatAccuracy, isStale, isLowAccuracy, readLastFix, type GeoFix } from "@/lib/geolocation";
import { sanitizeMultiline } from "@/lib/sanitize";
import { formatDm } from "@/lib/formatters";
import { publishLocatedCall } from "@/lib/emergency-service";
import { openEmergencyService } from "@/lib/emergency-service-bus";
import {
  Anchor, ArrowLeft, Camera, Check, Loader2, MapPin, Radio,
  Sparkle, WifiOff, Wrench, X,
} from "lucide-react";


type Category = "mechanic" | "diver";
type Step = 0 | 1 | 2;
type Situation = "marina" | "anchor" | "underway";
type EngineState = "running" | "stopped" | "no_start";
type DiveTarget = "rope" | "anchor" | "hull" | "object";
type SafetyFlag = "smoke" | "water" | "fuel" | "person";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_MAX = 5 * 1024 * 1024;

const MARINAS = ["Göcek D-Marin", "Bodrum Milta", "Marmaris Netsel", "Fethiye Ece", "Kaş Setur"];

function composeBrief(parts: {
  situation: string;
  machine: string;
  safety: string;
  note: string;
  advice: string;
  health: string;
}): string {
  return [parts.situation, parts.machine, parts.safety, parts.note, parts.advice, parts.health]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialCategory?: Category;
  initialNote?: string;
}

/**
 * SOS Emergency Cockpit — simplified 3-step flow: Problem → Location → Send.
 * Publish, GPS, category, media validation, and event logging are preserved verbatim.
 * The send step carries a structured brief the technician reads before leaving.
 */
export function SosSheet({ open, onClose, initialCategory = "mechanic", initialNote }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const ask = useServerFn(askThalvoAi);
  const online = useOnlineStatus();

  const isTr = i18n.language !== "en";

  const [step, setStep] = useState<Step>(0);
  const [category, setCategory] = useState<Category>(initialCategory);
  const problems = category === "diver" ? PROBLEM_KEYS.diver : PROBLEM_KEYS.mechanic;
  const [problem, setProblem] = useState<string>(problems[0]);
  const [marina, setMarina] = useState(MARINAS[0]);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [situation, setSituation] = useState<Situation | null>(null);
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [diveTarget, setDiveTarget] = useState<DiveTarget | null>(null);
  const [safety, setSafety] = useState<SafetyFlag[]>([]);
  const [coords, setCoords] = useState<GeoFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiOk, setAiOk] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep(0); setCategory(initialCategory); setProblem(problems[0]);
    setMarina(MARINAS[0]); setNote(""); setPhoto(null); setPhotoFile(null);
    setBriefOpen(false); setSituation(null); setEngineState(null); setDiveTarget(null); setSafety([]);
    setCoords(null); setLocErr(null); setAiText(null); setAiOk(false);
    setLocating(false); setAiBusy(false); setPublishing(false);
  }, [initialCategory, problems]);

  // Reset problem list when category changes
  useEffect(() => { setProblem((category === "diver" ? PROBLEM_KEYS.diver : PROBLEM_KEYS.mechanic)[0]); }, [category]);

  // Sync initial category / AI-prepared brief when opened
  useEffect(() => {
    if (!open) return;
    setCategory(initialCategory);
    if (initialNote?.trim()) {
      setNote(initialNote.trim());
      setBriefOpen(true);
    }
  }, [open, initialCategory, initialNote]);

  // Single shared positioning path — no fallback marina, no invented coordinates.
  const locate = useCallback(async () => {
    setLocating(true); setLocErr(null);
    const res = await getFix();
    if (res.ok) {
      setCoords(res.fix);
      setLocErr(null);
    } else {
      const last = readLastFix();
      if (last) {
        setCoords(last);
        setLocErr(null);
      } else {
        setCoords(null);
        setLocErr(t(res.failure.messageKey, { defaultValue: res.failure.defaultMessage }));
      }
    }
    setLocating(false);
  }, [t]);

  // Auto-locate as soon as the sheet opens so Location step shows a live status.
  useEffect(() => {
    if (!open || coords || locating) return;
    void locate();
  }, [open, coords, locating, locate]);



  // ESC to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const runDiagnosis = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    setAiText(null);
    setAiOk(false);
    const problemLabel = t(`problems.${problem}`, { defaultValue: problem });
    const catLabel = category === "diver" ? "Underwater diver" : "Marine mechanic";
    const prompt =
      `Marine emergency intake. Reply in ${i18n.language === "en" ? "English" : "Turkish"} in 2–3 short sentences. ` +
      `Be calm and specific.\n\n` +
      `Category: ${catLabel}\nProblem: ${problemLabel}\nLocation: ${marina}` +
      (coords ? ` (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : "") +
      (situation ? `\nBoat: ${t(`sos_sheet.sit_${situation}`)}` : "") +
      (category === "mechanic" && engineState ? `\nEngine: ${t(`sos_sheet.eng_${engineState}`)}` : "") +
      (category === "diver" && diveTarget ? `\nIn the water: ${t(`sos_sheet.dive_${diveTarget}`)}` : "") +
      (safety.length ? `\nSafety: ${safety.map((flag) => t(`sos_sheet.safe_${flag}`)).join(", ")}` : "") +
      (note ? `\nCaptain note: ${note}` : "") +
      (photo ? `\n(Photo attached by captain — not visible to you here.)` : "") +
      `\n\nReturn: (1) one-line likely cause, (2) one immediate safety step the captain can take now, (3) what a responder will most likely need on arrival. No panic language.`;
    try {
      const res = await ask({ data: { messages: [{ role: "user", content: prompt.slice(0, 4000) }], lang: (i18n.language === "en" ? "en" : "tr") } });
      setAiText(res.text || t("sos_sheet.advice_offline"));
      setAiOk(Boolean(res.text));
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      setAiOk(false);
      setAiText(
        raw.includes("ai_rate_limited")
          ? t("common.ai_rate_limited")
          : t("sos_sheet.advice_offline"),
      );
    } finally {
      setAiBusy(false);
    }
  };

  const publish = async () => {
    if (publishing) return;
    setPublishing(true);
    const fallbackMsg = isTr ? "SOS Bildirildi (Offline/Fallback)" : "SOS reported (Offline/Fallback)";

    const acknowledgeFallback = (reason: unknown) => {
      console.error("[sos] fallback", reason);
      try {
        sessionStorage.setItem(
          "thalvo-sos-fallback",
          JSON.stringify({
            at: Date.now(),
            category,
            problem,
            marina,
            note: note.slice(0, 500),
            coords,
            online,
          }),
        );
      } catch {
        /* quota */
      }
      toast.success(fallbackMsg);
      setPublishing(false);
      onClose();
      reset();
    };

    const liveFix = coords ?? readLastFix();

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData.session) {
        acknowledgeFallback(sessionErr ?? "no-session");
        return;
      }
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        acknowledgeFallback(refreshErr);
        return;
      }
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData?.user;
      if (userErr || !user) {
        acknowledgeFallback(userErr ?? "no-user");
        return;
      }
      const { data: p } = await supabase.from("profiles").select("emergency_health_note, boat_name").eq("id", user.id).maybeSingle();
      const profileRow = p as { emergency_health_note: string | null; boat_name: string | null } | null;
      const healthNote = profileRow?.emergency_health_note;
      const brief = composeBrief({
        situation: situation ? `${t("sos_sheet.situation")}: ${t(`sos_sheet.sit_${situation}`)}` : "",
        machine:
          category === "diver"
            ? diveTarget
              ? `${t("sos_sheet.dive_target")}: ${t(`sos_sheet.dive_${diveTarget}`)}`
              : ""
            : engineState
              ? `${t("sos_sheet.engine_state")}: ${t(`sos_sheet.eng_${engineState}`)}`
              : "",
        safety:
          safety.length > 0
            ? `${t("sos_sheet.safety")}: ${safety.map((flag) => t(`sos_sheet.safe_${flag}`)).join(", ")}`
            : "",
        note: sanitizeMultiline(note, 1500),
        advice: aiOk && aiText ? `${t("sos_sheet.advice")}: ${sanitizeMultiline(aiText, 1500)}` : "",
        health: healthNote ? `${t("profile.health_note")}: ${sanitizeMultiline(healthNote, 500)}` : "",
      });
      let photoPath: string | null = null;
      if (photoFile) {
        const ext = photoFile.type === "image/png" ? "png" : photoFile.type === "image/webp" ? "webp" : "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const uploaded = await supabase.storage.from("job-photos").upload(path, photoFile, {
          contentType: photoFile.type,
          upsert: false,
        });
        if (uploaded.error) toast.warning(t("sos_sheet.photo_skipped"));
        else photoPath = path;
      }
      const finalDescription = (brief || t(`problems.${problem}`, { defaultValue: problem })).slice(0, 4000);
      const { data, error } = await (async () => {
        try {
          return await supabase.from("jobs").insert({
            client_id: user.id,
            service_type: category === "diver" ? "Underwater Diver" : "Marine Mechanic",
            problem_category: problem,
            description: finalDescription,
            photo_url: photoPath,
            marina,
            ...(liveFix ? fixToJobFields(liveFix) : {}),
          }).select("id").single();
        } catch (insertErr) {
          return { data: null, error: insertErr as { message?: string } };
        }
      })();
      if (error || !data) {
        acknowledgeFallback(error ?? "insert-empty");
        return;
      }
      if (liveFix) {
        const placed = await publishLocatedCall({
          userId: user.id,
          category,
          lat: liveFix.lat,
          lng: liveFix.lng,
          vesselName: profileRow?.boat_name?.trim() || "",
          bayName: marina,
          description: finalDescription,
          urgency: "urgent",
        });
        if (placed.error) {
          console.error("[sos] located call", placed.error);
          toast.warning(
            isTr
              ? "Çağrı kaydedildi ama usta haritasına konum düşmedi. Konumu yenileyip tekrar gönderin."
              : "The call was saved, but the position did not reach the provider chart. Refresh the fix and send again.",
          );
        }
      }
      emitEvent({
        type: "sos.created",
        subject_type: "job",
        subject_id: data.id,
        metadata: {
          problem_category: problem,
          marina,
          category,
          accuracy_m: liveFix && Number.isFinite(liveFix.accuracy) ? Math.round(liveFix.accuracy) : null,
          fallback: !liveFix,
        },
      });
      setPublishing(false);
      onClose();
      reset();
      navigate({ to: "/app/job/$id", params: { id: data.id } });
    } catch (e) {
      acknowledgeFallback(e);
    }
  };

  const canNext = (() => {
    if (step === 0) return !!problem && !!category;
    return true;
  })();

  const titles: [string, string, string] = isTr
    ? ["Sorun", "Konum", "SOS gönder"]
    : ["Problem", "Location", "Send SOS"];

  const stepLabel = isTr
    ? `SOS · Adım ${step + 1} / 3`
    : `SOS · Step ${step + 1} of 3`;

  const locationState: { label: string; tone: "ok" | "warn" | "manual" } =
    coords
      ? isStale(coords)
        ? { label: isTr ? "Son bilinen konum" : "Last known position", tone: "warn" }
        : isLowAccuracy(coords)
          ? { label: isTr ? "Düşük hassasiyetli konum" : "Low-accuracy position", tone: "warn" }
          : { label: isTr ? "Mevcut konum kullanılıyor" : "Using current location", tone: "ok" }
      : locating
        ? { label: isTr ? "Konum alınıyor…" : "Getting location…", tone: "warn" }
        : { label: isTr ? "Konumsuz devam edilebilir" : "You can continue without a fix", tone: "manual" };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="thalvo-dark relative w-full max-w-xl bg-[oklch(0.14_0.02_250)] text-foreground border-t border-white/10 rounded-t-3xl overflow-hidden shadow-[0_-30px_80px_-20px_rgba(0,0,0,0.9)] flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="px-4 pt-3 pb-4 border-b border-white/[0.06]">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/20 mb-3" />
          <div className="flex items-center gap-3">
            {step > 0 ? (
              <button
                onClick={() => setStep(((step as number) - 1) as Step)}
                className="size-9 grid place-items-center rounded-full bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                aria-label="Back"
              ><ArrowLeft className="size-4" /></button>
            ) : <span className="size-9" />}
            <div className="flex-1 min-w-0 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-300/90">{stepLabel}</p>
              <p className="text-sm font-semibold text-white mt-0.5 truncate">{titles[step]}</p>
            </div>
            <button
              onClick={onClose}
              className="size-9 grid place-items-center rounded-full bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
              aria-label="Close"
            ><X className="size-4" /></button>
          </div>
          {/* Step dots */}
          <div className="mt-3 flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={
                  "h-1 flex-1 rounded-full transition-all " +
                  (i < step ? "bg-sky-400/70" : i === step ? "bg-sky-400" : "bg-white/10")
                }
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          {step === 0 && (
            <StepProblem
              category={category} onCategory={setCategory}
              problem={problem} onProblem={setProblem} problems={[...problems]}
              isTr={isTr}
              onServiceCall={() => {
                onClose();
                openEmergencyService({
                  category: category === "diver" ? "diver" : "mechanic",
                });
              }}
            />
          )}
          {step === 1 && (
            <StepLocation
              coords={coords} locating={locating} err={locErr}
              marina={marina} onMarina={setMarina}
              stateLabel={locationState.label} stateTone={locationState.tone}
              onRetry={() => { void locate(); }}
              isTr={isTr}
            />
          )}
          {step === 2 && (
            <StepSend
              category={category}
              problem={t(`problems.${problem}`, { defaultValue: problem })}
              marina={marina} coords={coords}
              stateLabel={locationState.label}
              note={note} onNote={setNote}
              photo={photo}
              onPickPhoto={() => fileRef.current?.click()}
              onClearPhoto={() => {
                setPhoto(null);
                setPhotoFile(null);
              }}
              briefOpen={briefOpen}
              onBriefOpen={setBriefOpen}
              situation={situation}
              onSituation={setSituation}
              engineState={engineState}
              onEngineState={setEngineState}
              diveTarget={diveTarget}
              onDiveTarget={setDiveTarget}
              safety={safety}
              onSafety={(flag) =>
                setSafety((current) =>
                  current.includes(flag) ? current.filter((item) => item !== flag) : [...current, flag],
                )
              }
              aiBusy={aiBusy} aiText={aiText} onRunAi={runDiagnosis}
              isTr={isTr}
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              // File validation — image only, ≤ 8 MB.
              if (!PHOTO_TYPES.has(f.type)) {
                toast.error(t("sos_sheet.photo_bad_type"));
                return;
              }
              if (f.size > PHOTO_MAX) {
                toast.error(t("sos_sheet.photo_big"));
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                setPhotoFile(f);
                setPhoto(String(reader.result));
                setBriefOpen(true);
              };
              reader.onerror = () => toast.error(t("sos_sheet.photo_read"));
              reader.readAsDataURL(f);
            }}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] bg-[oklch(0.13_0.02_250/0.9)] backdrop-blur-md p-3 pb-[max(env(safe-area-inset-bottom),12px)] space-y-2">
          {!online && (
            <div role="alert" className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100 inline-flex items-start gap-2 w-full">
              <WifiOff className="size-3.5 mt-0.5 shrink-0" />
              {t("sos_sheet.offline")}
            </div>
          )}
          <div className="flex gap-2">
            {step < 2 ? (
              <button
                type="button"
                onClick={() => setStep(((step as number) + 1) as Step)}
                disabled={!canNext}
                className="flex-1 h-14 rounded-2xl bg-white text-slate-900 font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTr ? "Devam" : "Continue"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void publish()}
                disabled={publishing}
                className="flex-1 h-14 rounded-2xl font-bold text-base text-white inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed tracking-wide"
                style={{
                  background: "linear-gradient(135deg, oklch(0.68 0.24 25) 0%, oklch(0.6 0.24 18) 100%)",
                  boxShadow: "0 18px 50px -10px rgba(244,63,94,0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
                }}
              >
                {publishing ? <Loader2 className="size-5 animate-spin" /> : <Radio className="size-5" />}
                {isTr ? "SOS gönder" : "Send SOS"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ---------- steps ---------- */

function StepProblem({
  category, onCategory, problem, onProblem, problems, isTr, onServiceCall,
}: {
  category: Category; onCategory: (c: Category) => void;
  problem: string; onProblem: (p: string) => void; problems: string[];
  isTr: boolean;
  onServiceCall: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onServiceCall}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-400/35 bg-cyan-400/10 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
            {t("esvc.entry_eyebrow")}
          </span>
          <span className="mt-0.5 block text-sm font-semibold text-white">
            {t("esvc.entry_title")}
          </span>
        </span>
        <span className="text-cyan-200/80">›</span>
      </button>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50 mb-2">
          {isTr ? "Yardım türü" : "Type of help"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <CategoryCard active={category === "mechanic"} onClick={() => onCategory("mechanic")} icon={<Wrench className="size-5" />} label={isTr ? "Deniz mekaniği" : "Marine mechanic"} />
          <CategoryCard active={category === "diver"} onClick={() => onCategory("diver")} icon={<Anchor className="size-5" />} label={isTr ? "Sualtı dalgıç" : "Underwater diver"} />
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50 mb-2">
          {isTr ? "Sorun nedir?" : "What's the problem?"}
        </p>
        <div className="grid grid-cols-1 gap-2">
          {problems.map((p) => {
            const active = problem === p;
            return (
              <button
                key={p}
                onClick={() => onProblem(p)}
                className={
                  "w-full h-14 rounded-2xl px-4 text-left border transition-all inline-flex items-center justify-between " +
                  (active
                    ? "bg-white text-slate-900 border-white shadow-[0_8px_24px_-12px_rgba(255,255,255,0.4)]"
                    : "bg-white/[0.03] text-white/85 border-white/10 hover:bg-white/[0.06]")
                }
              >
                <span className="text-sm font-semibold truncate">
                  {t(`problems.${p}`, { defaultValue: p })}
                </span>
                {active && <Check className="size-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "h-16 rounded-2xl px-4 border transition-all inline-flex items-center gap-3 " +
        (active
          ? "bg-white text-slate-900 border-white"
          : "bg-white/[0.03] text-white border-white/10 hover:bg-white/[0.06]")
      }
    >
      <span className={"size-9 rounded-xl grid place-items-center " + (active ? "bg-slate-900/10" : "bg-white/10")}>{icon}</span>
      <span className="text-sm font-semibold truncate">{label}</span>
    </button>
  );
}

function StepLocation({
  coords, locating, err, marina, onMarina, stateLabel, stateTone, onRetry, isTr,
}: {
  coords: GeoFix | null; locating: boolean; err: string | null;
  marina: string; onMarina: (m: string) => void;
  stateLabel: string; stateTone: "ok" | "warn" | "manual";
  onRetry: () => void; isTr: boolean;
}) {
  const toneCls =
    stateTone === "ok"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : stateTone === "manual"
        ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
        : "border-white/10 bg-white/[0.04] text-white/80";
  return (
    <div className="space-y-5">
      <div className={"rounded-2xl border p-4 " + toneCls}>
        <div className="flex items-center gap-3">
          <span className="size-10 rounded-xl bg-white/10 grid place-items-center">
            {locating ? <Loader2 className="size-5 animate-spin" /> : <MapPin className="size-5" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{stateLabel}</p>
            {coords && (
              <p className="text-[11px] font-mono opacity-80 mt-0.5">
                {formatDm(coords.lat, coords.lng)} · {formatAccuracy(coords)}
              </p>
            )}
            {!coords && !locating && (
              <p className="text-[11px] opacity-80 mt-0.5">
                {err ?? (isTr
                  ? "Konum alınamadı. Marinayı seçip konumsuz SOS gönderebilirsiniz."
                  : "Position unavailable. Pick a marina and send SOS without a fix.")}
              </p>
            )}
          </div>
          {!locating && (
            <button onClick={onRetry} className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80 hover:opacity-100">
              {coords ? (isTr ? "Yenile" : "Redo") : (isTr ? "Tekrar" : "Retry")}
            </button>
          )}
        </div>
      </div>


      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50 mb-2">
          {isTr ? "En yakın marina / koy" : "Nearest marina / bay"}
        </p>
        <div className="grid grid-cols-1 gap-2">
          {MARINAS.map((m) => {
            const active = marina === m;
            return (
              <button
                key={m}
                onClick={() => onMarina(m)}
                className={
                  "w-full h-14 rounded-2xl px-4 text-left border transition-all inline-flex items-center justify-between " +
                  (active
                    ? "bg-white text-slate-900 border-white"
                    : "bg-white/[0.03] text-white/85 border-white/10 hover:bg-white/[0.06]")
                }
              >
                <span className="text-sm font-semibold inline-flex items-center gap-2 truncate">
                  <MapPin className="size-4 shrink-0 opacity-70" /> {m}
                </span>
                {active && <Check className="size-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepSend({
  category, problem, marina, coords, stateLabel,
  note, onNote, photo, onPickPhoto, onClearPhoto,
  briefOpen, onBriefOpen, situation, onSituation, engineState, onEngineState,
  diveTarget, onDiveTarget, safety, onSafety,
  aiBusy, aiText, onRunAi, isTr,
}: {
  category: Category; problem: string; marina: string;
  coords: { lat: number; lng: number } | null; stateLabel: string;
  note: string; onNote: (v: string) => void;
  photo: string | null; onPickPhoto: () => void; onClearPhoto: () => void;
  briefOpen: boolean; onBriefOpen: (open: boolean) => void;
  situation: Situation | null; onSituation: (value: Situation | null) => void;
  engineState: EngineState | null; onEngineState: (value: EngineState | null) => void;
  diveTarget: DiveTarget | null; onDiveTarget: (value: DiveTarget | null) => void;
  safety: SafetyFlag[]; onSafety: (flag: SafetyFlag) => void;
  aiBusy: boolean; aiText: string | null; onRunAi: () => void;
  isTr: boolean;
}) {
  const { t } = useTranslation();
  const ready = Boolean(note.trim() || photo || situation || engineState || diveTarget || safety.length);
  const role = category === "diver" ? (isTr ? "Sualtı dalgıç" : "Underwater diver") : (isTr ? "Deniz mekaniği" : "Marine mechanic");
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/90">
          {isTr ? "Çağrı kartı" : "Call card"}
        </p>
        <p className="text-lg font-semibold text-white leading-snug">{problem}</p>
        <p className="text-xs text-white/60">{role} · {marina}</p>
        <p className="text-[11px] text-white/50 inline-flex items-center gap-1.5">
          <MapPin className="size-3" /> {stateLabel}
          {coords && <span className="font-mono opacity-70">· {formatDm(coords.lat, coords.lng)}</span>}
        </p>
      </div>

      <p className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-amber-50">
        {t("sos_sheet.not_coastguard")}
      </p>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-white/60 inline-flex items-start gap-2">
        <Check className="size-3.5 text-emerald-300 mt-0.5 shrink-0" />
        {isTr
          ? "İletişim bilginiz, bir teklifi kabul edene kadar gizli kalır."
          : "Your contact stays private until you accept an offer."}
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#071422]">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">{t("sos_sheet.brief_title")}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-white/50">{t("sos_sheet.brief_sub")}</p>
            <p className={"mt-2 text-[11px] font-semibold " + (ready ? "text-cyan-200" : "text-white/40")}>
              {ready ? t("sos_sheet.brief_ready") : t("sos_sheet.brief_empty")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onBriefOpen(!briefOpen)}
            className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/80"
          >
            {briefOpen ? t("sos_sheet.close_brief") : ready ? t("sos_sheet.brief_edit") : t("sos_sheet.brief_write")}
          </button>
        </div>
        {briefOpen && (
          <div className="space-y-4 border-t border-white/10 px-4 py-4">
            <ChipRow label={t("sos_sheet.situation")}>
              {(["marina", "anchor", "underway"] as const).map((value) => (
                <Choice
                  key={value}
                  active={situation === value}
                  onClick={() => onSituation(situation === value ? null : value)}
                  label={t(`sos_sheet.sit_${value}`)}
                />
              ))}
            </ChipRow>
            {category === "mechanic" ? (
              <ChipRow label={t("sos_sheet.engine_state")}>
                {(["running", "stopped", "no_start"] as const).map((value) => (
                  <Choice
                    key={value}
                    active={engineState === value}
                    onClick={() => onEngineState(engineState === value ? null : value)}
                    label={t(`sos_sheet.eng_${value}`)}
                  />
                ))}
              </ChipRow>
            ) : (
              <ChipRow label={t("sos_sheet.dive_target")}>
                {(["rope", "anchor", "hull", "object"] as const).map((value) => (
                  <Choice
                    key={value}
                    active={diveTarget === value}
                    onClick={() => onDiveTarget(diveTarget === value ? null : value)}
                    label={t(`sos_sheet.dive_${value}`)}
                  />
                ))}
              </ChipRow>
            )}
            <ChipRow label={t("sos_sheet.safety")}>
              {(["smoke", "water", "fuel", "person"] as const).map((flag) => (
                <Choice
                  key={flag}
                  active={safety.includes(flag)}
                  danger
                  onClick={() => onSafety(flag)}
                  label={t(`sos_sheet.safe_${flag}`)}
                />
              ))}
            </ChipRow>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                {t("sos_sheet.note_label")}
              </label>
              <textarea
                value={note}
                onChange={(e) => onNote(e.target.value)}
                rows={3}
                placeholder={t("sos_sheet.note_ph")}
                className="mt-2 w-full resize-none rounded-2xl border border-white/15 bg-white/5 p-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">{t("sos_sheet.photo")}</p>
              {photo ? (
                <div className="relative mt-2 overflow-hidden rounded-2xl border border-white/10">
                  <img src={photo} alt="" className="h-36 w-full object-cover" />
                  <button
                    type="button"
                    onClick={onClearPhoto}
                    className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-white/90"
                    aria-label={t("common.remove")}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onPickPhoto}
                  className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-white/70"
                >
                  <Camera className="size-4" />
                  <span className="text-xs font-semibold">{t("sos_sheet.photo_add")}</span>
                </button>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">{t("sos_sheet.advice")}</p>
              {aiText ? (
                <div className="mt-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.06] p-3">
                  <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/85">{aiText}</p>
                  <button type="button" onClick={onRunAi} className="mt-2 text-[11px] font-semibold text-cyan-100">
                    {t("sos_sheet.advice_again")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onRunAi}
                  disabled={aiBusy}
                  className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-400/[0.06] text-xs font-semibold text-cyan-100 disabled:opacity-60"
                >
                  {aiBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkle className="size-4" />}
                  {aiBusy ? t("sos_sheet.advice_busy") : t("sos_sheet.advice_run")}
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Choice({
  active,
  danger = false,
  onClick,
  label,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  label: string;
}) {
  const on = danger
    ? "border-rose-300/70 bg-rose-500/20 text-rose-50"
    : "border-cyan-200/70 bg-white text-slate-900";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "h-9 rounded-full border px-3 text-[12px] font-semibold " +
        (active ? on : "border-white/15 bg-white/[0.03] text-white/75")
      }
    >
      {label}
    </button>
  );
}

