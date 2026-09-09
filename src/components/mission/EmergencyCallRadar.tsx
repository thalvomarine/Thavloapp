import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Radio, Ship } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LiveMap, type LiveRoute } from "@/components/LiveMap";
import { GlassPanel } from "@/components/mission/GlassPanel";
import {
  EMERGENCY_CATEGORY_LABEL_KEYS,
  type EmergencyServiceRequest,
} from "@/lib/emergency-service";
import { calculateMarineEta } from "@/lib/geo-eta";
import { getFix, isValidCoordinate } from "@/lib/geolocation";
import { requestMapFocus } from "@/lib/map-focus-bus";
import { playSonarPing } from "@/lib/sonar";

interface Props {
  userId: string;
}

/**
 * Provider Missions radar — realtime pending calls + accept → en_route + chart route.
 */
export function EmergencyCallRadar({ userId }: Props) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<EmergencyServiceRequest[]>([]);
  const [mine, setMine] = useState<EmergencyServiceRequest[]>([]);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  const locate = useCallback(async () => {
    const res = await getFix();
    if (res.ok) setOrigin({ lat: res.fix.lat, lng: res.fix.lng });
  }, []);

  const load = useCallback(async () => {
    const [openRes, mineRes] = await Promise.all([
      supabase
        .from("emergency_service_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("emergency_service_requests")
        .select("*")
        .eq("assigned_provider_id", userId)
        .in("status", ["en_route", "on_scene"])
        .order("created_at", { ascending: false }),
    ]);
    const openRows = (openRes.data as EmergencyServiceRequest[] | null) ?? [];
    const mineRows = (mineRes.data as EmergencyServiceRequest[] | null) ?? [];
    if (primed.current) {
      const fresh = openRows.filter((r) => !knownIds.current.has(r.id));
      if (fresh.length > 0) {
        playSonarPing("alert");
        try {
          navigator.vibrate?.([80, 40, 80, 40, 120]);
        } catch {
          /* haptic is optional */
        }
        setFlash(true);
        window.setTimeout(() => setFlash(false), 2800);
      }
    }
    knownIds.current = new Set([...openRows, ...mineRows].map((r) => r.id));
    primed.current = true;
    setPending(openRows);
    setMine(mineRows);
  }, [userId]);

  useEffect(() => {
    void locate();
    void load();
    const ch = supabase
      .channel(`esr-radar:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emergency_service_requests" },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, load, locate]);

  const accept = async (row: EmergencyServiceRequest) => {
    if (acceptingId) return;
    setAcceptingId(row.id);
    const { error } = await supabase.rpc("accept_emergency_request", { _id: row.id });
    setAcceptingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!origin) await locate();
    requestMapFocus({ lat: row.lat, lng: row.lng, zoom: 14, label: row.vessel_name || row.bay_name || undefined });
    toast.success(t("esvc.accepted"));
    void load();
  };

  const active = mine[0] ?? null;
  const route: LiveRoute[] =
    active && origin && isValidCoordinate(active.lat, active.lng)
      ? [{ id: active.id, from: origin, to: { lat: active.lat, lng: active.lng } }]
      : [];

  return (
    <section
      className={
        "space-y-3 rounded-2xl border p-3 transition-shadow " +
        (flash
          ? "border-red-400/70 bg-red-500/10 shadow-[0_0_40px_-8px_rgba(239,68,68,0.7)]"
          : "border-cyan-400/20 bg-white/[0.02]")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
            {t("esvc.radar_eyebrow")}
          </p>
          <h2 className="text-sm font-semibold text-white">{t("esvc.radar_title")}</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
            <span className="relative size-1.5 rounded-full bg-emerald-400" />
          </span>
          LIVE
        </span>
      </div>

      {active && route.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-cyan-400/25">
          <LiveMap
            providers={[]}
            routes={route}
            center={{ lat: active.lat, lng: active.lng }}
            height={220}
            variant="dark"
            hud={false}
          />
        </div>
      )}

      {pending.length === 0 && mine.length === 0 ? (
        <GlassPanel className="text-sm text-white/50">{t("esvc.radar_empty")}</GlassPanel>
      ) : (
        <ul className="space-y-2">
          {mine.map((row) => (
            <li key={row.id}>
              <CallCard
                row={row}
                origin={origin}
                assigned
                busy={false}
                onAccept={() => undefined}
              />
            </li>
          ))}
          {pending.map((row) => (
            <li key={row.id}>
              <CallCard
                row={row}
                origin={origin}
                assigned={false}
                busy={acceptingId === row.id}
                onAccept={() => void accept(row)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CallCard({
  row,
  origin,
  assigned,
  busy,
  onAccept,
}: {
  row: EmergencyServiceRequest;
  origin: { lat: number; lng: number } | null;
  assigned: boolean;
  busy: boolean;
  onAccept: () => void;
}) {
  const { t } = useTranslation();
  const eta =
    origin && isValidCoordinate(row.lat, row.lng)
      ? calculateMarineEta({ lat: row.lat, lng: row.lng }, origin)
      : null;

  return (
    <article className="rounded-2xl border border-white/10 bg-[#0A192F]/80 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {row.vessel_name || t("esvc.unnamed_vessel")}
          </p>
          <p className="mt-0.5 text-[12px] text-cyan-200/90">
            {t(EMERGENCY_CATEGORY_LABEL_KEYS[row.category])}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-white/50">
            {row.bay_name ? `⚓ ${row.bay_name}` : t("esvc.open_water")}
          </p>
        </div>
        <span
          className={
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] " +
            (row.urgency_level === "urgent"
              ? "border-red-400/40 bg-red-500/15 text-red-200"
              : "border-amber-400/30 bg-amber-400/10 text-amber-100")
          }
        >
          {t(`esvc.urgency_${row.urgency_level}`)}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="font-mono text-[12px] text-cyan-100">{eta?.label ?? t("esvc.eta_waiting_fix")}</p>
        {assigned ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
            <Ship className="size-3.5" />
            {t("esvc.status_en_route")}
          </span>
        ) : (
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-cyan-400 px-3 text-[11px] font-black uppercase tracking-wider text-[#0A192F] disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Radio className="size-3.5" />}
            {t("esvc.accept")}
          </button>
        )}
      </div>
      {row.description ? (
        <p className="mt-2 line-clamp-2 text-[12px] text-white/55">{row.description}</p>
      ) : null}
    </article>
  );
}
