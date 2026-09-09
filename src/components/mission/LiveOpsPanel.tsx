import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/session";
import {
  EMERGENCY_CATEGORY_LABEL_KEYS,
  type EmergencyServiceRequest,
} from "@/lib/emergency-service";
import {
  Activity,
  Clock,
  Crosshair,
  MapPin,
  Radio,
  Ship,
  X,
} from "lucide-react";
import { CockpitHeader, MetricCard, StatusBadge } from "@/components/core";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { SEED_MISSIONS, SEED_OPS_STATS, type OpsMission, type OpsMissionStatus } from "@/lib/live-ops";
import { requestMapFocus } from "@/lib/map-focus-bus";

const STATUS_TONE: Record<OpsMissionStatus, "warning" | "info" | "neutral" | "success"> = {
  en_route: "warning",
  preparing: "info",
  pending: "neutral",
  completed: "success",
};

export function LiveOpsPanel() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<OpsMission | null>(null);

  return (
    <div className="space-y-4">
      <CockpitHeader
        eyebrow={t("ops.eyebrow")}
        title={t("ops.title")}
        subtitle={t("ops.subtitle")}
      />

      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          label={t("ops.stat_active")}
          value={SEED_OPS_STATS.active}
          tone="info"
          icon={<Activity className="size-3" />}
          hint={t("ops.stat_active_hint")}
        />
        <MetricCard
          label={t("ops.stat_pending")}
          value={SEED_OPS_STATS.pending}
          tone="warning"
          icon={<Clock className="size-3" />}
          hint={t("ops.stat_pending_hint")}
        />
        <MetricCard
          label={t("ops.stat_completed")}
          value={SEED_OPS_STATS.completed}
          tone="success"
          icon={<Ship className="size-3" />}
          hint={t("ops.stat_completed_hint")}
        />
      </div>

      <CaptainEmergencyCalls />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/80">
          {t("ops.live_feed")}
        </p>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
            <span className="relative size-1.5 rounded-full bg-emerald-400" />
          </span>
          LIVE
        </span>
      </div>

      <ul className="space-y-3">
        {SEED_MISSIONS.map((mission) => (
          <li key={mission.id}>
            <OpsMissionCard mission={mission} onDetails={() => setSelected(mission)} />
          </li>
        ))}
      </ul>

      {selected && <OpsMissionSheet mission={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function OpsMissionCard({ mission, onDetails }: { mission: OpsMission; onDetails: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const focusMap = () => {
    requestMapFocus({
      lat: mission.lat,
      lng: mission.lng,
      zoom: 15,
      label: mission.marina,
    });
    void navigate({ to: "/app" });
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#0a192f]/90 shadow-[0_0_32px_rgba(0,240,255,0.06)]">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
            {t("ops.unit_label")} · {mission.vessel}
          </p>
          <h2 className="mt-1 text-[15px] font-semibold leading-snug text-white">{t(mission.titleKey)}</h2>
        </div>
        <StatusBadge tone={STATUS_TONE[mission.status]}>{t(mission.statusKey)}</StatusBadge>
      </div>

      <div className="space-y-2 px-4 py-3">
        <p className="flex items-start gap-2 text-[13px] text-white/80">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
          <span>
            <span className="text-white/45">{t("ops.target")}: </span>
            {t(mission.targetKey)}
          </span>
        </p>
        {mission.distanceNm != null && mission.etaMin != null && (
          <p className="text-[12px] font-medium text-amber-200/90">
            {t("ops.remaining", { nm: mission.distanceNm.toFixed(1), min: mission.etaMin })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 border-t border-white/[0.06] bg-black/20 p-2">
        <OpsAction onClick={focusMap} icon={<Crosshair className="size-3.5" />} label={t("ops.focus_map")} />
        <OpsAction onClick={onDetails} icon={<Radio className="size-3.5" />} label={t("ops.vhf")} />
        <OpsAction onClick={onDetails} icon={<Ship className="size-3.5" />} label={t("ops.details")} />
      </div>
    </article>
  );
}

function OpsAction({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-100/90 transition-colors hover:bg-cyan-400/10"
    >
      {icon}
      <span className="leading-tight">{label}</span>
    </button>
  );
}

function OpsMissionSheet({ mission, onClose }: { mission: OpsMission; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[700] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="thalvo-dark w-full max-w-md overflow-hidden rounded-t-3xl border border-cyan-500/25 bg-[#0a192f] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">{t("ops.details")}</p>
            <h3 className="mt-1 text-sm font-semibold text-white">{t(mission.titleKey)}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 text-white/70 hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4 text-[13px] text-white/80">
          <SpecRow label={t("ops.target")} value={t(mission.targetKey)} />
          <SpecRow label={t("ops.vessel")} value={mission.vessel} />
          <SpecRow label={t("ops.status")} value={t(mission.statusKey)} />
          {mission.distanceNm != null && (
            <SpecRow label={t("ops.distance")} value={`${mission.distanceNm.toFixed(1)} NM`} />
          )}
          {mission.etaMin != null && <SpecRow label={t("ops.eta")} value={`${mission.etaMin} min`} />}
          <p className="text-[12px] leading-relaxed text-white/60">{t(mission.notesKey)}</p>
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">{t("ops.vhf")}</p>
            <p className="mt-1 font-semibold text-white">
              VHF Ch {mission.vhfChannel} · {mission.callsign}
            </p>
            <a href={`tel:${mission.phone.replace(/\s/g, "")}`} className="mt-1 block text-[12px] text-amber-100/80">
              {mission.phone}
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => {
              requestMapFocus({ lat: mission.lat, lng: mission.lng, zoom: 15, label: mission.marina });
              onClose();
              void navigate({ to: "/app" });
            }}
            className="h-11 rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-100"
          >
            {t("ops.focus_map")}
          </button>
          <a
            href={`tel:${mission.phone.replace(/\s/g, "")}`}
            className="grid h-11 place-items-center rounded-xl bg-amber-300 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-900"
          >
            {t("ops.call_ops")}
          </a>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] pb-2">
      <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}

function CaptainEmergencyCalls() {
  const { t } = useTranslation();
  const { user } = useSessionUser();
  const [rows, setRows] = useState<EmergencyServiceRequest[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      void supabase
        .from("emergency_service_requests")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(8)
        .then(({ data }) => setRows((data as EmergencyServiceRequest[] | null) ?? []));
    };
    load();
    const ch = supabase
      .channel(`esr-captain:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "emergency_service_requests",
          filter: `user_id=eq.${user.id}`,
        },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
        {t("esvc.my_calls")}
      </p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-2xl border border-cyan-400/20 bg-white/[0.03] px-4 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">
                {t(EMERGENCY_CATEGORY_LABEL_KEYS[row.category])}
              </p>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
                {t(`esvc.status_${row.status}`)}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-white/50">
              {row.bay_name ? `⚓ ${row.bay_name}` : t("esvc.open_water")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
