import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicDocument } from "@/components/public/PublicDocument";
import { LegalPolicyBody } from "@/components/public/LegalPolicyBody";

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
    <PublicDocument title={t("public.terms_title")} lede={t("public.privacy_intro")}>
      <LegalPolicyBody />
    </PublicDocument>
  );
}
