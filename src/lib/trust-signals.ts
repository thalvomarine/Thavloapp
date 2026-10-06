import { supabase } from "@/integrations/supabase/client";
import type { TrustInputs } from "@/lib/trust";

interface SignalPayload {
  completed_jobs?: number;
  dispute_count?: number;
  arrival_samples?: number;
  arrival_on_time?: number;
  response_samples?: number;
  median_response_minutes?: number | null;
  verified?: boolean;
}

/** Aggregates a provider's trust inputs. Falls back to the profile row if the RPC is not deployed yet. */
export async function loadTrustSignals(providerId: string): Promise<TrustInputs> {
  const { data: details } = await supabase
    .from("provider_details")
    .select("rating, jobs_completed, certification_url")
    .eq("id", providerId)
    .maybeSingle();

  const base: TrustInputs = {
    rating: details?.rating ?? null,
    jobsCompleted: details?.jobs_completed ?? null,
    verified: Boolean(details?.certification_url),
  };

  const { data, error } = await supabase.rpc("provider_trust_signals", { _provider: providerId });
  if (error || !data || typeof data !== "object") return base;

  const row = data as SignalPayload;
  const samples = row.arrival_samples ?? 0;
  const onTime = row.arrival_on_time ?? 0;
  return {
    ...base,
    verified: Boolean(row.verified) || base.verified,
    arrivalSamples: samples,
    arrivalOnTimeRatio: samples > 0 ? onTime / samples : null,
    responseSamples: row.response_samples ?? 0,
    medianResponseMinutes: row.median_response_minutes ?? null,
    disputeCount: row.dispute_count ?? null,
    completedJobs: row.completed_jobs ?? null,
    jobsCompleted: details?.jobs_completed ?? row.completed_jobs ?? null,
  };
}
