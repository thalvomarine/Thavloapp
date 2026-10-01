import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/Wordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Loader2, Ship, Wrench, Anchor, Store, Eye, EyeOff, AlertCircle } from "lucide-react";
import { getValidUser } from "@/lib/auth-guard";
import { sanitizeNext } from "@/lib/nav";
import { markSignupWelcome } from "@/lib/signup-welcome";
import { normalizeAppLng } from "@/i18n";
import { SeaBackdrop } from "@/components/brand/SeaBackdrop";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const n = sanitizeNext(s.next);
    return n ? { next: n } : {};
  },
  beforeLoad: async ({ search }) => {
    const user = await getValidUser();
    if (!user) return;
    const next = sanitizeNext(search.next);
    if (next) throw redirect({ href: next });
    throw redirect({ to: "/app" });
  },
  component: AuthPage,
});

const ENGINE_BRANDS = ["Yamaha", "Volvo Penta", "Yanmar", "Mercury", "Suzuki"];
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
  const { next } = Route.useSearch();
  const goNext = () => (next ? navigate({ href: next }) : navigate({ to: "/app" }));
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [role, setRole] = useState<"Client" | "Provider" | "Supplier">("Client");
  const [roleReady, setRoleReady] = useState(false);
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
            data: {
              full_name: fullName,
              boat_name: role === "Client" ? boatName : null,
              role,
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
          if (siErr) throw siErr;
        }

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
        toast.success(t("auth.signup_welcome_toast"), { duration: 7000 });
        goNext();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        goNext();
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="thalvo-premium thalvo-dark relative min-h-dvh flex flex-col overflow-hidden">
      <SeaBackdrop subtle />
      {/* iOS Dynamic Island / status bar clearance — the logo and language
          switcher are the only interactive chrome above the fold, so they
          (not the sea backdrop behind them) need the safe-area inset. */}
      <header className="relative z-50 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <a href="/" className="opacity-90">
          <Wordmark size="sm" />
        </a>
        <LanguageSwitcher tone="dark" />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <p className="thalvo-display text-4xl tracking-[0.18em] text-white">THALVO</p>
            <p className="mt-2 text-sm text-white/60">{t("auth.welcome")}</p>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#071422]/90 text-white shadow-2xl backdrop-blur-xl">
            {mode === "signup" && !roleReady ? (
              <div className="space-y-2 p-4">
                <p className="thalvo-display px-1 text-2xl">{t("auth.pick_role")}</p>
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
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="w-full pt-2 text-xs text-white/50 hover:text-white"
                >
                  {t("auth.have_account")}
                </button>
              </div>
            ) : (
            <form onSubmit={submit} className="space-y-3 p-5">
              {mode === "signup" && (
                <>
                  <button
                    type="button"
                    onClick={() => setRoleReady(false)}
                    className="text-left text-[12px] text-cyan-100/80"
                  >
                    {role === "Client"
                      ? t("auth.role_client")
                      : role === "Provider"
                        ? t("auth.role_provider")
                        : t("auth.role_supplier")}
                    {" · "}
                    {t("auth.change_role")}
                  </button>

                  <Field
                    label={t("auth.full_name")}
                    value={fullName}
                    onChange={setFullName}
                    required
                  />

                  {role === "Client" && (
                    <>
                      <Field
                        label={t("auth.boat_name")}
                        value={boatName}
                        onChange={setBoatName}
                        required
                      />
                      <div>
                        <label className="text-xs font-bold text-muted-foreground">
                          {t("auth.account_type")}
                        </label>
                        <select
                          value={accountType}
                          onChange={(e) => setAccountType(e.target.value)}
                          className="mt-1 w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
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
                        <label className="text-xs font-bold text-muted-foreground">
                          {t("auth.service_type")}
                        </label>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setServiceType("Marine Mechanic")}
                            className={
                              "rounded-xl border p-2.5 text-xs font-semibold inline-flex items-center gap-1.5 " +
                              (serviceType === "Marine Mechanic"
                                ? "border-[color:var(--pm-gold)] bg-[color:var(--pm-gold)]/20 text-[color:var(--pm-text)]"
                                : "border-border")
                            }
                          >
                            <Wrench className="size-3.5" /> {t("auth.sm_mechanic")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setServiceType("Underwater Diver")}
                            className={
                              "rounded-xl border p-2.5 text-xs font-semibold inline-flex items-center gap-1.5 " +
                              (serviceType === "Underwater Diver"
                                ? "border-[color:var(--pm-gold)] bg-[color:var(--pm-gold)]/20 text-[color:var(--pm-text)]"
                                : "border-border")
                            }
                          >
                            <Anchor className="size-3.5" /> {t("auth.sm_diver")}
                          </button>
                        </div>
                      </div>
                      {serviceType === "Marine Mechanic" ? (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground">
                            {t("auth.specialties")}
                          </label>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {ENGINE_BRANDS.map((b) => (
                              <button
                                type="button"
                                key={b}
                                onClick={() => toggleBrand(b)}
                                className={
                                  "px-2.5 py-1 text-xs rounded-full border " +
                                  (brands.includes(b)
                                    ? "bg-[color:var(--pm-gold)]/20 text-[color:var(--pm-text)] border-[color:var(--pm-gold)]"
                                    : "border-border")
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
                      <Field
                        label={t("auth.business_name")}
                        value={businessName}
                        onChange={setBusinessName}
                        required
                        placeholder="Aegean Marine Parts Ltd."
                      />
                      <div>
                        <label className="text-xs font-bold text-muted-foreground">
                          {t("auth.home_marina")}
                        </label>
                        <select
                          value={homeMarina}
                          onChange={(e) => setHomeMarina(e.target.value)}
                          className="mt-1 w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                        >
                          {["Göcek", "Bodrum", "Marmaris", "Fethiye", "Kaş"].map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <Field
                    label={`${t("auth.phone")} (${t("common.optional")})`}
                    value={phone}
                    onChange={setPhone}
                    type="tel"
                    autoComplete="tel"
                    placeholder="+90…"
                  />
                  <p className="text-[10px] text-muted-foreground -mt-1">
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
                <p className="text-[10px] text-muted-foreground -mt-1">{t("auth.password_hint")}</p>
              )}

              {err && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-xs leading-relaxed">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
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
                          onClick={() => {
                            setMode("signup");
                            setErr(null);
                          }}
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
                className="pm-gold-cta w-full h-12 rounded-xl font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "signup" ? t("auth.submit_signup") : t("auth.submit_signin")}
              </button>

              <button
                type="button"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                {mode === "signup" ? t("auth.have_account") : t("auth.no_account")}
              </button>
            </form>
            )}
          </div>
        </div>
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
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left hover:border-cyan-300/40 hover:bg-white/[0.06]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-cyan-300/30 text-cyan-100">
        {icon}
      </span>
      <span>
        <span className="thalvo-display block text-[20px] leading-none text-white">{title}</span>
        <span className="mt-1 block text-[12px] text-white/55">{line}</span>
      </span>
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
      <label className="text-xs font-bold text-muted-foreground">{label}</label>
      <div className="relative mt-1">
        <input
          type={isPassword ? (reveal ? "text" : "password") : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={
            "w-full h-11 rounded-xl border border-input bg-background px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring " +
            (isPassword ? "pr-11" : "")
          }
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            tabIndex={-1}
            aria-label={reveal ? t("auth.hide_password") : t("auth.show_password")}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
