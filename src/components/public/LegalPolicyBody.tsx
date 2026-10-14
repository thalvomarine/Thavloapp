import { useTranslation } from "react-i18next";

/** Shared privacy / terms body — product-behaviour copy provided by ops. */
export function LegalPolicyBody() {
  const { t } = useTranslation();
  const browseItems = t("public.privacy_browse_items", { returnObjects: true });
  const items = Array.isArray(browseItems) ? (browseItems as string[]) : [];

  return (
    <>
      <section>
        <h2 className="text-base font-bold">{t("public.privacy_browse_title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          {t("public.privacy_browse_lede")}
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-white/70">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          {t("public.privacy_browse_note")}
        </p>
      </section>
      <section>
        <h2 className="text-base font-bold">{t("public.privacy_account_title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          {t("public.privacy_account_body")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          {t("public.privacy_account_note")}
        </p>
      </section>
      <section>
        <h2 className="text-base font-bold">{t("public.privacy_payment_title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          {t("public.privacy_payment_body")}
        </p>
      </section>
      <section>
        <h2 className="text-base font-bold">{t("public.privacy_data_title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          {t("public.privacy_data_body")}
        </p>
      </section>
      <p className="text-xs text-white/45">{t("public.privacy_updated")}</p>
    </>
  );
}
