import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PublicBrowseShell } from "@/components/public/PublicBrowseShell";
import { CoverageChart, type CoverageBayId } from "@/components/public/CoverageChart";

export const Route = createFileRoute("/coverage")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Coverage | THALVO" },
      {
        name: "description",
        content:
          "Marina, anchorage, fuel and hazard coverage around Göcek, Marmaris and Bodrum. No live vessel or technician positions.",
      },
    ],
  }),
  component: CoveragePage,
});

const BAYS: CoverageBayId[] = ["gocek", "marmaris", "bodrum"];

function CoveragePage() {
  const { t } = useTranslation();
  const [bay, setBay] = useState<CoverageBayId>("gocek");

  return (
    <PublicBrowseShell
      active="coverage"
      title={t("public.coverage_title")}
      subtitle={t("public.coverage_subtitle")}
    >
      <div className="flex flex-wrap gap-2">
        {BAYS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setBay(id)}
            className={
              "h-9 rounded-full border px-3 text-xs font-semibold " +
              (bay === id
                ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                : "border-white/10 bg-white/[0.03] text-white/70")
            }
          >
            {t(`public.coverage_${id}`)}
          </button>
        ))}
      </div>
      <CoverageChart bay={bay} />
      <p className="text-xs text-white/50">{t("public.coverage_note")}</p>
    </PublicBrowseShell>
  );
}
