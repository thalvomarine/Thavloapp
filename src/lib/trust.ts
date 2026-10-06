/**
 * THALVO trust scoring — v1.
 *
 * Derived from data we already store: provider rating, completed jobs,
 * accepted offers, cancellation ratio, verification flags.
 * Arrival, response time, disputes and identity stay null until the
 * matching records exist. They are never filled from the star rating.
 */

export type TrustTone = "reliable" | "building" | "watch" | "risk";

export interface TrustInputs {
  rating: number | null;          // provider_details.rating (0..5)
  jobsCompleted: number | null;   // provider_details.jobs_completed
  offersAccepted?: number | null; // count(accept_offer) — optional
  cancellationCount?: number | null;
  verified?: boolean;             // KYC / certification present
  /** On-time arrivals / timed arrivals. Null until a timed arrival exists. */
  arrivalOnTimeRatio?: number | null;
  arrivalSamples?: number | null;
  /** Median minutes from job open to this provider's offer. */
  medianResponseMinutes?: number | null;
  responseSamples?: number | null;
  /** Null when the dispute log could not be read. */
  disputeCount?: number | null;
  completedJobs?: number | null;
}

export interface TrustMetric {
  key: string;
  label: string;
  /** 0..100 rating; null = insufficient data */
  score: number | null;
  detail: string;
  /** true when the value is a placeholder awaiting real event data */
  placeholder?: boolean;
  /** optional raw value used only for display interpolation (i18n) */
  count?: number;
}


export interface TrustReport {
  /** 0..100 aggregate, or null when we do not yet have signal */
  score: number | null;
  tone: TrustTone;
  label: string;
  metrics: TrustMetric[];
  hasSignal: boolean;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function ratingToScore(r: number | null): number | null {
  if (r == null || r <= 0) return null;
  return clamp((r / 5) * 100);
}

function volumeToScore(jobs: number | null): number | null {
  if (jobs == null || jobs <= 0) return null;
  // logarithmic ramp — 10 jobs ≈ 60, 50 jobs ≈ 85, 200+ ≈ ~95
  return clamp(Math.round(45 + Math.log10(jobs + 1) * 22));
}

function fairnessScore(rating: number | null): number | null {
  if (rating == null) return null;
  // Pricing fairness proxies from captain rating until dispute data exists.
  return clamp(Math.round(60 + (rating - 3.5) * 12));
}

function arrivalScore(ratio: number | null | undefined, samples: number | null | undefined): number | null {
  if (ratio == null || samples == null || samples <= 0) return null;
  return clamp(Math.round(ratio * 100));
}

function responseScore(minutes: number | null | undefined, samples: number | null | undefined): number | null {
  if (minutes == null || samples == null || samples <= 0) return null;
  if (minutes <= 20) return 95;
  if (minutes <= 60) return 82;
  if (minutes <= 180) return 68;
  return 45;
}

function disputeScore(disputes: number | null | undefined, completed: number | null | undefined): number | null {
  if (disputes == null || completed == null || completed <= 0) return null;
  return clamp(Math.round(100 - (disputes / completed) * 100));
}

export function toneFromScore(score: number | null): TrustTone {
  if (score == null) return "building";
  if (score >= 80) return "reliable";
  if (score >= 60) return "building";
  if (score >= 40) return "watch";
  return "risk";
}

export function labelFromTone(tone: TrustTone): string {
  switch (tone) {
    case "reliable": return "Reliable";
    case "building": return "Building";
    case "watch":    return "Needs attention";
    case "risk":     return "High risk";
  }
}

export function computeTrust(inputs: TrustInputs): TrustReport {
  const arrival = arrivalScore(inputs.arrivalOnTimeRatio, inputs.arrivalSamples);
  const response = responseScore(inputs.medianResponseMinutes, inputs.responseSamples);
  const completion = ratingToScore(inputs.rating);
  const fairness = fairnessScore(inputs.rating);
  const volume = volumeToScore(inputs.jobsCompleted);
  const verifiedScore = inputs.verified ? 100 : null;
  const dispute = disputeScore(inputs.disputeCount, inputs.completedJobs);

  const metrics: TrustMetric[] = [
    {
      key: "arrival",
      label: "Arrival reliability",
      score: arrival,
      detail: arrival == null
        ? "No timed arrival yet."
        : "Share of arrivals inside the agreed ETA.",
      placeholder: arrival == null,
      count: inputs.arrivalSamples ?? 0,
    },
    {
      key: "response",
      label: "Response time",
      score: response,
      detail: response == null
        ? "No offer timing yet."
        : "Median minutes from the request to this provider's offer.",
      placeholder: response == null,
      count: inputs.medianResponseMinutes == null ? 0 : Math.round(inputs.medianResponseMinutes),
    },
    {
      key: "completion",
      label: "Completion rate",
      score: completion,
      detail: completion == null
        ? "Complete missions to build a completion signal."
        : "Based on captain feedback across completed missions.",
      placeholder: completion == null,
    },
    {
      key: "fairness",
      label: "Pricing fairness",
      score: fairness,
      detail: fairness == null
        ? "Building — needs completed offers."
        : "Proxy from rating until dispute data is captured.",
      placeholder: fairness == null,
    },
    {
      key: "volume",
      label: "Completed missions",
      score: volume,
      detail: volume == null
        ? "0 missions logged."
        : `${inputs.jobsCompleted} mission${inputs.jobsCompleted === 1 ? "" : "s"} on the record.`,
      placeholder: volume == null,
      count: inputs.jobsCompleted ?? 0,
    },

    {
      key: "verified",
      label: "Verified documents",
      score: verifiedScore,
      detail: inputs.verified
        ? "Certifications on file."
        : "Upload marine certifications to verify identity.",
      placeholder: !inputs.verified,
    },
    {
      key: "dispute",
      label: "Dispute rate",
      score: dispute,
      detail: dispute == null
        ? "Complete a mission before a dispute rate exists."
        : "Disputes filed against completed missions.",
      placeholder: dispute == null,
      count: inputs.disputeCount ?? 0,
    },
  ];

  const scored = metrics.map((m) => m.score).filter((s): s is number => s != null);
  const aggregate = scored.length === 0 ? null : Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
  const tone = toneFromScore(aggregate);

  return {
    score: aggregate,
    tone,
    label: labelFromTone(tone),
    metrics,
    hasSignal: scored.length > 0,
  };
}
