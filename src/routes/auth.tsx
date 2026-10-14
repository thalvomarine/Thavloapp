import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/Wordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Loader2, Ship, Wrench, Anchor, Store, Eye, EyeOff, AlertCircle, ChevronRight } from "lucide-react";
import { getValidUser } from "@/lib/auth-guard";
import { sanitizeNext } from "@/lib/nav";
import {
  armEmailConfirmedNotice,
  clearEmailUnconfirmed,
  confirmationRedirect,
  isEmailNotConfirmedMessage,
  markEmailUnconfirmed,
  markSignupWelcome,
} from "@/lib/signup-welcome";
import { normalizeAppLng } from "@/i18n";
import { SeaBackdrop } from "@/components/brand/SeaBackdrop";
import { ENGINE_BRANDS } from "@/lib/marine-catalog";

type AuthIntent = "captain" | "dealer" | "provider";

function parseIntent(raw: unknown): AuthIntent | undefined {
  if (raw === "captain" || raw === "dealer" || raw === "provider") return raw;
  if (raw === "supplier") return "dealer";
  if (raw === "client") return "captain";
  return undefined;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    s: Record<string, unknown>,
  ): { next?: string; confirmed?: "1"; intent?: AuthIntent } => {
    const n = sanitizeNext(s.next);
    const confirmed = s.confirmed === "1" || s.confirmed === 1 || s.confirmed === true;
    const intent = parseIntent(s.intent);
    return {
      ...(n ? { next: n } : {}),
      ...(confirmed ? { confirmed: "1" as const } : {}),
      ...(intent ? { intent } : {}),
    };
  },
  beforeLoad: async ({ search }) => {
    if (search.confirmed === "1") armEmailConfirmedNotice();
    const user = await getValidUser();
    if (!user) return;
    const next = sanitizeNext(search.next);
    if (next) throw redirect({ href: next });
    throw redirect({ to: "/app" });
  },
  component: AuthPage,
});

const ACCOUNT_TYPES = ["Private Owner", "Commercial Captain", "Sea Enthusiast"];

/**
 * Supabase/GoTrue returns terse, English-only error strings (e.g. the exact
 * literal "Invalid login credentials" for both a wrong password AND a
 * not-yet-registered email — it deliberately doesn't distinguish the two to
 * avoid leaking which emails exist). Map that specific, very common case to
 * a translated message that also points captains at the sign-up tab instead
 * of leaving them stuck on a cryptic one-liner.
 */
function isInvalidCredentialsError(message: string): boolean {
  return message.toLowerCase().includes("invalid login credentials");
}

function AuthPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { next, confirmed, intent } = Route.useSearch();
  const goNext = () => (next ? navigate({ href: next }) : navigate({ to: "/app" }));
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [role, setRole] = useState<"Client" | "Provider" | "Supplier">(() => {
    if (intent === "dealer") return "Supplier";
    if (intent === "provider") return "Provider";
    return "Client";
  });
  const [roleReady, setRoleReady] = useState(() => Boolean(intent));
  const [serviceType, setServiceType] = useState<"Marine Mechanic" | "Underwater Diver">(
    "Marine Mechanic",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [boatName, setBoatName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountType, setAccountType] = useState(ACCOUNT_TYPES[0]);
  const [certUrl, setCertUrl] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [homeMarina, setHomeMarina] = useState("Göcek");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (confirmed !== "1") return;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
      clearEmailUnconfirmed();
      armEmailConfirmedNotice();
      goNext();
    });
    return () => sub.subscription.unsubscribe();
  }, [confirmed]);

  const toggleBrand = (b: string) =>
    setBrands((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: confirmationRedirect(),
            data: {
              full_name: fullName,
              boat_name: role === "Client" ? boatName : null,
              role,
              business_name: role === "Supplier" ? businessName || fullName : null,
              home_marina: role === "Supplier" ? homeMarina : null,
              phone: phone.trim() || null,
              account_type: role === "Client" ? accountType : null,
              preferred_language: normalizeAppLng(i18n.resolvedLanguage) === "en" ? "en" : "tr",
            },
          },
        });
        if (error) throw error;

        // Never park the captain on an "awaiting email confirmation" screen.
        // Prefer the session from signUp; otherwise open the cockpit with password.
        if (!data.session) {
          const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
          if (siErr && isEmailNotConfirmedMessage(siErr.message)) {
            markEmailUnconfirmed();
            toast.warning(t("auth.email_unconfirmed_banner"), { duration: 8000 });
            navigate({ to: "/chart" });
            return;
          }
          if (siErr) throw siErr;
        }
        clearEmailUnconfirmed();

        const userId = data.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
        if (role === "Provider" && userId) {
          // No coordinates at signup: a provider position is only ever written
          // from a real device GPS fix (see src/lib/geolocation.ts).
          await supabase.from("provider_details").upsert({
            id: userId,
            service_type: serviceType,
            specialized_brands: serviceType === "Marine Mechanic" ? brands : [],
            certification_url: serviceType === "Underwater Diver" ? certUrl : null,
            lat: null,
            lng: null,
          });
        }
        if (role === "Supplier" && userId) {
          // Marina is a label only — never derive or fabricate coordinates from it.
          await supabase
            .from("profiles")
            .update({
              business_name: businessName || fullName,
              home_marina: homeMarina,
            })
            .eq("id", userId);
        }

        markSignupWelcome();
        if (role === "Provider" || role === "Supplier") {
          toast.message(t("auth.verification_pending_title"), {
            description: t("auth.verification_pending_body"),
            duration: 10000,
          });
        } else {
          toast.success(t("auth.signup_welcome_toast"), { duration: 7000 });
        }
        goNext();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        goNext();
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      if (isEmailNotConfirmedMessage(message)) {
        markEmailUnconfirmed();
        toast.warning(t("auth.email_unconfirmed_banner"), { duration: 8000 });
        navigate({ to: "/chart" });
        return;
      }
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
    setErr(null);
    if (nextMode === "signin") setRoleReady(true);
    if (nextMode === "signup" && !intent) setRoleReady(false);
  };

  const roleLabel =
    role === "Client"
      ? t("auth.role_client")
      : role === "Provider"
        ? t("auth.role_provider")
        : t("auth.role_supplier");

  return (
    <div className="thalvo-premium thalvo-dark relative flex min-h-dvh flex-col overflow-hidden">
      <SeaBackdrop subtle />

      <header className="relative z-50 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <a href="/" className="thalvo-brand-mark" aria-label="THALVO">
          <Wordmark size="sm" decorative />
        </a>
        <LanguageSwitcher tone="dark" />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-8 px-5 py-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:py-12">
        {/* Brand plane — hero signal, not a dashboard strip */}
        <section className="auth-rise text-center lg:text-left">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-[color:var(--pm-gold)]">
            {t("auth.brand_kicker", { defaultValue: "MarineOS" })}
          </p>
          <h1 className="thalvo-display mt-3 text-[3.25rem] leading-none tracking-[0.18em] text-white sm:text-6xl lg:text-[4.5rem]">
            THALVO
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/65 lg:mx-0">
            {t("auth.subtitle")}
          </p>
          <p className="mt-5 hidden text-[11px] font-semibold tracking-[0.22em] text-[color:var(--pm-gold)] lg:block">
            {t("auth.coverage_ports", { defaultValue: "Ege · Akdeniz" })}
          </p>
        </section>

        <section className="auth-rise auth-desk w-full max-w-md justify-self-center overflow-hidden rounded-[28px] text-white lg:justify-self-end" style={{ animationDelay: "80ms" }}>
          <div className="space-y-5 p-5 sm:p-6">
            <div className="auth-mode" role="tablist" aria-label={t("auth.welcome")}>
              <button
                type="button"
                role="tab"
                aria-pressed={mode === "signin"}
                onClick={() => switchMode("signin")}
              >
                {t("auth.sign_in")}
              </button>
              <button
                type="button"
                role="tab"
                aria-pressed={mode === "signup"}
                onClick={() => switchMode("signup")}
              >
                {t("auth.sign_up")}
              </button>
            </div>

            {mode === "signup" && !roleReady ? (
              <div className="space-y-3">
                <div>
                  <p className="thalvo-display text-[1.65rem] leading-none tracking-wide">
                    {t("auth.pick_role")}
                  </p>
                  <p className="mt-2 text-[13px] leading-snug text-white/50">
                    {t("auth.pick_role_hint", {
                      defaultValue: "Choose your desk. You can change this later.",
                    })}
                  </p>
                </div>
                <div className="space-y-2.5">
                  <RoleDoor
                    title={t("auth.role_client")}
                    line={t("auth.role_client_line")}
                    icon={<Ship className="size-4" />}
                    onPick={() => {
                      setRole("Client");
                      setRoleReady(true);
                    }}
                  />
                  <RoleDoor
                    title={t("auth.role_provider")}
                    line={t("auth.role_provider_line")}
                    icon={<Wrench className="size-4" />}
                    onPick={() => {
                      setRole("Provider");
                      setRoleReady(true);
                    }}
                  />
                  <RoleDoor
                    title={t("auth.role_supplier")}
                    line={t("auth.role_supplier_line")}
                    icon={<Store className="size-4" />}
                    onPick={() => {
                      setRole("Supplier");
                      setRoleReady(true);
                    }}
                  />
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3.5">
                {mode === "signup" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setRoleReady(false)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100"
                    >
                      {roleLabel}
                      <span className="text-amber-100/50">·</span>
                      {t("auth.change_role")}
                    </button>

                    {role !== "Supplier" && (
                      <Field label={t("auth.full_name")} value={fullName} onChange={setFullName} required />
                    )}

                    {role === "Client" && (
                      <>
                        <Field label={t("auth.boat_name")} value={boatName} onChange={setBoatName} required />
                        <div>
                          <label className="auth-label">{t("auth.account_type")}</label>
                          <select
                            value={accountType}
                            onChange={(e) => setAccountType(e.target.value)}
                            className="auth-field"
                          >
                            {ACCOUNT_TYPES.map((a) => (
                              <option key={a} value={a}>
                                {t(`auth.account_${a.replace(/\s/g, "_").toLowerCase()}`, a)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {role === "Provider" && (
                      <>
                        <div>
                          <label className="auth-label">{t("auth.service_type")}</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setServiceType("Marine Mechanic")}
                              className={
                                "inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] " +
                                (serviceType === "Marine Mechanic"
                                  ? "border-[color:var(--pm-gold)] bg-[color:var(--pm-gold)]/20 text-[color:var(--pm-text)]"
                                  : "border-white/10 bg-white/[0.03] text-white/65")
                              }
                            >
                              <Wrench className="size-3.5" /> {t("auth.sm_mechanic")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setServiceType("Underwater Diver")}
                              className={
                                "inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] " +
                                (serviceType === "Underwater Diver"
                                  ? "border-[color:var(--pm-gold)] bg-[color:var(--pm-gold)]/20 text-[color:var(--pm-text)]"
                                  : "border-white/10 bg-white/[0.03] text-white/65")
                              }
                            >
                              <Anchor className="size-3.5" /> {t("auth.sm_diver")}
                            </button>
                          </div>
                        </div>
                        {serviceType === "Marine Mechanic" ? (
                          <div>
                            <label className="auth-label">{t("auth.specialties")}</label>
                            <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                              {ENGINE_BRANDS.map((b) => (
                                <button
                                  type="button"
                                  key={b}
                                  onClick={() => toggleBrand(b)}
                                  className={
                                    "rounded-full border px-2.5 py-1 text-xs " +
                                    (brands.includes(b)
                                      ? "border-[color:var(--pm-gold)] bg-[color:var(--pm-gold)]/20 text-[color:var(--pm-text)]"
                                      : "border-white/10 text-white/60")
                                  }
                                >
                                  {b}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <Field
                            label={t("auth.cert_url")}
                            value={certUrl}
                            onChange={setCertUrl}
                            placeholder="https://…"
                          />
                        )}
                      </>
                    )}

                    {role === "Supplier" && (
                      <>
                        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[12px] leading-snug text-white/70">
                          {t("auth.supplier_kicker")}
                        </p>
                        <Field
                          label={t("auth.contact_name")}
                          value={fullName}
                          onChange={setFullName}
                          required
                          autoComplete="name"
                        />
                        <Field
                          label={t("auth.business_name")}
                          value={businessName}
                          onChange={setBusinessName}
                          required
                          autoComplete="organization"
                          placeholder={t("auth.business_placeholder")}
                        />
                        <div>
                          <label className="auth-label">{t("auth.home_marina")}</label>
                          <select
                            value={homeMarina}
                            onChange={(e) => setHomeMarina(e.target.value)}
                            className="auth-field"
                          >
                            {[
                              "Didim",
                              "Bodrum",
                              "Datça",
                              "Marmaris",
                              "Göcek",
                              "Fethiye",
                              "Kaş",
                              "Finike",
                              "Kemer",
                              "Antalya",
                            ].map((m) => (
                              <option key={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    <Field
                      label={
                        role === "Supplier"
                          ? t("auth.phone")
                          : `${t("auth.phone")} (${t("common.optional")})`
                      }
                      value={phone}
                      onChange={setPhone}
                      type="tel"
                      autoComplete="tel"
                      required={role === "Supplier"}
                      placeholder="+90…"
                    />
                    <p className="-mt-1 text-[11px] leading-snug text-white/40">
                      {t("auth.phone_private_notice")}
                    </p>
                  </>
                )}

                <Field
                  label={t("auth.email")}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                  autoComplete="email"
                />
                <Field
                  label={t("auth.password")}
                  type="password"
                  value={password}
                  onChange={setPassword}
                  required
                  minLength={mode === "signup" ? 10 : undefined}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                {mode === "signup" && (
                  <p className="-mt-1 text-[11px] text-white/40">{t("auth.password_hint")}</p>
                )}

                {err && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-xs leading-relaxed">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="min-w-0 space-y-1.5">
                        <p className="font-bold text-destructive">
                          {isInvalidCredentialsError(err)
                            ? t("auth.error_invalid_credentials_title")
                            : t("auth.error_generic_title")}
                        </p>
                        <p className="text-foreground/80">
                          {isInvalidCredentialsError(err)
                            ? t("auth.error_invalid_credentials_body")
                            : err}
                        </p>
                        {isInvalidCredentialsError(err) && mode === "signin" && (
                          <button
                            type="button"
                            onClick={() => switchMode("signup")}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--pm-gold)] underline underline-offset-2"
                          >
                            {t("auth.sign_up")} →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="pm-gold-cta mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold tracking-wide disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {mode === "signup" ? t("auth.submit_signup") : t("auth.submit_signin")}
                </button>
              </form>
            )}
          </div>
        </section>

        <p
          className="auth-rise mx-auto inline-flex items-center justify-center rounded-xl border border-[color:var(--pm-gold)]/35 bg-black/25 px-4 py-2 text-center text-[11px] font-semibold tracking-[0.22em] text-[color:var(--pm-gold)] lg:hidden"
          style={{ animationDelay: "120ms" }}
        >
          {t("auth.coverage_ports", { defaultValue: "Ege · Akdeniz" })}
        </p>
      </main>
    </div>
  );
}

function RoleDoor({
  title,
  line,
  icon,
  onPick,
}: {
  title: string;
  line: string;
  icon: ReactNode;
  onPick: () => void;
}) {
  return (
    <button type="button" onClick={onPick} className="auth-role">
      <span className="auth-role-icon" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="thalvo-display block text-[1.35rem] leading-none tracking-wide text-white">
          {title}
        </span>
        <span className="mt-1.5 block text-[12.5px] leading-snug text-white/55">{line}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-white/35" aria-hidden />
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  minLength,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  autoComplete?: string;
}) {
  const { t } = useTranslation();
  const isPassword = type === "password";
  const [reveal, setReveal] = useState(false);

  return (
    <div>
      <label className="auth-label">{label}</label>
      <div className="relative">
        <input
          type={isPassword ? (reveal ? "text" : "password") : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={"auth-field " + (isPassword ? "pr-12" : "")}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            tabIndex={-1}
            aria-label={reveal ? t("auth.hide_password") : t("auth.show_password")}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-white/45 hover:text-white/80"
          >
            {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
