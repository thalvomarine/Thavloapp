import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicDocument } from "@/components/public/PublicDocument";

export const Route = createFileRoute("/terms")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Terms | THALVO" },
      {
        name: "description",
        content: "Browsing is open. Orders, service calls and payment require a THALVO account.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { t } = useTranslation();
  return (
    <PublicDocument title={t("public.terms_title")} lede={t("public.terms_intro")}>
      <section>
        <h2 className="text-base font-bold">{t("public.terms_browse_title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{t("public.terms_browse_body")}</p>
      </section>
      <section>
        <h2 className="text-base font-bold">{t("public.terms_account_title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{t("public.terms_account_body")}</p>
      </section>
      <section>
        <h2 className="text-base font-bold">{t("public.terms_payment_title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{t("public.terms_payment_body")}</p>
      </section>
    </PublicDocument>
  );
}
