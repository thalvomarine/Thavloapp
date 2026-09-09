import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import {
  Anchor, Bell, Camera, Check, ChevronLeft, ChevronRight, Compass,
  Globe2, MapPin, Ship, Sparkles, Store, Wrench, X,
} from "lucide-react";
import i18n from "@/i18n";
import type { Profile } from "@/lib/session";
import {
  RescueMark, PassportMark, MarketplaceMark, ControlTowerMark,
} from "@/components/brand/ProductMarks";

interface Props {
  profile: Profile;
  isAdmin: boolean;
  onComplete: () => void;
}

type RoleKey = "captain" | "mechanic" | "diver" | "dealer" | "admin";

/**
 * OnboardingOverlay — full-screen MarineOS first-run experience.
 *
 * Six steps: Welcome → Role → Language → Permissions → Captain path → Mission Control tour.
 * Never mutates payments/escrow/mission/marketplace state. Persists language via i18n
 * (already backed by localStorage) and remembers role selection in localStorage only.
 *
 * Callable via useFirstRun().restart() so users can replay the tour anytime.
 */
export function OnboardingOverlay({ profile, isAdmin, onComplete }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const defaultRole: RoleKey = useMemo(() => {
    if (profile.role === "Supplier") return "dealer";
    if (profile.role === "Provider") return "mechanic";
    return "captain";
  }, [profile.role]);
  const [role, setRole] = useState<RoleKey>(defaultRole);
  const [lang, setLang] = useState<"tr" | "en">((i18n.language?.startsWith("en") ? "en" : "tr"));
  const [permHint, setPermHint] = useState<string | null>(null);

  useEffect(() => {
    // Lock background scroll while onboarding is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const finish = () => {
    try {
      window.localStorage.setItem("thalvo_onboarding_role", role);
    } catch { /* noop */ }
    onComplete();
  };

  const steps = ["welcome", "role", "language", "permissions", "captain", "tour"] as const;
  // Non-captains skip the captain-only step.
  const activeSteps = steps.filter((s) => s !== "captain" || role === "captain");
  const currentKey = activeSteps[step];
  const total = activeSteps.length;

  const next = () => setStep((s) => Math.min(s + 1, total - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const changeLang = (l: "tr" | "en") => {
    setLang(l);
    void i18n.changeLanguage(l);
    try { window.localStorage.setItem("thalvo-lang", l); } catch { /* noop */ }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="thalvo-onboarding-title"
      className="fixed inset-0 z-[100] thalvo-dark thalvo-cockpit text-white overflow-y-auto"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 0px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ background: "radial-gradient(60% 40% at 50% 20%, rgba(0,180,216,0.18), transparent 70%)" }}
      />

      {/* Top bar: skip + progress */}
      <div className="relative flex items-center justify-between px-5 pt-5">
        <button
          onClick={back}
          disabled={step === 0}
          aria-label="Back"
          className="inline-flex items-center gap-1 text-xs font-semibold text-white/60 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="size-4" /> Back
        </button>
        <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${total}`}>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={
                "h-1 rounded-full transition-all " +
                (i === step ? "w-8 bg-sky-400" : i < step ? "w-4 bg-white/60" : "w-4 bg-white/15")
              }
            />
          ))}
        </div>
        <button
          onClick={finish}
          aria-label="Skip onboarding"
          className="inline-flex items-center gap-1 text-xs font-semibold text-white/60 hover:text-white"
        >
          Skip <X className="size-4" />
        </button>
      </div>

      <div className="relative mx-auto max-w-2xl px-5 pb-24 pt-6 sm:pt-10">
        {currentKey === "welcome" && (
          <StepShell
            eyebrow="THALVO"
            title="Welcome to THALVO"
            id="thalvo-onboarding-title"
            subtitle="The Marine Operating System for captains, marine professionals and trusted suppliers."
          >
            <ul className="mt-6 space-y-3 text-sm text-white/80">
              <Bullet icon={<RescueMark size={18} />}>Report emergencies with a single tap.</Bullet>
              <Bullet icon={<Compass className="size-4 text-sky-300" />}>Compare certified professionals in seconds.</Bullet>
              <Bullet icon={<PassportMark size={18} />}>Manage your vessel — parts, history, documents.</Bullet>
              <Bullet icon={<Sparkles className="size-4 text-amber-300" />}>Every payment stays protected by THALVO Escrow.</Bullet>
            </ul>
            <PrimaryCta onClick={next}>Get Started</PrimaryCta>
            <SecondaryCta onClick={finish}>Skip for now</SecondaryCta>
          </StepShell>
        )}

        {currentKey === "role" && (
          <StepShell eyebrow="Step 1" title="Who are you?" subtitle="Pick your primary role. You can change this later.">
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RoleCard active={role === "captain"} onClick={() => setRole("captain")}
                icon={<Ship className="size-5" />} label="Captain" hint="Own or skipper a vessel" />
              <RoleCard active={role === "mechanic"} onClick={() => setRole("mechanic")}
                icon={<Wrench className="size-5" />} label="Mechanic" hint="Certified marine mechanic" />
              <RoleCard active={role === "diver"} onClick={() => setRole("diver")}
                icon={<Anchor className="size-5" />} label="Diver" hint="Professional underwater diver" />
              <RoleCard active={role === "dealer"} onClick={() => setRole("dealer")}
                icon={<Store className="size-5" />} label="Dealer" hint="Parts & supply partner" />
              {isAdmin && (
                <RoleCard active={role === "admin"} onClick={() => setRole("admin")}
                  icon={<ControlTowerMark size={20} />} label="Administrator" hint="THALVO Control Tower" />
              )}
            </div>
            <PrimaryCta onClick={next}>Continue</PrimaryCta>
          </StepShell>
        )}

        {currentKey === "language" && (
          <StepShell eyebrow="Step 2" title="Choose your language" subtitle="Used across menus, alerts and mission briefings.">
            <div className="mt-6 grid grid-cols-2 gap-3">
              <LangCard active={lang === "tr"} onClick={() => changeLang("tr")} label="Türkçe" hint="Aegean & Mediterranean fleet" />
              <LangCard active={lang === "en"} onClick={() => changeLang("en")} label="English" hint="International crews" />
            </div>
            <p className="mt-4 flex items-center gap-2 text-[11px] text-white/50">
              <Globe2 className="size-3.5" /> Preference is saved to this device automatically.
            </p>
            <PrimaryCta onClick={next}>Continue</PrimaryCta>
          </StepShell>
        )}

        {currentKey === "permissions" && (
          <StepShell eyebrow="Step 3" title="A few permissions" subtitle="THALVO only asks for what an emergency needs. Nothing is forced.">
            <div className="mt-6 space-y-3">
              <PermCard
                icon={<MapPin className="size-4" />}
                label="Location"
                body="Used to find nearby certified professionals."
                onEnable={async () => {
                  if (!("geolocation" in navigator)) return setPermHint("Location isn't available on this device — you can still search by marina.");
                  navigator.geolocation.getCurrentPosition(
                    () => setPermHint("Location enabled. THALVO can now match closer responders."),
                    () => setPermHint("Location denied — you can still request help by marina, response may be slower."),
                    { timeout: 8000 },
                  );
                }}
              />
              <PermCard
                icon={<Bell className="size-4" />}
                label="Notifications"
                body="Receive offers and mission status updates."
                onEnable={async () => {
                  if (typeof Notification === "undefined") return setPermHint("Notifications aren't supported here — the in-app inbox still works.");
                  try {
                    const res = await Notification.requestPermission();
                    setPermHint(res === "granted"
                      ? "Notifications enabled. You'll hear from THALVO the moment an offer arrives."
                      : "Notifications off — offers will still surface inside the app.");
                  } catch { setPermHint("Notifications unavailable — the in-app feed still works."); }
                }}
              />
              <PermCard
                icon={<Camera className="size-4" />}
                label="Camera"
                body="Attach photos to SOS reports so responders arrive prepared."
                onEnable={async () => {
                  try {
                    // Some browsers require getUserMedia to trigger the prompt.
                    const stream = await navigator.mediaDevices?.getUserMedia({ video: true });
                    stream?.getTracks().forEach((tr) => tr.stop());
                    setPermHint("Camera ready — you can attach live photos to SOS reports.");
                  } catch {
                    setPermHint("Camera denied — you can still describe the issue in text.");
                  }
                }}
              />
              {permHint && (
                <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70">{permHint}</p>
              )}
            </div>
            <PrimaryCta onClick={next}>Continue</PrimaryCta>
            <SecondaryCta onClick={next}>Not now</SecondaryCta>
          </StepShell>
        )}

        {currentKey === "captain" && (
          <StepShell eyebrow="Step 4" title="Do you already have a vessel?" subtitle="Add it now to unlock Boat Passport — or skip and add it later.">
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => { finish(); navigate({ to: "/app/profile" }); }}
                className="rounded-2xl border border-sky-400/40 bg-sky-500/10 p-5 text-left hover:bg-sky-500/15 transition-colors"
              >
                <Ship className="size-5 text-sky-300" />
                <p className="mt-3 text-sm font-semibold">Yes — set up my vessel</p>
                <p className="mt-1 text-xs text-white/60">Guides you to Boat Passport setup.</p>
              </button>
              <button
                onClick={next}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left hover:bg-white/[0.08] transition-colors"
              >
                <PassportMark size={20} />
                <p className="mt-3 text-sm font-semibold">Not yet — skip</p>
                <p className="mt-1 text-xs text-white/60">Add a vessel later from Profile.</p>
              </button>
            </div>
          </StepShell>
        )}

        {currentKey === "tour" && (
          <StepShell eyebrow="Step 5" title="Meet Mission Control" subtitle="Everything you need lives one tap away.">
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TourItem icon={<MapPin className="size-4 text-sky-300" />} title="Map" body="See responders live around you." />
              <TourItem icon={<RescueMark size={18} />} title="SOS" body="One tap dispatches the nearest help." />
              <TourItem icon={<Compass className="size-4 text-amber-300" />} title="Compass" body="Your THALVO AI copilot, anywhere." />
              <TourItem icon={<MarketplaceMark size={18} />} title="Marketplace" body="Certified parts & escrow-secured orders." />
              <TourItem icon={<PassportMark size={18} />} title="Passport" body="Your vessel's dossier and history." />
            </ul>
            <PrimaryCta onClick={finish}>
              <Check className="size-4" /> Enter Mission Control
            </PrimaryCta>
            <p className="mt-3 text-center text-[11px] text-white/40">
              You can replay this tour anytime from Profile.
            </p>
          </StepShell>
        )}
      </div>
    </div>
  );
}

/* ─── primitives ─────────────────────────────────────────────── */

function StepShell({
  eyebrow, title, subtitle, id, children,
}: { eyebrow: string; title: string; subtitle?: string; id?: string; children: ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-300/80">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-white">{title}</h2>
      {subtitle && <p className="mt-3 text-sm sm:text-base text-white/70 max-w-lg">{subtitle}</p>}
      {children}
    </div>
  );
}

function Bullet({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <span className="mt-0.5 grid place-items-center size-7 rounded-lg bg-white/5">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

function RoleCard({ active, onClick, icon, label, hint }: {
  active: boolean; onClick: () => void; icon: ReactNode; label: string; hint: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={
        "text-left rounded-2xl border p-4 min-h-[96px] transition-all " +
        (active
          ? "border-sky-400/60 bg-sky-500/15 shadow-[0_10px_40px_-10px_rgba(56,189,248,0.45)]"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]")
      }
    >
      <div className="flex items-center gap-2">
        <span className={"grid place-items-center size-9 rounded-xl " + (active ? "bg-sky-500/30 text-sky-100" : "bg-white/5 text-white/80")}>
          {icon}
        </span>
        <span className="text-sm font-bold">{label}</span>
        {active && <Check className="ml-auto size-4 text-sky-300" />}
      </div>
      <p className="mt-2 text-[12px] text-white/60">{hint}</p>
    </button>
  );
}

function LangCard({ active, onClick, label, hint }: {
  active: boolean; onClick: () => void; label: string; hint: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={
        "text-left rounded-2xl border p-5 min-h-[96px] transition-all " +
        (active
          ? "border-sky-400/60 bg-sky-500/15"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]")
      }
    >
      <p className="text-lg font-bold">{label}</p>
      <p className="mt-1 text-xs text-white/60">{hint}</p>
      {active && <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300"><Check className="size-3" /> Selected</span>}
    </button>
  );
}

function PermCard({ icon, label, body, onEnable }: {
  icon: ReactNode; label: string; body: string; onEnable: () => void | Promise<void>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <span className="grid place-items-center size-10 rounded-xl bg-white/5 text-sky-300 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[12px] text-white/60">{body}</p>
      </div>
      <button
        onClick={() => void onEnable()}
        className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85 hover:bg-white/10"
      >
        Enable
      </button>
    </div>
  );
}

function TourItem({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <span className="grid place-items-center size-9 rounded-xl bg-white/5">{icon}</span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-white/60">{body}</p>
      </div>
    </li>
  );
}

function PrimaryCta({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-8 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full amber-gradient text-warning-foreground font-black uppercase tracking-[0.18em] px-8 h-12 min-w-[220px] shadow-[0_18px_50px_-12px_rgba(255,176,32,0.55)]"
    >
      {children}
      <ChevronRight className="size-4" />
    </button>
  );
}

function SecondaryCta({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <div className="mt-3">
      <button
        onClick={onClick}
        className="text-xs font-semibold text-white/55 hover:text-white/85 underline underline-offset-4 decoration-white/20"
      >
        {children}
      </button>
    </div>
  );
}
