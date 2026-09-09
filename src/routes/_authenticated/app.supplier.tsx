import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/supplier")({
  ssr: false,
  component: SupplierRedirect,
});

function SupplierRedirect() {
  const { t } = useTranslation();
  return (
    <>
      <p className="sr-only">{t("supplier.redirect", "Opening dealer console…")}</p>
      <Navigate to="/app/dealer" replace />
    </>
  );
}
