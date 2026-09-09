import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Anchor, Clock, Wrench } from "lucide-react";
import type { PackageRow } from "@/lib/public-catalog";

/**
 * ServicePackageCard — shared presentation for a service package row.
 * Used by `/services` and the featured section on `/`.
 */
export function ServicePackageCard({
  pkg,
  actionSlot,
}: {
  pkg: PackageRow;
  actionSlot?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const isTr = i18n.language === "tr";
  const isDiver = pkg.category === "diver";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex items-start gap-3">
      <span
        className={
          "size-10 shrink-0 rounded-xl grid place-items-center text-white " +
          (isDiver ? "aqua-gradient" : "marine-gradient")
        }
      >
        {isDiver ? <Anchor className="size-5" /> : <Wrench className="size-5" />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{isTr ? pkg.title_tr : pkg.title_en}</p>
        {pkg.base_duration_min != null && (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/55">
            <Clock className="size-3" /> ~{pkg.base_duration_min}{" "}
            {t("common.min", { defaultValue: "min" })}
          </p>
        )}
      </div>
      {actionSlot ? <div className="ml-auto shrink-0 self-center">{actionSlot}</div> : null}
    </div>
  );
}
