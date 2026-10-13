import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, LayoutGrid, X } from "lucide-react";
import { toast } from "sonner";
import heroUrl from "@/assets/marine-hero.jpg";
import { Wordmark } from "@/components/Wordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PublicFooter } from "@/components/public/PublicFooter";
import { OPS_CONTACT_EMAIL } from "@/lib/superadmin";
import { submitBoatshowLead, type BoatshowLeadKind } from "@/lib/boatshow-leads";

const KINDS: BoatshowLeadKind[] = ["brand", "dealer", "marina", "captain", "technician", "other"];

/**
 * Concept B — brand-first public home.
 * Full-bleed sea hero + professional partner desk. Partner ol → #partner.
 */
export function BrandLanding() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<BoatshowLeadKind>("brand");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error(t("boatshow.lead_required"));
      return;
    }
    setBusy(true);
    try {
      const result = await submitBoatshowLead({
        name: name.trim(),
        company: company.trim() || null,
        phone: phone.trim(),
        email: email.trim() || null,
        kind,
        note: note.trim() || null,
        source: "landing",
      });
      setSent(true);
      if (result.stored === "db") {
        toast.success(t("boatshow.lead_saved"));
      } else {
        toast.message(t("boatshow.lead_mailto"));
        window.location.href = result.mailto;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="thalvo-dark min-h-dvh overflow-x-hidden bg-[#06101c] text-white">
      {/* ——— HERO ——— */}
      <section className="relative flex min-h-svh flex-col">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={heroUrl}
            alt=""
            className="landing-hero-img absolute inset-0 size-full object-cover object-[center_40%]"
          />
          <div className="absolute inset-0 bg-[#06101c]/55" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#06101c]/70 via-[#0A192F]/45 to-[#06101c]" />
          <div
            className="absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,240,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.35) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
            }}
          />
        </div>

        <header className="relative z-20 flex items-center gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <Wordmark size="sm" className="text-white" decorative />
            <span className="thalvo-display text-[15px] tracking-[0.22em] text-white">THALVO</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-7 md:flex">
            <a href="#solutions" className="landing-nav-link">
              {t("landing.nav_solutions")}
            </a>
            <a href="#about" className="landing-nav-link">
              {t("landing.nav_about")}
            </a>
            <button type="button" onClick={() => setMenuOpen(true)} className="landing-nav-menu">
              {t("landing.nav_menu")}
              <LayoutGrid className="size-3.5" aria-hidden />
            </button>
          </nav>

          <div className="flex items-center gap-2 md:ml-5">
            <LanguageSwitcher tone="dark" />
            <Link
              to="/auth"
              search={{ intent: "captain" }}
              className="hidden h-9 items-center rounded-md bg-[#F5B942] px-4 text-[12px] font-bold tracking-wide text-[#1A1406] sm:inline-flex"
            >
              {t("auth.sign_in")}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex size-9 items-center justify-center rounded-md border border-white/20 text-[#F5B942] md:hidden"
              aria-label={t("landing.nav_menu")}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </header>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-20 pt-10 text-center sm:px-8">
          <div className="landing-fade-up max-w-3xl">
            <h1 className="thalvo-display text-[clamp(3.6rem,14vw,7rem)] leading-[0.88] tracking-[0.06em] text-white">
              THALVO
            </h1>
            <p className="mt-5 text-[clamp(1.05rem,2.4vw,1.4rem)] font-semibold tracking-[0.04em] text-[#00F0FF]">
              {t("landing.slogan")}
            </p>
            <div className="mx-auto mt-4 h-px w-16 bg-[#00F0FF]/80" />
            <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-white/78 sm:text-base">
              {t("landing.lede")}
            </p>
            <p className="mt-2 text-[13px] tracking-wide text-white/55">{t("landing.coverage")}</p>
          </div>

          <div className="landing-fade-up-delay mt-11 flex w-full max-w-lg flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
            <Link to="/chart" className="landing-cta-primary">
              {t("landing.cta_chart")}
              <ArrowUpRight className="size-4 opacity-80" aria-hidden />
            </Link>
            <a href="#partner" className="landing-cta-secondary">
              {t("landing.cta_partner")}
            </a>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#06101c] to-transparent" />
      </section>

      {/* ——— SOLUTIONS ——— */}
      <section id="solutions" className="scroll-mt-24 border-t border-white/[0.07] px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00F0FF]/80">
            {t("landing.nav_solutions")}
          </p>
          <h2 className="thalvo-display mt-3 max-w-xl text-[clamp(1.8rem,4vw,2.6rem)] leading-tight tracking-wide text-white">
            {t("landing.solutions_title")}
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/60">
            {t("landing.solutions_body")}
          </p>
          <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
            <Feature n="01" title={t("landing.feat_sos_title")} body={t("landing.feat_sos_body")} />
            <Feature n="02" title={t("landing.feat_parts_title")} body={t("landing.feat_parts_body")} />
            <Feature n="03" title={t("landing.feat_chart_title")} body={t("landing.feat_chart_body")} />
          </div>
        </div>
      </section>

      {/* ——— ABOUT ——— */}
      <section id="about" className="scroll-mt-24 border-t border-white/[0.07] px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
              {t("landing.nav_about")}
            </p>
            <h2 className="thalvo-display mt-3 text-[clamp(1.8rem,4vw,2.6rem)] leading-tight tracking-wide text-white">
              {t("landing.about_title")}
            </h2>
          </div>
          <p className="mt-5 text-[15px] leading-relaxed text-white/65 lg:mt-0 lg:text-base">
            {t("landing.about_body")}
          </p>
        </div>
      </section>

      {/* ——— PARTNER DESK ——— */}
      <section
        id="partner"
        className="scroll-mt-24 border-t border-white/[0.07] bg-[#081422] px-5 py-20 sm:px-8 lg:px-12"
      >
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F5B942]/90">
              {t("landing.partner_kicker")}
            </p>
            <h2 className="thalvo-display mt-3 text-[clamp(1.9rem,4vw,2.75rem)] leading-tight tracking-wide text-white">
              {t("landing.partner_title")}
            </h2>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/60">
              {t("landing.partner_lede")}
            </p>
            <ul className="mt-8 space-y-3 text-[13px] text-white/50">
              <li className="flex gap-3">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#00F0FF]" />
                {t("landing.partner_point_1")}
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#00F0FF]" />
                {t("landing.partner_point_2")}
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#00F0FF]" />
                {t("landing.partner_point_3")}
              </li>
            </ul>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c1a2e]/90 p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00F0FF]/50 to-transparent" />

            {sent ? (
              <div className="flex min-h-[280px] flex-col justify-center">
                <p className="thalvo-display text-2xl text-white">{t("landing.partner_thanks_title")}</p>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/65">
                  {t("boatshow.lead_thanks")}
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="grid gap-5">
                <fieldset>
                  <legend className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    {t("boatshow.field_kind")}
                  </legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {KINDS.map((k) => {
                      const on = kind === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setKind(k)}
                          className={
                            "rounded-md px-3 py-2 text-[12px] font-semibold transition " +
                            (on
                              ? "bg-[#00F0FF] text-slate-950"
                              : "border border-white/12 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white")
                          }
                        >
                          {t(`boatshow.kind_${k}`)}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("boatshow.field_name")} value={name} onChange={setName} required />
                  <Field label={t("boatshow.field_company")} value={company} onChange={setCompany} />
                  <Field label={t("boatshow.field_phone")} value={phone} onChange={setPhone} required />
                  <Field label={t("boatshow.field_email")} value={email} onChange={setEmail} type="email" />
                </div>

                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                    {t("boatshow.field_note")}
                  </span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="landing-field min-h-[5.5rem] resize-none py-3"
                  />
                </label>

                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <button type="submit" disabled={busy} className="landing-cta-primary sm:min-w-[12rem]">
                    {busy ? t("common.loading") : t("boatshow.lead_submit")}
                  </button>
                  <p className="text-[11px] leading-snug text-white/40 sm:max-w-[16rem] sm:text-right">
                    {t("boatshow.lead_privacy", { email: OPS_CONTACT_EMAIL })}
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <div className="border-t border-white/[0.07]">
        <PublicFooter />
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px]">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={t("common.close")}
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative flex h-full w-[min(20rem,90vw)] flex-col border-l border-white/10 bg-[#0a1628] px-6 py-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
                {t("landing.nav_menu")}
              </p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="grid size-9 place-items-center rounded-md border border-white/12 text-white/70"
                aria-label={t("common.close")}
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="mt-8 flex flex-col gap-0.5">
              <MenuLink href="#solutions" onClick={() => setMenuOpen(false)}>
                {t("landing.nav_solutions")}
              </MenuLink>
              <MenuLink href="#about" onClick={() => setMenuOpen(false)}>
                {t("landing.nav_about")}
              </MenuLink>
              <MenuLink href="#partner" onClick={() => setMenuOpen(false)}>
                {t("landing.cta_partner")}
              </MenuLink>
              <Link
                to="/chart"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-3.5 text-sm font-semibold text-white/85 hover:bg-white/[0.04]"
              >
                {t("landing.cta_chart")}
              </Link>
              <Link
                to="/auth"
                search={{ intent: "captain" }}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-3.5 text-sm font-semibold text-[#F5B942] hover:bg-white/[0.04]"
              >
                {t("auth.sign_in")}
              </Link>
              <div className="my-3 h-px bg-white/10" />
              <Link
                to="/privacy"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-white/50 hover:bg-white/[0.04]"
              >
                {t("public.footer_privacy")}
              </Link>
              <Link
                to="/terms"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-white/50 hover:bg-white/[0.04]"
              >
                {t("public.footer_terms")}
              </Link>
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Feature({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border-t border-white/10 pt-5">
      <p className="thalvo-num text-[11px] tracking-[0.2em] text-[#00F0FF]/70">{n}</p>
      <p className="mt-3 text-[15px] font-semibold text-white">{title}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-white/55">{body}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="landing-field"
      />
    </label>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="rounded-md px-3 py-3.5 text-sm font-semibold text-white/85 hover:bg-white/[0.04]"
    >
      {children}
    </a>
  );
}
