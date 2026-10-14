import { GlassPanel } from "@/components/mission/GlassPanel";
import { Flag, CheckCircle2, Circle } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface PilotReadinessStats {
  activeParts: number;
  providersTotal: number;
  providersLive: number;
  activeSos: number;
  liveMissions: number;
  activeZones: number;
  /** Until a PSP is wired, always false. */
  paymentProviderConnected?: boolean;
}

/**
 * Honest pilot snapshot for Control Tower demos.
 * Counts come from the same admin loaders as the KPI rail — no padded metrics.
 */
export function PilotReadinessPanel({
  activeParts,
  providersTotal,
  providersLive,
  activeSos,
  liveMissions,
  activeZones,
  paymentProviderConnected = false,
}: PilotReadinessStats) {
  const { t } = useTranslation();
  const dealersReady = activeParts >= 15;
  const providersReady = providersLive >= 3 || providersTotal >= 3;

  return (
    <GlassPanel padded={false}>
      <div className="border-b border-white/[0.06] p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
          <Flag className="size-3.5 text-amber-300" /> {t("admin.pilot.title")}
        </p>
        <p className="mt-1.5 text-[12px] leading-snug text-white/55">{t("admin.pilot.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-white/[0.04] sm:grid-cols-4">
        <Stat label={t("admin.pilot.corridor")} value={t("admin.pilot.corridor_value")} />
        <Stat
          label={t("admin.pilot.payment")}
          value={
            paymentProviderConnected
              ? t("admin.pilot.payment_live")
              : t("admin.pilot.payment_simulated")
          }
          tone={paymentProviderConnected ? "ok" : "warn"}
        />
        <Stat
          label={t("admin.pilot.parts")}
          value={String(activeParts)}
          hint={t("admin.pilot.parts_goal")}
          tone={dealersReady ? "ok" : "warn"}
        />
        <Stat
          label={t("admin.pilot.providers_live")}
          value={`${providersLive} / ${providersTotal}`}
          hint={t("admin.pilot.providers_goal")}
          tone={providersReady ? "ok" : "warn"}
        />
        <Stat label={t("admin.pilot.sos")} value={String(activeSos)} tone={activeSos > 0 ? "danger" : "neutral"} />
        <Stat label={t("admin.pilot.missions")} value={String(liveMissions)} />
        <Stat label={t("admin.pilot.zones")} value={String(activeZones)} />
        <Stat label={t("admin.pilot.providers")} value={String(providersTotal)} />
      </div>

      <div className="border-t border-white/[0.06] p-4">
        <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40">
          {t("admin.pilot.checklist_title")}
        </p>
        <ul className="space-y-1.5">
          <CheckRow done={dealersReady} label={t("admin.pilot.check_dealers")} />
          <CheckRow done={paymentProviderConnected} label={t("admin.pilot.check_psp")} />
          <CheckRow done={liveMissions > 0 || activeSos > 0} label={t("admin.pilot.check_sos")} />
          <CheckRow done label={t("admin.pilot.check_honest")} />
        </ul>
      </div>
    </GlassPanel>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  const valueTone =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-200"
        : tone === "danger"
          ? "text-rose-300"
          : "text-white";
  return (
    <div className="bg-[#0A192F]/90 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className={`mt-1 text-[13px] font-semibold tabular-nums ${valueTone}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-white/35">{hint}</p> : null}
    </div>
  );
}

function CheckRow({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2 text-[12px] text-white/75">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />
      ) : (
        <Circle className="mt-0.5 size-3.5 shrink-0 text-white/30" />
      )}
      <span>{label}</span>
    </li>
  );
}
