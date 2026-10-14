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
 * Piri Reis–inspired chart hero. Partner ol → partner desk modal.
 */
export function BrandLanding() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<BoatshowLeadKind>("brand");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const openPartner = () => {
    setMenuOpen(false);
    setPartnerOpen(true);
  };

  const closePartner = () => setPartnerOpen(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#partner") setPartnerOpen(true);
  }, []);

  useEffect(() => {
    if (!menuOpen && !partnerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (partnerOpen) closePartner();
      else setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, partnerOpen]);

  useEffect(() => {
    if (!partnerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [partnerOpen]);

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

  const aboutParagraphs = [
    t("landing.about_p1"),
    t("landing.about_p2"),
    t("landing.about_p3"),
    t("landing.about_p4"),
  ];

  return (
    <div className="thalvo-dark min-h-dvh overflow-x-clip bg-[#06101c] text-white">
      {/* ——— HERO ——— */}
      <section className="relative flex min-h-svh flex-col">
        <PiriChartBackdrop />

        <header className="relative z-20 flex items-center gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
          <Link to="/" className="flex min-w-0 items-center gap-3.5">
            <Wordmark
              size="nav"
              className="text-white drop-shadow-[0_1px_10px_rgba(0,0,0,0.65)]"
              decorative
            />
            <span className="thalvo-display text-[20px] tracking-[0.2em] text-white sm:text-[22px]">
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
            <p className="mt-5 text-[clamp(1.05rem,2.4vw,1.4rem)] font-semibold tracking-[0.04em] text-[#F5B942]">
              {t("landing.slogan")}
            </p>
            <div className="mx-auto mt-4 h-px w-16 bg-[#F5B942]/80" />
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
            <button type="button" onClick={openPartner} className="landing-cta-secondary">
              {t("landing.cta_partner")}
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#06101c] to-transparent" />
      </section>

      {/* ——— SOLUTIONS ——— */}
      <section id="solutions" className="scroll-mt-24 border-t border-white/[0.07] px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F5B942]/80">
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
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F5B942]/80">
            {t("landing.nav_about")}
          </p>
          <h2 className="thalvo-display mt-3 text-[clamp(1.8rem,4vw,2.6rem)] leading-tight tracking-wide text-white">
            {t("landing.about_title")}
          </h2>
          <div className="mt-8 max-w-3xl space-y-5">
            {aboutParagraphs.map((p) => (
              <p key={p.slice(0, 40)} className="text-[15px] leading-relaxed text-white/65 sm:text-base">
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-white/[0.07]">
        <PublicFooter />
      </div>

      {/* ——— PARTNER DESK MODAL ——— */}
      {partnerOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-[3px] sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={t("common.close")}
            onClick={closePartner}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-desk-title"
            className="relative z-10 flex max-h-[min(92dvh,52rem)] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-[#D4AF37]/25 bg-[#0a1628] shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-4 sm:px-7">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#F5B942]">
                  {t("landing.partner_kicker")}
                </p>
                <h2
                  id="partner-desk-title"
                  className="thalvo-display mt-1.5 text-[clamp(1.5rem,3vw,2rem)] tracking-wide text-white"
                >
                  {t("landing.partner_title")}
                </h2>
                <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/55">
                  {t("landing.partner_lede")}
                </p>
              </div>
              <button
                type="button"
                onClick={closePartner}
                className="grid size-10 shrink-0 place-items-center rounded-md border border-white/12 text-white/70 hover:text-white"
                aria-label={t("common.close")}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="border-b border-white/[0.06] px-5 py-4 sm:px-7">
                <ol className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                  {[
                    t("landing.partner_point_1"),
                    t("landing.partner_point_2"),
                    t("landing.partner_point_3"),
                  ].map((line, i) => (
                    <li
                      key={line}
                      className="border-l border-[#D4AF37]/35 pl-3 text-[12px] leading-snug text-white/55"
                    >
                      <span className="thalvo-num block text-[10px] tracking-[0.2em] text-[#F5B942]/70">
                        0{i + 1}
                      </span>
                      <span className="mt-1 block">{line}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {sent ? (
                <div className="flex min-h-[240px] flex-col justify-center px-6 py-12 sm:px-10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F5B942]/80">
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
                  <div className="border-b border-white/[0.07] px-5 py-6 sm:px-7 lg:border-b-0 lg:border-r lg:border-white/[0.07] lg:py-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                      {t("boatshow.field_kind")}
                    </p>
                    <p className="mt-2 text-sm text-white/55">{t("landing.partner_kind_hint")}</p>
                    <div className="mt-5 grid gap-2">
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

                  <div className="grid gap-4 px-5 py-6 sm:px-7 lg:py-8">
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
                        rows={3}
                        className="landing-field min-h-[5.5rem] resize-none py-3"
                      />
                    </label>

                    <div className="mt-1 flex flex-col gap-4 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
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
        </div>
      ) : null}

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
              <button
                type="button"
                onClick={openPartner}
                className="rounded-md px-3 py-3.5 text-left text-sm font-semibold text-white/85 hover:bg-white/[0.04]"
              >
                {t("landing.cta_partner")}
              </button>
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
      <p className="thalvo-num text-[11px] tracking-[0.2em] text-[#F5B942]/70">{n}</p>
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
