import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Wordmark } from "@/components/Wordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/**
 * Shell for the signed-out browsing surfaces (catalogue, service packages).
 * Read-only by design: every action that would create data routes to /auth.
 */
export function PublicBrowseShell({
  title,
  subtitle,
  active,
  next,
  children,
}: {
  title: string;
  subtitle?: string;
  active: "parts" | "services";
  /** Protected destination to return to after sign-in. Relative path only. */
  next?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const tab = (key: "parts" | "services", to: string, label: string) => (
    <Link
      to={to}
      className={
        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors " +
        (active === key
          ? "bg-sky-500/20 border-sky-400/50 text-sky-100"
          : "bg-white/[0.03] border-white/10 text-white/70 hover:bg-white/10")
      }
    >
      {label}
    </Link>
  );

  return (
    <div className="thalvo-dark min-h-dvh bg-deep text-white flex flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pt-5">
        <Link to="/"><Wordmark size="sm" className="text-white" /></Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher tone="dark" />
          <Link
            to="/auth"
            search={next ? { next } : undefined}
            className="h-9 px-4 rounded-full amber-gradient text-warning-foreground text-xs font-black inline-flex items-center"
          >
            {t("auth.sign_in")}
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-5 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-black">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {tab("parts", "/marketplace", t("public.tab_parts", { defaultValue: "Spare parts" }))}
          {tab("services", "/services", t("public.tab_services", { defaultValue: "Services" }))}
        </div>

        {children}

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/70">
          <p className="font-semibold text-white">
            {t("public.cta_title", { defaultValue: "Sign in to order or request help" })}
          </p>
          <p className="mt-1">
            {t("public.cta_body", {
              defaultValue:
                "Browsing is open to everyone. Ordering parts, booking a service and escrow protection require an account.",
            })}
          </p>
          <Link
            to="/auth"
            search={next ? { next } : undefined}
            className="mt-3 inline-flex h-11 px-5 rounded-xl amber-gradient text-warning-foreground font-bold items-center"
          >
            {t("auth.sign_up")}
          </Link>
        </div>
      </main>

      <footer className="text-center text-[11px] text-white/40 py-6">
        © THALVO · {t("brand.tagline")}
      </footer>
    </div>
  );
}
