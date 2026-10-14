import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, MapPin, Radio, Radar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
    <section className="thalvo-chart-sheet space-y-3 overflow-hidden rounded-2xl border p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--sheet-active-ink)" }}
          >
            <Radar className="size-3.5 shrink-0" />
            {t("ops_alerts.pool_title")}
          </p>
          <p className="mt-1 text-[12px] leading-snug" style={{ color: "var(--sheet-muted)" }}>
            {jobs.length > 0
              ? `${jobs.length}`
              : t("ops_alerts.pool_empty")}
          </p>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
          style={{
            borderColor: "var(--sheet-active-border)",
            background: "var(--sheet-active-bg)",
            color: "var(--sheet-active-ink)",
          }}
        >
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative size-1.5 rounded-full bg-emerald-400" />
          </span>
          {jobs.length}
        </span>
      </div>

      {jobs.length === 0 ? (
        <div
          className="rounded-xl border px-3 py-4 text-center text-[12px] leading-relaxed"
          style={{
            borderColor: "var(--sheet-border)",
            background: "var(--sheet-chip)",
            color: "var(--sheet-muted)",
          }}
        >
          {t("ops_alerts.pool_empty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <article
                className="rounded-xl border px-3 py-3 transition-colors"
                style={{
                  borderColor: "var(--sheet-border)",
                  background: "var(--sheet-chip)",
                }}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--sheet-ink)" }}>
                  {t(`problems.${job.problem_category}`, { defaultValue: job.problem_category })}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: "var(--sheet-muted)" }}>
                  <MapPin className="size-3 shrink-0" style={{ color: "var(--sheet-active-ink)" }} />
                  <span className="truncate">
                    {job.profiles?.full_name ?? "—"}
                    {job.profiles?.boat_name ? ` · ${job.profiles.boat_name}` : ""}
                    {job.marina ? ` · ${job.marina}` : ""}
                  </span>
                </p>
                <p
                  className="mt-1 font-mono text-[10px] tabular-nums"
                  style={{ color: "var(--sheet-active-ink)" }}
                >
                  {formatDegrees(Number(job.lat), Number(job.lng))}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Link
                    to="/app/job/$id"
                    params={{ id: job.id }}
                    className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: "var(--sheet-active-ink)" }}
                  >
                    {t("ops_alerts.open")}
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === job.id}
                    onClick={() => void claim(job.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[11px] font-black uppercase tracking-wider disabled:opacity-50"
                    style={{
                      background: "#f5b942",
                      color: "#0a192f",
                    }}
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
