import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Wordmark } from "@/components/Wordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PublicFooter } from "@/components/public/PublicFooter";

/** Signed-out frame for privacy, terms, and other prose pages. */
export function PublicDocument({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="thalvo-dark flex min-h-dvh flex-col bg-deep text-white">
      <header className="flex items-center justify-between gap-3 px-5 pt-5">
        <Link to="/">
          <Wordmark size="sm" className="text-white" />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher tone="dark" />
          <Link
            to="/auth"
            className="inline-flex h-9 items-center rounded-full amber-gradient px-4 text-xs font-black text-warning-foreground"
          >
            {t("auth.sign_in")}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-5 py-8">
        <div>
          <h1 className="text-2xl font-black">{title}</h1>
          {lede ? <p className="mt-2 text-sm text-white/65">{lede}</p> : null}
        </div>
        <div className="space-y-5">{children}</div>
        <p className="text-xs text-white/45">{t("public.legal_review")}</p>
      </main>
      <PublicFooter />
    </div>
  );
}
