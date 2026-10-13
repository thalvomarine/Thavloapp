import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Menu, X } from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/Wordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PublicFooter } from "@/components/public/PublicFooter";
import { SeaBackdrop } from "@/components/brand/SeaBackdrop";
import { OPS_CONTACT_EMAIL } from "@/lib/superadmin";
import { submitBoatshowLead, type BoatshowLeadKind } from "@/lib/boatshow-leads";

const KINDS: BoatshowLeadKind[] = ["brand", "dealer", "marina", "captain", "technician", "other"];

/**
 * Concept B — brand-first public home.
 * Partner ol → #partner lead form (no account required).
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
    <div className="thalvo-dark relative min-h-dvh overflow-x-hidden bg-[#0A192F] text-white">
      <SeaBackdrop variant="chart" fadeBottom />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0A192F]/35 via-transparent to-[#0A192F]/85" />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex items-center gap-3 px-5 pt-5 sm:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <Wordmark size="sm" className="text-white" decorative />
            <span className="thalvo-display text-[15px] tracking-[0.2em] text-white">THALVO</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-6 md:flex">
            <a
              href="#solutions"
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 transition-colors hover:text-white"
            >
              {t("landing.nav_solutions")}
            </a>
            <a
              href="#about"
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 transition-colors hover:text-white"
            >
              {t("landing.nav_about")}
            </a>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F5B942]"
            >
              {t("landing.nav_menu")}
              <Menu className="size-3.5" aria-hidden />
            </button>
          </nav>

          <div className="flex items-center gap-2 md:ml-4">
            <LanguageSwitcher tone="dark" />
            <Link
              to="/auth"
              search={{ intent: "captain" }}
              className="hidden h-9 items-center rounded-full bg-[#F5B942] px-4 text-xs font-bold text-[#1A1406] sm:inline-flex"
            >
              {t("auth.sign_in")}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex size-9 items-center justify-center rounded-full border border-white/15 text-[#F5B942] md:hidden"
              aria-label={t("landing.nav_menu")}
            >
              <Menu className="size-4" />
            </button>
          </div>
        </header>

        {/* Hero — brand first */}
        <section className="flex flex-1 flex-col items-center justify-center px-5 pb-16 pt-16 text-center sm:px-8">
          <h1 className="thalvo-display text-[clamp(3.2rem,12vw,6.5rem)] leading-[0.9] tracking-[0.04em] text-white">
            THALVO
          </h1>
          <p className="mt-4 text-[clamp(1.05rem,2.6vw,1.35rem)] font-semibold tracking-wide text-cyan-300">
            {t("landing.slogan")}
          </p>
          <div className="mx-auto mt-3 h-px w-24 bg-cyan-300/70" />
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/70 sm:text-[15px]">
            {t("landing.lede")}
          </p>
          <p className="mt-2 text-[13px] text-white/55">{t("landing.coverage")}</p>

          <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <Link
              to="/chart"
              className="inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-8 text-sm font-bold text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.35)] transition hover:bg-cyan-300"
            >
              {t("landing.cta_chart")}
            </Link>
            <a
              href="#partner"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 bg-white/[0.06] px-8 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/10"
            >
              {t("landing.cta_partner")}
            </a>
          </div>
        </section>

        {/* Solutions */}
        <section id="solutions" className="scroll-mt-20 border-t border-white/10 px-5 py-14 sm:px-8">
          <h2 className="thalvo-display text-2xl tracking-wide text-white sm:text-3xl">
            {t("landing.solutions_title")}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">
            {t("landing.solutions_body")}
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            <Feature title={t("landing.feat_sos_title")} body={t("landing.feat_sos_body")} />
            <Feature title={t("landing.feat_parts_title")} body={t("landing.feat_parts_body")} />
            <Feature title={t("landing.feat_chart_title")} body={t("landing.feat_chart_body")} />
          </ul>
        </section>

        {/* About */}
        <section id="about" className="scroll-mt-20 border-t border-white/10 px-5 py-14 sm:px-8">
          <h2 className="thalvo-display text-2xl tracking-wide text-white sm:text-3xl">
            {t("landing.about_title")}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">
            {t("landing.about_body")}
          </p>
        </section>

        {/* Partner lead */}
        <section id="partner" className="scroll-mt-20 border-t border-white/10 px-5 py-14 sm:px-8">
          <h2 className="thalvo-display text-2xl tracking-wide text-white sm:text-3xl">
            {t("landing.partner_title")}
          </h2>
          <p className="mt-3 max-w-lg text-sm text-white/65">{t("landing.partner_lede")}</p>

          {sent ? (
            <p className="mt-8 max-w-md rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-5 text-sm text-emerald-100">
              {t("boatshow.lead_thanks")}
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 grid max-w-xl gap-3">
              <label className="grid gap-1 text-[12px] text-white/55">
                {t("boatshow.field_kind")}
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as BoatshowLeadKind)}
                  className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k} className="bg-[#0A192F]">
                      {t(`boatshow.kind_${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              <Field label={t("boatshow.field_name")} value={name} onChange={setName} required />
              <Field label={t("boatshow.field_company")} value={company} onChange={setCompany} />
              <Field label={t("boatshow.field_phone")} value={phone} onChange={setPhone} required />
              <Field label={t("boatshow.field_email")} value={email} onChange={setEmail} type="email" />
              <label className="grid gap-1 text-[12px] text-white/55">
                {t("boatshow.field_note")}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="mt-1 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.28)] disabled:opacity-60"
              >
                {busy ? t("common.loading") : t("boatshow.lead_submit")}
              </button>
              <p className="text-[11px] text-white/40">
                {t("boatshow.lead_privacy", { email: OPS_CONTACT_EMAIL })}
              </p>
            </form>
          )}
        </section>

        <PublicFooter />
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={t("common.close")}
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative flex h-full w-[min(20rem,88vw)] flex-col border-l border-white/10 bg-[#071422] px-5 py-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                {t("landing.nav_menu")}
              </p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="grid size-9 place-items-center rounded-full border border-white/10 text-white/70"
                aria-label={t("common.close")}
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="mt-6 flex flex-col gap-1">
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
                className="rounded-xl px-3 py-3 text-sm font-semibold text-white/85 hover:bg-white/5"
              >
                {t("landing.cta_chart")}
              </Link>
              <Link
                to="/auth"
                search={{ intent: "captain" }}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-semibold text-[#F5B942] hover:bg-white/5"
              >
                {t("auth.sign_in")}
              </Link>
              <Link
                to="/privacy"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-3 text-sm text-white/55 hover:bg-white/5"
              >
                {t("public.footer_privacy")}
              </Link>
              <Link
                to="/terms"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-3 text-sm text-white/55 hover:bg-white/5"
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

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-white/10 pt-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1.5 text-[13px] leading-snug text-white/55">{body}</p>
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
    <label className="grid gap-1 text-[12px] text-white/55">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white outline-none focus:border-cyan-300/50"
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
      className="rounded-xl px-3 py-3 text-sm font-semibold text-white/85 hover:bg-white/5"
    >
      {children}
    </a>
  );
}
