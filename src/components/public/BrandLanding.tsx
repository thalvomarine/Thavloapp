import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, LayoutGrid, X } from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/Wordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PiriChartBackdrop } from "@/components/brand/PiriChartBackdrop";
import { OPS_CONTACT_EMAIL } from "@/lib/superadmin";
import { submitBoatshowLead, type BoatshowLeadKind } from "@/lib/boatshow-leads";

const KINDS: BoatshowLeadKind[] = ["brand", "dealer", "marina", "captain", "technician", "other"];

/**
 * Concept B — brand-first public home.
 * Piri Reis–inspired chart hero + partner desk. Partner ol → #partner.
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
        <PiriChartBackdrop />

        <header className="relative z-20 flex items-center gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <Wordmark size="md" className="text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.55)]" decorative />
            <span className="thalvo-display text-[18px] tracking-[0.22em] text-white sm:text-[20px]">
              THALVO
            </span>
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
      <section id="partner" className="relative scroll-mt-24 overflow-hidden border-t border-[#D4AF37]/15">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 20%, #F5B942 0.6px, transparent 0.7px), radial-gradient(circle at 88% 70%, #00F0FF 0.5px, transparent 0.6px)",
            backgroundSize: "28px 28px, 36px 36px",
          }}
        />
        <div className="pointer-events-none absolute -right-24 top-10 size-[28rem] rounded-full bg-[#F5B942]/[0.04] blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 size-[22rem] rounded-full bg-[#00F0FF]/[0.04] blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
          <div className="mb-12 flex flex-col gap-4 border-b border-white/[0.08] pb-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#F5B942]">
                {t("landing.partner_kicker")}
              </p>
              <h2 className="thalvo-display mt-3 text-[clamp(2rem,4.2vw,3rem)] leading-[1.05] tracking-wide text-white">
                {t("landing.partner_title")}
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/58">
                {t("landing.partner_lede")}
              </p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-3 lg:max-w-md lg:gap-4">
              {[
                t("landing.partner_point_1"),
                t("landing.partner_point_2"),
                t("landing.partner_point_3"),
              ].map((line, i) => (
                <li
                  key={line}
                  className="border-l border-[#D4AF37]/35 pl-3 text-[12px] leading-snug text-white/55"
                >
                  <span className="thalvo-num block text-[10px] tracking-[0.2em] text-[#00F0FF]/70">
                    0{i + 1}
                  </span>
                  <span className="mt-1 block">{line}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="relative overflow-hidden rounded-[1.25rem] border border-[#D4AF37]/20 bg-[#0a1628]/95 shadow-[inset_0_1px_0_rgba(212,175,55,0.12)]">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#F5B942]/55 to-transparent" />
            <div className="pointer-events-none absolute left-0 top-0 h-full w-px bg-gradient-to-b from-[#F5B942]/35 via-transparent to-[#00F0FF]/20" />

            {sent ? (
              <div className="flex min-h-[320px] flex-col justify-center px-6 py-14 sm:px-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00F0FF]/80">
                  {t("landing.partner_kicker")}
                </p>
                <p className="thalvo-display mt-3 text-3xl text-white">
                  {t("landing.partner_thanks_title")}
                </p>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/65">
                  {t("boatshow.lead_thanks")}
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="border-b border-white/[0.07] px-6 py-8 sm:px-8 lg:border-b-0 lg:border-r lg:border-white/[0.07] lg:py-10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                    {t("boatshow.field_kind")}
                  </p>
                  <p className="mt-2 text-sm text-white/55">{t("landing.partner_kind_hint")}</p>
                  <div className="mt-6 grid gap-2">
                    {KINDS.map((k) => {
                      const on = kind === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setKind(k)}
                          className={
                            "flex items-center justify-between rounded-lg px-3.5 py-3 text-left text-[13px] font-semibold transition " +
                            (on
                              ? "bg-[#F5B942] text-[#1A1406]"
                              : "border border-white/[0.08] bg-white/[0.02] text-white/70 hover:border-[#D4AF37]/35 hover:text-white")
                          }
                        >
                          <span>{t(`boatshow.kind_${k}`)}</span>
                          <span
                            className={
                              "size-1.5 rounded-full " + (on ? "bg-[#06101c]" : "bg-white/25")
                            }
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-5 px-6 py-8 sm:px-8 lg:py-10">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("boatshow.field_name")} value={name} onChange={setName} required />
                    <Field
                      label={t("boatshow.field_company")}
                      value={company}
                      onChange={setCompany}
                    />
                    <Field
                      label={t("boatshow.field_phone")}
                      value={phone}
                      onChange={setPhone}
                      required
                    />
                    <Field
                      label={t("boatshow.field_email")}
                      value={email}
                      onChange={setEmail}
                      type="email"
                    />
                  </div>

                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                      {t("boatshow.field_note")}
                    </span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={4}
                      className="landing-field min-h-[6.5rem] resize-none py-3"
                    />
                  </label>

                  <div className="mt-1 flex flex-col gap-4 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#F5B942] px-8 text-sm font-bold text-[#1A1406] transition hover:bg-[#ffc857] disabled:opacity-55 sm:min-w-[14rem]"
                    >
                      {busy ? t("common.loading") : t("boatshow.lead_submit")}
                      <ArrowUpRight className="size-4 opacity-80" aria-hidden />
                    </button>
                    <p className="text-[11px] leading-snug text-white/38 sm:max-w-[18rem] sm:text-right">
                      {t("boatshow.lead_privacy", { email: OPS_CONTACT_EMAIL })}
                    </p>
                  </div>
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
