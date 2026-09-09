import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { Ship, Anchor, Gauge, Fuel, Ruler, Flag } from "lucide-react";

export interface VesselIdentity {
  name: string | null;
  category?: string | null;
  vessel_type: string | null;
  manufacturer?: string | null;
  model?: string | null;
  length_m: number | null;
  engine_model: string | null;
  engine_hours?: number | null;
  home_marina?: string | null;
  flag?: string | null;
  fuel_type: string | null;
}

interface Props {
  vessel: VesselIdentity;
  ownerName?: string | null;
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mt-0.5 text-sky-300/80">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</p>
        <p className="text-sm font-medium text-white/90 truncate">{value}</p>
      </div>
    </div>
  );
}

/** Digital passport identity block — spec-plate for the vessel. */
export function VesselIdentityCard({ vessel, ownerName }: Props) {
  const { t } = useTranslation();
  const displayName = vessel.name || t("passport.unnamed");
  const line2 = [vessel.manufacturer, vessel.model].filter(Boolean).join(" · ") || vessel.vessel_type || t("passport.vessel_fallback");
  return (
    <GlassPanel padded={false} className="overflow-hidden">
      <div className="p-5 border-b border-white/10 bg-gradient-to-br from-sky-500/10 via-transparent to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-300/80">{t("passport.digital_passport")}</p>
            <h2 className="mt-1 text-2xl font-semibold text-white tracking-tight truncate">{displayName}</h2>
            <p className="text-sm text-white/60 truncate">{line2}</p>
            {ownerName && (
              <p className="mt-2 text-[11px] text-white/40">{t("passport.registered_to")} <span className="text-white/70">{ownerName}</span></p>
            )}
          </div>
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <Field icon={<Ship className="size-4" />} label={t("passport.field_type")} value={vessel.vessel_type || "—"} />
        <Field icon={<Ruler className="size-4" />} label={t("passport.field_length")} value={vessel.length_m ? `${vessel.length_m} m` : "—"} />
        <Field icon={<Gauge className="size-4" />} label={t("passport.field_engine")} value={vessel.engine_model || "—"} />
        <Field icon={<Fuel className="size-4" />} label={t("passport.field_fuel")} value={vessel.fuel_type || "—"} />
        <Field icon={<Anchor className="size-4" />} label={t("passport.field_home_marina")} value={vessel.home_marina || t("passport.not_set")} />
        <Field
          icon={<Flag className="size-4" />}
          label={t("passport.field_flag")}
          value={vessel.flag || t("passport.not_set")}
        />
      </div>
    </GlassPanel>
  );
}
