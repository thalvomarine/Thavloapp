import { Check, Loader2 } from "lucide-react";

export type EscrowStage =
  | "offer_selected"
  | "funds_pending"
  | "funds_secured"
  | "provider_arrived"
  | "extra_requested"
  | "captain_approved"
  | "work_completed"
  | "funds_released"
  | "commission_recorded";

export interface EscrowStageEntry {
  key: EscrowStage;
  label: string;
  hint?: string;
}

const DEFAULT_STAGES: EscrowStageEntry[] = [
  { key: "offer_selected",      label: "Offer selected",       hint: "Captain accepted a provider bid." },
  { key: "funds_pending",       label: "Funds pending",        hint: "Awaiting payment authorization." },
  { key: "funds_secured",       label: "Funds held by THALVO", hint: "Held in escrow. Not released to provider yet." },
  { key: "provider_arrived",    label: "Provider arrived",     hint: "On-site at the vessel." },
  { key: "extra_requested",     label: "Extra cost requested", hint: "Additional parts pending captain approval." },
  { key: "captain_approved",    label: "Captain approved",     hint: "Extra amount added to escrow pool." },
  { key: "work_completed",      label: "Work completed",       hint: "Captain confirmed the mission." },
  { key: "funds_released",      label: "Funds released",       hint: "Payout transferred to provider wallet." },
  { key: "commission_recorded", label: "Commission recorded",  hint: "THALVO platform ledger updated." },
];

interface Props {
  currentIndex: number;
  reachedFlags?: Partial<Record<EscrowStage, boolean>>;
  stages?: EscrowStageEntry[];
  className?: string;
}

/**
 * PaymentTimeline — vertical operational escrow ledger.
 * currentIndex: 0..stages.length-1  (stages ≤ index are DONE, > index are TODO, === index is CURRENT).
 * reachedFlags: optional map to skip conditional stages (e.g. "extra_requested" only if parts exist).
 */
export function PaymentTimeline({ currentIndex, reachedFlags, stages = DEFAULT_STAGES, className = "" }: Props) {
  const visible = stages.filter((s) => (reachedFlags ? reachedFlags[s.key] !== false : true));
  return (
    <ol className={"relative " + className}>
      {visible.map((s, i) => {
        const state: "done" | "current" | "todo" =
          i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
        return (
          <li key={s.key} className="relative pl-8 pb-4 last:pb-0">
            {i < visible.length - 1 && (
              <span
                aria-hidden
                className={
                  "absolute left-[11px] top-6 bottom-0 w-px " +
                  (state === "done" ? "bg-sky-400/40" : "bg-white/10")
                }
              />
            )}
            <span
              className={
                "absolute left-0 top-0.5 size-6 rounded-full grid place-items-center border " +
                (state === "done"
                  ? "bg-sky-400/15 border-sky-400/40 text-sky-300"
                  : state === "current"
                    ? "bg-sky-400 border-sky-300 text-slate-900 shadow-[0_0_18px_theme(colors.sky.400)]"
                    : "bg-white/5 border-white/10 text-white/30")
              }
            >
              {state === "done" ? (
                <Check className="size-3" />
              ) : state === "current" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>
            <p
              className={
                "text-[11px] font-semibold uppercase tracking-[0.14em] " +
                (state === "todo" ? "text-white/40" : state === "current" ? "text-sky-300" : "text-white/80")
              }
            >
              {s.label}
            </p>
            {s.hint && (
              <p className={"text-[11px] mt-0.5 " + (state === "todo" ? "text-white/30" : "text-white/60")}>
                {s.hint}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Derive PaymentTimeline props from Supabase job + parts state.
 * NOTE: real Stripe/escrow integration not yet wired — this reflects logical state
 * from `jobs.status`, `jobs.total_escrow_pool`, and `job_parts.payment_status`.
 * TODO(payments): swap with real escrow ledger events once Stripe Connect + payment_intents land.
 */
export function deriveEscrow(job: { status: string; total_escrow_pool: number; extra_parts_cost: number }, parts: { payment_status: string }[]) {
  const hasPendingPart = parts.some((p) => p.payment_status === "Pending");
  const hasApprovedPart = parts.some((p) => p.payment_status === "Paid");
  const hasExtras = hasPendingPart || hasApprovedPart;

  const reached: Partial<Record<EscrowStage, boolean>> = {
    offer_selected: true,
    funds_pending: true,
    funds_secured: true,
    provider_arrived: true,
    extra_requested: hasExtras,
    captain_approved: hasExtras,
    work_completed: true,
    funds_released: true,
    commission_recorded: true,
  };

  let idx = 0;
  switch (job.status) {
    case "Pending":
      idx = 0; break; // waiting for captain to accept
    case "Accepted":
      idx = 2; break; // funds secured (accept_offer RPC + CheckoutModal)
    case "EnRoute":
      idx = 2; break; // still secured, en route
    case "OnSite":
      idx = 3; break; // provider arrived
    case "PartsPending":
      idx = 4; break; // extra requested
    case "InProgress":
      idx = hasExtras ? 5 : 3; break; // captain approved (or working after arrival)
    case "Completed":
      idx = 8; break; // commission recorded
    default:
      idx = 0;
  }

  // If we skip stages (e.g. no extras), the visible index still needs to be the
  // position within the *filtered* list. Rebuild it here.
  const visibleKeys = DEFAULT_STAGES.filter((s) => reached[s.key] !== false).map((s) => s.key);
  const originalKey = DEFAULT_STAGES[idx]?.key ?? "offer_selected";
  const currentIndex = Math.max(0, visibleKeys.indexOf(originalKey));

  return { currentIndex, reachedFlags: reached };
}
