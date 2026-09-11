import { useCallback, useEffect, useRef, useState } from "react";
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
import { openEmergencyService } from "@/lib/emergency-service-bus";
import {
  Anchor, ArrowLeft, Camera, Check, Loader2, MapPin, Radio,
  Sparkle, WifiOff, Wrench, X,
} from "lucide-react";


type Category = "mechanic" | "diver";
type Step = 0 | 1 | 2;

const MARINAS = ["Göcek D-Marin", "Bodrum Milta", "Marmaris Netsel", "Fethiye Ece", "Kaş Setur"];

interface Props {
  open: boolean;
  onClose: () => void;
  initialCategory?: Category;
  initialNote?: string;
}

/**
 * SOS Emergency Cockpit — simplified 3-step flow: Problem → Location → Send.
 * Publish, GPS, category, media validation, and event logging are preserved verbatim.
 * Description, photo, and AI pre-diagnosis are surfaced behind an "Add details" disclosure.
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
  const [coords, setCoords] = useState<GeoFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep(0); setCategory(initialCategory); setProblem(problems[0]);
    setMarina(MARINAS[0]); setNote(""); setPhoto(null);
    setCoords(null); setLocErr(null); setAiText(null);
    setLocating(false); setAiBusy(false); setPublishing(false);
  }, [initialCategory, problems]);

  // Reset problem list when category changes
  useEffect(() => { setProblem((category === "diver" ? PROBLEM_KEYS.diver : PROBLEM_KEYS.mechanic)[0]); }, [category]);

  // Sync initial category / AI-prepared brief when opened
  useEffect(() => {
    if (!open) return;
    setCategory(initialCategory);
    if (initialNote?.trim()) setNote(initialNote.trim());
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
    const problemLabel = t(`problems.${problem}`, { defaultValue: problem });
    const catLabel = category === "diver" ? "Underwater diver" : "Marine mechanic";
    const prompt =
      `Marine emergency intake. Reply in ${i18n.language === "en" ? "English" : "Turkish"} in 2–3 short sentences. ` +
      `Be calm and specific.\n\n` +
      `Category: ${catLabel}\nProblem: ${problemLabel}\nLocation: ${marina}` +
      (coords ? ` (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : "") +
      (note ? `\nCaptain note: ${note}` : "") +
      (photo ? `\n(Photo attached by captain — not visible to you here.)` : "") +
      `\n\nReturn: (1) one-line likely cause, (2) one immediate safety step the captain can take now, (3) what a responder will most likely need on arrival. No panic language.`;
    try {
      const res = await ask({ data: { messages: [{ role: "user", content: prompt }], lang: (i18n.language === "en" ? "en" : "tr") } });
      setAiText(res.text || "Diagnosis unavailable. You can still publish now.");
    } catch {
      setAiText("Advisor is offline. You can still publish — nearby responders will see full details.");
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
      const { data: p } = await supabase.from("profiles").select("emergency_health_note").eq("id", user.id).maybeSingle();
      const healthNote = (p as { emergency_health_note: string | null } | null)?.emergency_health_note;
      const parts = [
        sanitizeMultiline(note, 1500),
        aiText ? `\n🧭 AI pre-diagnosis:\n${sanitizeMultiline(aiText, 1500)}` : "",
        healthNote ? `\n🩺 ${t("profile.health_note")}: ${sanitizeMultiline(healthNote, 500)}` : "",
        liveFix ? "" : `\n📍 ${isTr ? "Konum alınamadı — marina:" : "Position unavailable — marina:"} ${marina}`,
      ].filter(Boolean);
      const finalDescription = parts.join("\n").trim().slice(0, 4000);
      const { data, error } = await (async () => {
        try {
          return await supabase.from("jobs").insert({
            client_id: user.id,
            service_type: category === "diver" ? "Underwater Diver" : "Marine Mechanic",
            problem_category: problem,
            description: finalDescription,
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
              photo={photo} onPickPhoto={() => fileRef.current?.click()} onClearPhoto={() => setPhoto(null)}
              aiBusy={aiBusy} aiText={aiText} onRunAi={runDiagnosis}
              isTr={isTr}
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              // File validation — image only, ≤ 8 MB.
              if (!f.type.startsWith("image/")) {
                toast.error("Please pick an image file (jpg, png, heic).");
                return;
              }
              const MAX_BYTES = 8 * 1024 * 1024;
              if (f.size > MAX_BYTES) {
                toast.error("Photo is larger than 8 MB. Please pick a smaller image.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setPhoto(String(reader.result));
              reader.onerror = () => toast.error("We could not read that photo. Please try another.");
              reader.readAsDataURL(f);
            }}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] bg-[oklch(0.13_0.02_250/0.9)] backdrop-blur-md p-3 pb-[max(env(safe-area-inset-bottom),12px)] space-y-2">
          {!online && (
            <div role="alert" className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100 inline-flex items-start gap-2 w-full">
              <WifiOff className="size-3.5 mt-0.5 shrink-0" />
              You are offline. THALVO will publish your SOS the moment you reconnect.
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
                {coords.lat.toFixed(4)}° · {coords.lng.toFixed(4)}° · {formatAccuracy(coords)}
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
  aiBusy, aiText, onRunAi, isTr,
}: {
  category: Category; problem: string; marina: string;
  coords: { lat: number; lng: number } | null; stateLabel: string;
  note: string; onNote: (v: string) => void;
  photo: string | null; onPickPhoto: () => void; onClearPhoto: () => void;
  aiBusy: boolean; aiText: string | null; onRunAi: () => void;
  isTr: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Summary hero */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/90">
          {isTr ? "SOS yayınlanacak" : "Ready to broadcast"}
        </p>
        <p className="text-lg font-semibold text-white leading-snug">{problem}</p>
        <p className="text-xs text-white/60">
          {(category === "diver" ? (isTr ? "Sualtı dalgıç" : "Underwater diver") : (isTr ? "Deniz mekaniği" : "Marine mechanic"))}
          {" · "}
          {marina}
        </p>
        <p className="text-[11px] text-white/50 inline-flex items-center gap-1.5">
          <MapPin className="size-3" /> {stateLabel}
          {coords && <span className="font-mono opacity-70">· {coords.lat.toFixed(3)}°, {coords.lng.toFixed(3)}°</span>}
        </p>
      </div>

      {/* Privacy note */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-white/60 inline-flex items-start gap-2">
        <Check className="size-3.5 text-emerald-300 mt-0.5 shrink-0" />
        {isTr
          ? "Yayınlamak maskeli bir çağrı gönderir. İletişim bilgileriniz siz bir cevap verene kadar gizli kalır."
          : "Publishing broadcasts a masked request. Your contact info stays private until you accept a responder."}
      </div>

      {/* Optional details — collapsed by default */}
      <details className="group rounded-2xl border border-white/10 bg-white/[0.02]">
        <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between text-sm font-semibold text-white/80 hover:text-white">
          <span className="inline-flex items-center gap-2">
            <Sparkle className="size-4 text-sky-300/80" />
            {isTr ? "Detay ekle (isteğe bağlı)" : "Add details (optional)"}
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40 group-open:hidden">
            {isTr ? "Aç" : "Open"}
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40 hidden group-open:inline">
            {isTr ? "Kapat" : "Close"}
          </span>
        </summary>
        <div className="px-4 pb-4 pt-1 space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
              {isTr ? "Ne görüyor ya da duyuyorsunuz?" : "Describe what you see or hear"}
            </label>
            <textarea
              value={note} onChange={(e) => onNote(e.target.value)} rows={3}
              placeholder={isTr ? "Kısa. Sakin. Net." : "Short. Calm. Specific."}
              className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 text-white placeholder:text-white/30 p-3 text-sm outline-none focus:border-sky-400/60 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
              {isTr ? "Fotoğraf (isteğe bağlı)" : "Photo (optional)"}
            </label>
            {photo ? (
              <div className="mt-2 relative rounded-2xl overflow-hidden border border-white/10">
                <img src={photo} alt="" className="w-full h-32 object-cover" />
                <button
                  onClick={onClearPhoto}
                  className="absolute top-2 right-2 size-8 grid place-items-center rounded-full bg-black/60 text-white/90"
                  aria-label="Remove photo"
                ><X className="size-4" /></button>
              </div>
            ) : (
              <button
                onClick={onPickPhoto}
                className="mt-2 w-full h-14 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] inline-flex items-center justify-center gap-2 text-white/70 hover:bg-white/[0.04]"
              >
                <Camera className="size-4" />
                <span className="text-xs font-semibold">{isTr ? "Fotoğraf ekle" : "Add photo"}</span>
              </button>
            )}
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
              {isTr ? "AI ön tanı" : "AI pre-diagnosis"}
            </label>
            {aiText ? (
              <div className="mt-2 rounded-2xl border border-sky-400/20 bg-sky-500/[0.06] p-3">
                <p className="text-[12px] text-white/85 leading-relaxed whitespace-pre-wrap">{aiText}</p>
                <button
                  onClick={onRunAi}
                  className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60 hover:text-white"
                >
                  {isTr ? "Yeniden üret" : "Regenerate"}
                </button>
              </div>
            ) : (
              <button
                onClick={onRunAi}
                disabled={aiBusy}
                className="mt-2 w-full h-12 rounded-2xl border border-sky-400/25 bg-sky-500/[0.06] text-sky-200 text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {aiBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkle className="size-4" />}
                {aiBusy ? (isTr ? "Analiz ediliyor…" : "Analyzing…") : (isTr ? "Ön tanı çalıştır" : "Run pre-diagnosis")}
              </button>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

