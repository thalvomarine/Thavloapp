import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { createRealtimeBuffer } from "@/lib/schedule";
import { asCoordinate } from "@/lib/emergency-service";
import { formatDegrees } from "@/lib/marine-data";
import { requestMapFocus } from "@/lib/map-focus-bus";
import { notifyIncomingJob, requestOpsNotificationPermission } from "@/lib/ops-alerts";

/** Realtime job + SOS alerts for online divers / technicians. */
export function useOpsAlerts(enabled: boolean) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!enabled) return;
    void requestOpsNotificationPermission();
    const pending = {
      jobs: [] as Array<{ id?: string; problem_category?: string }>,
      sos: [] as Array<{
        id?: string;
        vessel_name?: string;
        category?: string;
        urgency?: string;
        lat?: number;
        lng?: number;
      }>,
    };
    const flush = createRealtimeBuffer(() => {
      const translate = tRef.current;
      const firstJob = pending.jobs[0];
      const firstSos = pending.sos[0];
      const jobCount = pending.jobs.length;
      const sosCount = pending.sos.length;
      const located = pending.sos.find((row) => row.lat != null && row.lng != null);
      const seenIds = pending.sos.map((row) => row.id).filter((id): id is string => Boolean(id));
      if (seenIds.length > 0) {
        const seen = new Set((sessionStorage.getItem("thalvo:seen-sos") ?? "").split(",").filter(Boolean));
        seenIds.forEach((id) => seen.add(id));
        sessionStorage.setItem("thalvo:seen-sos", [...seen].slice(-40).join(","));
      }
      pending.jobs = [];
      pending.sos = [];

      if (located?.lat != null && located.lng != null) {
        requestMapFocus({
          lat: located.lat,
          lng: located.lng,
          zoom: 15,
          label: located.vessel_name,
        });
      }

      if (firstJob && sosCount === 0) {
        notifyIncomingJob({
          kind: "job",
          tag: firstJob.id,
          title:
            jobCount > 1
              ? translate("ops_alerts.job_burst_title", { count: jobCount })
              : translate("ops_alerts.job_title"),
          body:
            jobCount > 1
              ? translate("ops_alerts.job_burst_body")
              : translate("ops_alerts.job_body", {
                  category: firstJob.problem_category ?? translate("ops_alerts.unknown_job"),
                }),
        });
      }
      if (firstSos) {
        const position =
          firstSos.lat != null && firstSos.lng != null
            ? formatDegrees(firstSos.lat, firstSos.lng)
            : null;
        const fault = firstSos.urgency === "standard";
        notifyIncomingJob({
          kind: fault ? "job" : "sos",
          tag: firstSos.id,
          title:
            sosCount > 1
              ? translate(fault ? "ops_alerts.fault_burst_title" : "ops_alerts.sos_burst_title", {
                  count: sosCount,
                })
              : translate(fault ? "ops_alerts.fault_title" : "ops_alerts.sos_title"),
          body:
            sosCount > 1
              ? translate("ops_alerts.sos_burst_body")
              : position
                ? translate(fault ? "ops_alerts.fault_body_at" : "ops_alerts.sos_body_at", {
                    vessel: firstSos.vessel_name || translate("esvc.unnamed_vessel"),
                    category: firstSos.category ?? translate("ops_alerts.unknown_job"),
                    position,
                  })
                : translate("ops_alerts.sos_body", {
                    vessel: firstSos.vessel_name || translate("esvc.unnamed_vessel"),
                  }),
        });
      }
    }, 220);

    void supabase
      .from("emergency_service_requests")
      .select("id, vessel_name, category, urgency_level, lat, lng")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        const seen = new Set((sessionStorage.getItem("thalvo:seen-sos") ?? "").split(",").filter(Boolean));
        let fresh = false;
        for (const row of data ?? []) {
          if (!row.id || seen.has(row.id)) continue;
          seen.add(row.id);
          fresh = true;
          pending.sos.push({
            id: row.id,
            vessel_name: row.vessel_name,
            category: row.category,
            urgency: row.urgency_level,
            lat: asCoordinate(row.lat) ?? undefined,
            lng: asCoordinate(row.lng) ?? undefined,
          });
        }
        sessionStorage.setItem("thalvo:seen-sos", [...seen].slice(-40).join(","));
        if (fresh) flush.ping();
      });

    const ch = supabase
      .channel("ops-alerts-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs" },
        (payload) => {
          const row = payload.new as { id?: string; status?: string; problem_category?: string };
          if (row.status && row.status !== "Pending") return;
          pending.jobs.push({ id: row.id, problem_category: row.problem_category });
          flush.ping();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emergency_service_requests" },
        (payload) => {
          const row = payload.new as {
            id?: string;
            vessel_name?: string;
            category?: string;
            urgency_level?: string;
            lat?: unknown;
            lng?: unknown;
          };
          const lat = asCoordinate(row.lat);
          const lng = asCoordinate(row.lng);
          pending.sos.push({
            id: row.id,
            vessel_name: row.vessel_name,
            category: row.category,
            urgency: row.urgency_level,
            lat: lat ?? undefined,
            lng: lng ?? undefined,
          });
          flush.ping();
        },
      )
      .subscribe();

    return () => {
      flush.dispose();
      supabase.removeChannel(ch);
    };
  }, [enabled]);
}
