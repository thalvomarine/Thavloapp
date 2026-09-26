import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/** Shared signed-out footer: coverage and legal links stay one click away. */
export function PublicFooter() {
  const { t } = useTranslation();
  const linkCls = "text-[11px] font-semibold text-white/55 hover:text-white";
  return (
    <footer className="relative z-10 px-5 py-6 text-center">
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link to="/coverage" className={linkCls}>
          {t("public.footer_coverage")}
        </Link>
        <Link to="/privacy" className={linkCls}>
          {t("public.footer_privacy")}
        </Link>
        <Link to="/terms" className={linkCls}>
          {t("public.footer_terms")}
        </Link>
      </nav>
      <p className="mt-3 text-[11px] text-white/40">© THALVO · {t("brand.tagline")}</p>
    </footer>
  );
}
