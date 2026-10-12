import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Wordmark } from "@/components/Wordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PublicFooter } from "@/components/public/PublicFooter";
import { SeaBackdrop } from "@/components/brand/SeaBackdrop";
import { SUPERADMIN_EMAIL } from "@/lib/superadmin";
import { submitBoatshowLead, type BoatshowLeadKind } from "@/lib/boatshow-leads";
import { Anchor, Ship, Store, Wrench } from "lucide-react";

export const Route = createFileRoute("/boatshow")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Boat Show | THALVO" },
      {
        name: "description",
        content:
          "THALVO MarineOS — Göcek–Marmaris pilot. SOS, technicians, spare parts. Partner and dealer signup for the boat show.",
      },
    ],
  }),
  component: BoatshowPage,
});

const KINDS: BoatshowLeadKind[] = ["brand", "dealer", "marina", "captain", "technician", "other"];

function BoatshowPage() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<BoatshowLeadKind>("brand");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

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
        source: "boatshow",
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
      <SeaBackdrop />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 px-5 pt-5">
          <Link to="/">
            <Wordmark size="sm" className="text-white" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher tone="dark" />
            <Link
              to="/auth"
              search={{ intent: "captain" }}
              className="inline-flex h-9 items-center rounded-full amber-gradient px-4 text-xs font-black text-warning-foreground"
            >
              {t("auth.sign_in")}
            </Link>
          </div>
        </header>

        {/* Hero — brand first, one job */}
        <section className="flex flex-1 flex-col justify-center px-5 pb-10 pt-12 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/90">
            {t("boatshow.kicker")}
          </p>
          <h1 className="thalvo-display mt-3 max-w-xl text-[clamp(2.4rem,8vw,4.2rem)] leading-[0.95] tracking-tight text-white">
            THALVO
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70 sm:text-base">
            {t("boatshow.lede")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-cyan-400 px-6 text-sm font-bold text-slate-950"
            >
              {t("boatshow.cta_chart")}
            </Link>
            <a
              href="#partner"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white"
            >
              {t("boatshow.cta_partner")}
            </a>
          </div>
        </section>

        {/* Paths */}
        <section className="border-t border-white/10 px-5 py-10 sm:px-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {t("boatshow.paths_label")}
          </h2>
          <p className="mt-2 max-w-lg text-sm text-white/65">{t("boatshow.paths_lede")}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="#partner"
              className="block border border-white/10 bg-white/[0.03] px-4 py-4 transition-colors hover:border-cyan-300/40 hover:bg-white/[0.06]"
            >
              <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
                <Ship className="size-4 text-cyan-300" />
                {t("boatshow.path_brand")}
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-white/55">{t("boatshow.path_brand_body")}</p>
            </a>
            <PathLink
              to="/auth"
              search={{ intent: "dealer", next: "/app/dealer" }}
              icon={<Store className="size-4 text-cyan-300" />}
              title={t("boatshow.path_dealer")}
              body={t("boatshow.path_dealer_body")}
            />
            <PathLink
              to="/auth"
              search={{ intent: "captain" }}
              icon={<Anchor className="size-4 text-cyan-300" />}
              title={t("boatshow.path_captain")}
              body={t("boatshow.path_captain_body")}
            />
            <PathLink
              to="/auth"
              search={{ intent: "provider" }}
              icon={<Wrench className="size-4 text-cyan-300" />}
              title={t("boatshow.path_tech")}
              body={t("boatshow.path_tech_body")}
            />
          </div>
        </section>

        {/* Partner lead */}
        <section id="partner" className="scroll-mt-8 border-t border-white/10 px-5 py-10 sm:px-8">
          <h2 className="thalvo-display text-2xl text-white sm:text-3xl">{t("boatshow.lead_title")}</h2>
          <p className="mt-2 max-w-lg text-sm text-white/65">{t("boatshow.lead_lede")}</p>

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
                className="mt-1 inline-flex h-12 items-center justify-center rounded-2xl bg-cyan-400 text-sm font-bold text-slate-950 disabled:opacity-60"
              >
                {busy ? t("common.loading") : t("boatshow.lead_submit")}
              </button>
              <p className="text-[11px] text-white/40">
                {t("boatshow.lead_privacy", { email: SUPERADMIN_EMAIL })}
              </p>
            </form>
          )}
        </section>

        {/* 5-min demo script for the booth */}
        <section className="border-t border-white/10 px-5 py-10 sm:px-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {t("boatshow.demo_label")}
          </h2>
          <p className="mt-2 max-w-lg text-sm text-white/65">{t("boatshow.demo_lede")}</p>
          <ol className="mt-5 max-w-xl list-decimal space-y-2 pl-5 text-sm text-white/80">
            <li>{t("boatshow.demo_1")}</li>
            <li>{t("boatshow.demo_2")}</li>
            <li>{t("boatshow.demo_3")}</li>
            <li>{t("boatshow.demo_4")}</li>
            <li>{t("boatshow.demo_5")}</li>
          </ol>
          <p className="mt-4 max-w-xl text-[12px] text-amber-200/80">{t("boatshow.demo_honest")}</p>
        </section>

        <PublicFooter />
      </div>
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

function PathLink({
  to,
  search,
  icon,
  title,
  body,
}: {
  to: "/auth";
  search?: { intent?: "captain" | "dealer" | "provider"; next?: string };
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      search={search}
      className="block border border-white/10 bg-white/[0.03] px-4 py-4 transition-colors hover:border-cyan-300/40 hover:bg-white/[0.06]"
    >
      <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
        {icon}
        {title}
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-white/55">{body}</p>
    </Link>
  );
}
