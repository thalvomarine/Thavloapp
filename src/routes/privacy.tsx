import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicDocument } from "@/components/public/PublicDocument";

export const Route = createFileRoute("/privacy")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Privacy | THALVO" },
      {
        name: "description",
        content: "What THALVO shows without an account, and what is stored after sign-up.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <PublicDocument title={t("public.privacy_title")} lede={t("public.privacy_intro")}>
      <section>
        <h2 className="text-base font-bold">{t("public.privacy_browse_title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{t("public.privacy_browse_body")}</p>
      </section>
      <section>
        <h2 className="text-base font-bold">{t("public.privacy_account_title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{t("public.privacy_account_body")}</p>
      </section>
      <section>
        <h2 className="text-base font-bold">{t("public.privacy_payment_title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{t("public.privacy_payment_body")}</p>
      </section>
    </PublicDocument>
  );
}
