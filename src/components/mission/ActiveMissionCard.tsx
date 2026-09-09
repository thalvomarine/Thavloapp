import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Anchor, Wrench, ArrowUpRight, Clock, Radio } from "lucide-react";
import { GlassPanel } from "./GlassPanel";
import { MissionStatusTrack, stageFromJob, type MissionStage } from "./MissionStatusTrack";

interface ActiveJob {
  id: string;
  problem_category: string;
  service_type: string;
  status: string;
  marina: string;
  dispatched_at: string | null;
  eta_minutes: number | null;
}

interface Props {
  job: ActiveJob;
  problemLabel: string;
}

const STAGE_COPY: Record<MissionStage, { title: string; sub: string }> = {
  draft:        { title: "Preparing SOS",        sub: "Draft ready to publish." },
  broadcasting: { title: "Broadcasting SOS",     sub: "Reaching every certified responder within range…" },
  offers:       { title: "Offers incoming",      sub: "Review responders and pick who arrives fastest." },
  selected:     { title: "Responder dispatched", sub: "Standby — your responder is preparing to depart." },
  en_route:     { title: "Responder en route",   sub: "Tracking arrival on your live chart." },
  started:      { title: "Work in progress",     sub: "Diagnosis underway. Chat is live on the mission page." },
  completed:    { title: "Mission complete",     sub: "Nice sail. Rate your responder on the mission page." },
};

/**
 * Active Mission cockpit card. Lives at the top of /app when the captain
 * has an in-flight mission. Owns its own realtime offer count.
 */
export function ActiveMissionCard({ job, problemLabel }: Props) {
  const [offerCount, setOfferCount] = useState(0);
  const isDiver = job.service_type === "Underwater Diver";
  const stage = stageFromJob(job.status, offerCount);
  const copy = STAGE_COPY[stage];

  useEffect(() => {
    if (job.status !== "Pending") { setOfferCount(0); return; }
    const load = () => supabase.from("job_offers").select("id", { count: "exact", head: true }).eq("job_id", job.id)
      .then(({ count }) => setOfferCount(count ?? 0));
    load();
    const ch = supabase.channel(`mc-offers:${job.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_offers", filter: `job_id=eq.${job.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [job.id, job.status]);

  const etaLeft = (() => {
    if (stage !== "en_route" || !job.dispatched_at || !job.eta_minutes) return null;
    return Math.max(0, job.eta_minutes - Math.floor((Date.now() - new Date(job.dispatched_at).getTime()) / 60000));
  })();

  return (
    <Link
      to="/app/job/$id"
      params={{ id: job.id }}
      className="block mission-rise"
    >
      <GlassPanel padded={false} className="overflow-hidden">
        {/* Header row */}
        <div className="p-4 flex items-start gap-3">
          <span className={"size-11 rounded-xl grid place-items-center " + (isDiver
            ? "bg-cyan-500/15 border border-cyan-400/30 text-cyan-300"
            : "bg-sky-500/15 border border-sky-400/30 text-sky-300")}>
            {isDiver ? <Anchor className="size-5" /> : <Wrench className="size-5" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/90 inline-flex items-center gap-1.5">
                <span className="relative flex size-1.5">
                  <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-70" />
                  <span className="relative size-1.5 rounded-full bg-rose-400" />
                </span>
                Active mission
              </p>
              {stage === "en_route" && etaLeft !== null && (
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300 inline-flex items-center gap-1">
                  <Clock className="size-3" /> ETA {etaLeft} min
                </span>
              )}
              {stage === "offers" && offerCount > 0 && (
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300 inline-flex items-center gap-1">
                  <Radio className="size-3" /> {offerCount} offer{offerCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white mt-1 truncate">{problemLabel}</p>
            <p className="text-[11px] text-white/50 mt-0.5">📍 {job.marina}</p>
          </div>
          <ArrowUpRight className="size-4 text-white/40 shrink-0 mt-1" />
        </div>

        {/* Stage copy */}
        <div className="px-4 pb-3">
          <p className="text-[13px] text-white/80">{copy.title}</p>
          <p className="text-[11px] text-white/50 mt-0.5">{copy.sub}</p>
        </div>

        {/* Status track */}
        <div className="border-t border-white/[0.06] px-4 py-3 bg-white/[0.02]">
          <MissionStatusTrack stage={stage} />
        </div>
      </GlassPanel>
    </Link>
  );
}
