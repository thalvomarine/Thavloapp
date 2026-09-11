import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { createRealtimeBuffer } from "@/lib/schedule";
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
      sos: [] as Array<{ id?: string; vessel_name?: string; category?: string }>,
    };
    const flush = createRealtimeBuffer(() => {
      const translate = tRef.current;
      const firstJob = pending.jobs[0];
      const firstSos = pending.sos[0];
      const jobCount = pending.jobs.length;
      const sosCount = pending.sos.length;
      pending.jobs = [];
      pending.sos = [];

      if (firstJob) {
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
        notifyIncomingJob({
          kind: "sos",
          tag: firstSos.id,
          title:
            sosCount > 1
              ? translate("ops_alerts.sos_burst_title", { count: sosCount })
              : translate("ops_alerts.sos_title"),
          body:
            sosCount > 1
              ? translate("ops_alerts.sos_burst_body")
              : translate("ops_alerts.sos_body", {
                  vessel: firstSos.vessel_name || translate("esvc.unnamed_vessel"),
                }),
        });
      }
    }, 220);

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
          const row = payload.new as { id?: string; vessel_name?: string; category?: string };
          pending.sos.push({ id: row.id, vessel_name: row.vessel_name, category: row.category });
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
