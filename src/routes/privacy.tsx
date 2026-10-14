import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicDocument } from "@/components/public/PublicDocument";
import { LegalPolicyBody } from "@/components/public/LegalPolicyBody";

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
      <LegalPolicyBody />
    </PublicDocument>
  );
}
