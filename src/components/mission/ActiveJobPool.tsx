import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { formatDegrees } from "@/lib/marine-data";
import { createRealtimeBuffer, runWhenIdle } from "@/lib/schedule";

interface OpenJob {
  id: string;
  problem_category: string;
  description: string;
  marina: string;
  lat: number;
  lng: number;
  service_type: string;
  total_escrow_pool: number | null;
  profiles: { full_name: string; boat_name: string | null } | null;
}

interface Props {
  userId: string;
}

/** Pending job pool for divers / technicians — realtime + claim. */
export function ActiveJobPool({ userId }: Props) {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<OpenJob[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("jobs")
      .select(
        "id, problem_category, description, marina, lat, lng, service_type, total_escrow_pool, profiles!jobs_client_id_fkey(full_name, boat_name)",
      )
      .eq("status", "Pending")
      .is("provider_id", null)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) {
      console.warn("[job-pool]", error.message);
      setJobs([]);
      return;
    }
    setJobs((data as unknown as OpenJob[]) ?? []);
  }, []);

  useEffect(() => {
    const stopIdle = runWhenIdle(() => {
      void load();
    }, 900);
    const buffer = createRealtimeBuffer(() => {
      void load();
    }, 180);
    const ch = supabase
      .channel(`job-pool:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => buffer.ping())
      .subscribe();
    return () => {
      stopIdle();
      buffer.dispose();
      supabase.removeChannel(ch);
    };
  }, [userId, load]);

  const claim = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("claim_open_job", { _job_id: id });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("ops_alerts.claimed"));
    void load();
  };

  return (
    <section className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
        {t("ops_alerts.pool_title")}
      </p>
      {jobs.length === 0 ? (
        <GlassPanel className="text-sm text-white/50">{t("ops_alerts.pool_empty")}</GlassPanel>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <article className="rounded-2xl border border-cyan-400/20 bg-[#0A192F]/85 px-3 py-3">
                <p className="text-sm font-semibold text-white">
                  {t(`problems.${job.problem_category}`, { defaultValue: job.problem_category })}
                </p>
                <p className="mt-0.5 text-[11px] text-white/55">
                  {job.profiles?.full_name ?? "—"}
                  {job.profiles?.boat_name ? ` · ${job.profiles.boat_name}` : ""}
                  {job.marina ? ` · ${job.marina}` : ""}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-cyan-100/80">
                  {formatDegrees(Number(job.lat), Number(job.lng))}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Link
                    to="/app/job/$id"
                    params={{ id: job.id }}
                    className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200/80"
                  >
                    {t("ops_alerts.open")}
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === job.id}
                    onClick={() => void claim(job.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-cyan-400 px-3 text-[11px] font-black uppercase tracking-wider text-[#0A192F] disabled:opacity-50"
                  >
                    {busyId === job.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Radio className="size-3.5" />
                    )}
                    {t("ops_alerts.accept")}
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
