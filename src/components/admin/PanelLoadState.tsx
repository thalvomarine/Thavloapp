import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";

/**
 * PanelLoadState — the single piece of UI every Control Tower panel uses
 * when its query is still running or has failed. A failed read must never
 * be rendered as an empty result.
 */
export function PanelLoadState({
  state,
  onRetry,
}: {
  state: "loading" | "error";
  onRetry?: () => void;
}) {
  const { t } = useTranslation();

  if (state === "loading") {
    return (
      <GlassPanel className="grid place-items-center min-h-[120px] text-center">
        <p className="inline-flex items-center gap-2 text-[11px] text-white/70">
          <Loader2 className="size-3.5 animate-spin" />
          {t("admin.tower.loading")}
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="min-h-[120px] text-center grid place-items-center">
      <div>
        <AlertTriangle className="size-5 mx-auto text-amber-300" />
        <p className="mt-2 text-[12px] font-semibold text-white">{t("admin.tower.error_title")}</p>
        <p className="mt-1 text-[11px] text-white/70 max-w-xs">{t("admin.tower.error_body")}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/15 bg-white/[0.06] text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85 hover:bg-white/[0.12] transition-colors"
          >
            <RotateCw className="size-3.5" />
            {t("admin.tower.retry")}
          </button>
        )}
      </div>
    </GlassPanel>
  );
}
