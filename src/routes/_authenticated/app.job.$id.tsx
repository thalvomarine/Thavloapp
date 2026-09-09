import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MockMap, type MapPin } from "@/components/MockMap";
import { CheckoutModal } from "@/components/CheckoutModal";
import { JobChat } from "@/components/JobChat";
import { useProfile, useSessionUser } from "@/lib/session";
import { formatTL, harborDistanceKm, kmToNm } from "@/lib/filter";
import {
  AlertOctagon,
  Anchor,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin as PinIcon,
  Package,
  Send,
  Star,
  Wrench,
} from "lucide-react";
import { MissionStatusTrack, stageFromJob } from "@/components/mission/MissionStatusTrack";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { OfferCard } from "@/components/mission/OfferCard";
import { EscrowPanel, type EscrowUiState } from "@/components/mission/EscrowPanel";
import { PaymentTimeline, deriveEscrow } from "@/components/mission/PaymentTimeline";
import { TrustExplanationSheet } from "@/components/trust/TrustExplanationSheet";
import { computeTrust } from "@/lib/trust";
import { emitEvent } from "@/lib/events";
import {
  PaymentIntentPanel,
  type PaymentIntentRow,
} from "@/components/payments/PaymentIntentPanel";
import { EscrowLedgerPanel, type EscrowLedgerRow } from "@/components/payments/EscrowLedgerPanel";
import {
  ProviderPayoutPanel,
  type ProviderPayoutRow,
} from "@/components/payments/ProviderPayoutPanel";
import { CommissionBreakdown } from "@/components/payments/CommissionBreakdown";
import { computeCommission, readCompleteJobResult } from "@/lib/payments";
import { sanitizePlainText } from "@/lib/sanitize";

export const Route = createFileRoute("/_authenticated/app/job/$id")({
  ssr: false,
  component: JobPage,
});

interface Job {
  id: string;
  client_id: string;
  provider_id: string | null;
  service_type: "Marine Mechanic" | "Underwater Diver";
  problem_category: string;
  description: string;
  marina: string;
  lat: number;
  lng: number;
  status: string;
  initial_labor_cost: number;
  extra_parts_cost: number;
  total_escrow_pool: number;
  eta_minutes: number | null;
  dispatched_at: string | null;
}
interface Offer {
  id: string;
  provider_id: string;
  price: number;
  eta_minutes: number;
  note: string | null;
  profiles: { full_name: string } | null;
  provider_details: {
    rating: number;
    lat: number | null;
    lng: number | null;
    service_type: string;
    jobs_completed: number | null;
    certification_url: string | null;
  } | null;
}
interface Part {
  id: string;
  part_name: string;
  part_price: number;
  part_image_url: string | null;
  source: string;
  payment_status: "Pending" | "Paid" | "Rejected";
}

function JobPage() {
  const { id } = Route.useParams();
  const { user } = useSessionUser();
  const { profile } = useProfile(user?.id);
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    const load = () =>
      supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle()
        .then(({ data }) => setJob((data as Job) ?? null));
    load();
    const ch = supabase
      .channel(`job:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `id=eq.${id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id]);

  if (!user || !profile || !job) {
    return (
      <div className="min-h-dvh grid place-items-center bg-deep text-white">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  const isClient = profile.role === "Client";
  return (
    <AppShell userId={user.id}>
      {isClient ? <ClientJob job={job} meId={user.id} /> : <ProviderJob job={job} meId={user.id} />}
    </AppShell>
  );
}

/* ---------------- CLIENT ---------------- */
function ClientJob({ job, meId }: { job: Job; meId: string }) {
  const { t } = useTranslation();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [checkout, setCheckout] = useState<
    { kind: "offer"; offer: Offer } | { kind: "part"; part: Part } | null
  >(null);
  const [tick, setTick] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [trustFor, setTrustFor] = useState<Offer | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (job.status !== "Pending") {
      setOffers([]);
      return;
    }
    const load = async () => {
      const { data, error } = await supabase
        .from("job_offers")
        .select(
          "id, provider_id, price, eta_minutes, note, profiles!job_offers_provider_id_fkey(full_name)",
        )
        .eq("job_id", job.id)
        .order("price");

      if (error) {
        console.warn("[offers] captain offer query failed", {
          jobId: job.id,
          table: "job_offers",
          message: error.message,
        });
        setOffers([]);
        return;
      }

      const rows = (data ?? []) as Array<Omit<Offer, "provider_details">>;
      const providerIds = Array.from(new Set(rows.map((offer) => offer.provider_id)));
      let detailsByProvider = new Map<string, Offer["provider_details"]>();

      if (providerIds.length > 0) {
        const { data: details, error: detailsError } = await supabase
          .from("provider_details")
          .select("id, rating, lat, lng, service_type, jobs_completed, certification_url")
          .in("id", providerIds);

        if (detailsError) {
          console.warn("[offers] provider metadata unavailable", {
            jobId: job.id,
            message: detailsError.message,
          });
        } else {
          detailsByProvider = new Map(
            (details ?? []).map((detail) => [
              detail.id,
              {
                rating: detail.rating,
                lat: detail.lat,
                lng: detail.lng,
                service_type: detail.service_type,
                jobs_completed: detail.jobs_completed,
                certification_url: detail.certification_url,
              },
            ]),
          );
        }
      }

      setOffers(
        rows.map((offer) => ({
          ...offer,
          provider_details: detailsByProvider.get(offer.provider_id) ?? null,
        })),
      );
    };
    load();
    const ch = supabase
      .channel(`offers:${job.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_offers", filter: `job_id=eq.${job.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [job.id, job.status]);

  useEffect(() => {
    const load = () =>
      supabase
        .from("job_parts")
        .select("*")
        .eq("job_id", job.id)
        .order("created_at")
        .then(({ data }) => setParts((data as never) ?? []));
    load();
    const ch = supabase
      .channel(`parts:${job.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_parts", filter: `job_id=eq.${job.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [job.id]);

  // M9 payment/escrow rows for this job. Realtime-friendly.
  const [intent, setIntent] = useState<PaymentIntentRow | null>(null);
  const [ledger, setLedger] = useState<EscrowLedgerRow[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data: pi } = await supabase
        .from("payment_intents")
        .select(
          "id, status, amount_cents, currency, provider, external_ref, secured_at, released_at, created_at",
        )
        .eq("job_id", job.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setIntent((pi as PaymentIntentRow | null) ?? null);
      const { data: tx } = await supabase
        .from("escrow_transactions")
        .select("id, kind, amount_cents, currency, notes, created_at")
        .eq("job_id", job.id)
        .order("created_at", { ascending: false });
      setLedger((tx as EscrowLedgerRow[] | null) ?? []);
    };
    load();
    const ch = supabase
      .channel(`pay:${job.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_intents", filter: `job_id=eq.${job.id}` },
        load,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "escrow_transactions",
          filter: `job_id=eq.${job.id}`,
        },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [job.id]);

  const [providerPos, setProviderPos] = useState<MapPin | null>(null);
  useEffect(() => {
    if (!job.provider_id) return;
    supabase
      .from("provider_details")
      .select("id, service_type, lat, lng, profiles(full_name)")
      .eq("id", job.provider_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        // Provider has no verified position yet — never invent one.
        if (data.lat == null || data.lng == null) {
          setProviderPos(null);
          return;
        }
        setProviderPos({
          id: data.id,
          name:
            (data as { profiles: { full_name: string } | null }).profiles?.full_name ??
            t("mission.provider_fallback"),
          lat: data.lat,
          lng: data.lng,
          kind: data.service_type === "Underwater Diver" ? "diver" : "mechanic",
          highlighted: true,
        });
      });
  }, [job.provider_id]);

  const enRouteEta = useMemo(() => {
    if (!job.dispatched_at || !job.eta_minutes) return null;
    const remaining = Math.max(
      0,
      job.eta_minutes - Math.floor((Date.now() - new Date(job.dispatched_at).getTime()) / 60000),
    );
    return remaining;
  }, [job.dispatched_at, job.eta_minutes, tick]);

  const overridePos = useMemo(() => {
    if (!providerPos || !job.dispatched_at || !job.eta_minutes) return undefined;
    // M9.3 — if providerPos and job use different coordinate formats (legacy
    // normalized vs real degrees), interpolation is meaningless. Snap to job.
    const providerLegacy = Math.abs(providerPos.lat) < 1 && Math.abs(providerPos.lng) < 1;
    const jobLegacy = Math.abs(job.lat) < 1 && Math.abs(job.lng) < 1;
    if (providerLegacy !== jobLegacy) {
      return { [providerPos.id]: { lat: job.lat, lng: job.lng } };
    }
    const elapsed = Math.min(
      1,
      (Date.now() - new Date(job.dispatched_at).getTime()) / (job.eta_minutes * 60000),
    );
    return {
      [providerPos.id]: {
        lat: providerPos.lat + (job.lat - providerPos.lat) * elapsed,
        lng: providerPos.lng + (job.lng - providerPos.lng) * elapsed,
      },
    };
  }, [providerPos, job.dispatched_at, job.eta_minutes, job.lat, job.lng, tick]);

  const pendingPart = parts.find((p) => p.payment_status === "Pending");

  const navigate = useNavigate();
  const complete = async () => {
    setCompleting(true);
    const amount = Number(job.total_escrow_pool);
    const commissionAmount = Math.round(amount * 0.1);
    const netAmount = amount - commissionAmount;
    const { data, error } = await supabase.rpc("complete_job", { _job_id: job.id });
    if (error) {
      console.error("[job] complete_job failed", error);
      toast.error(t("owner.complete_failed"));
      setCompleting(false);
      return;
    }
    // The RPC is idempotent and reports which path it took. Financial telemetry
    // is emitted ONLY on the first real completion so repeat calls cannot
    // duplicate escrow / commission / payout events.
    const outcome = readCompleteJobResult(data);
    if (outcome === "unknown") {
      console.error("[job] complete_job returned an unexpected shape", data);
      toast.error(t("owner.complete_failed"));
      setCompleting(false);
      return;
    }
    if (outcome === "completed") {
      // TODO(payments-provider): remove client emissions once webhook-driven events land.
      emitEvent({
        type: "escrow.release_requested",
        subject_type: "escrow",
        subject_id: job.id,
        metadata: { amount },
      });
      emitEvent({
        type: "escrow.released",
        subject_type: "escrow",
        subject_id: job.id,
        metadata: { amount },
        severity: "success",
      });
      emitEvent({
        type: "commission.recorded",
        subject_type: "job",
        subject_id: job.id,
        metadata: { fee: commissionAmount, net: netAmount },
      });
      emitEvent({
        type: "payout.requested",
        subject_type: "job",
        subject_id: job.id,
        metadata: { amount: netAmount },
      });
    }
    setCompleting(false);
    navigate({ to: "/app" });
  };

  // Escrow UI state derived from job status.
  // TODO(payments): replace with real Stripe/escrow ledger events.
  const escrowUi: EscrowUiState = (() => {
    if (job.status === "Pending") return "awaiting";
    if (job.status === "PartsPending") return "extras_pending";
    if (job.status === "Completed") return "released";
    return "secured";
  })();
  const timeline = deriveEscrow(
    {
      status: job.status,
      total_escrow_pool: Number(job.total_escrow_pool),
      extra_parts_cost: Number(job.extra_parts_cost),
    },
    parts.map((p) => ({ payment_status: p.payment_status })),
  );
  const commission = Math.round(Number(job.total_escrow_pool) * 0.1);

  return (
    <div className="thalvo-dark space-y-4 -m-4 p-4 min-h-[calc(100dvh-4rem)] thalvo-cockpit">
      <GlassPanel className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <StatusChip
              tone={
                job.status === "Completed"
                  ? "success"
                  : job.status === "Pending"
                    ? "warning"
                    : "info"
              }
            >
              {t(`status.${job.status}`)}
            </StatusChip>
            <h1 className="mt-2 text-lg font-semibold text-white leading-tight">
              {t(`problems.${job.problem_category}`, { defaultValue: job.problem_category })}
            </h1>
            <p className="text-[11px] text-white/50 mt-0.5 inline-flex items-center gap-1">
              <PinIcon className="size-3" /> {job.marina}
            </p>
          </div>
          {enRouteEta !== null && job.status === "EnRoute" && (
            <StatusChip tone="info" icon={<Clock className="size-3" />}>
              {t("owner.arriving_in", { min: enRouteEta })}
            </StatusChip>
          )}
        </div>
        <div className="pt-3 border-t border-white/10">
          <MissionStatusTrack stage={stageFromJob(job.status, offers.length)} />
        </div>
      </GlassPanel>

      {providerPos && (
        <div className="rounded-2xl overflow-hidden border border-white/10">
          <MockMap
            providers={[providerPos]}
            jobs={[{ id: job.id, lat: job.lat, lng: job.lng, marina: job.marina }]}
            overridePositions={overridePos}
          />
        </div>
      )}

      {job.status === "Pending" && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40 mb-2 px-1">
            {t("owner.offers_title")} · {offers.length}
          </p>
          {offers.length === 0 ? (
            <GlassPanel className="text-center">
              <Loader2 className="mx-auto size-5 animate-spin text-sky-300 mb-2" />
              <p className="text-sm text-white/60">{t("owner.no_offers")}</p>
              <p className="text-[11px] text-white/40 mt-1">{t("mission.broadcasting_hint")}</p>
            </GlassPanel>
          ) : (
            <ul className="space-y-2">
              {offers.map((o) => {
                // No fabricated positions: providers without a real fix show no distance.
                const dist =
                  o.provider_details &&
                  o.provider_details.lat != null &&
                  o.provider_details.lng != null
                    ? harborDistanceKm(
                        o.provider_details.lat,
                        o.provider_details.lng,
                        job.lat,
                        job.lng,
                      )
                    : null;
                return (
                  <li key={o.id}>
                    <OfferCard
                      offer={{
                        id: o.id,
                        providerName:
                          o.profiles?.full_name ?? t("mission.verified_provider_pending"),
                        role:
                          o.provider_details?.service_type === "Underwater Diver"
                            ? "diver"
                            : "mechanic",
                        price: Number(o.price),
                        etaMinutes: o.eta_minutes,
                        distanceKm: dist,
                        rating: o.provider_details?.rating,
                        verified: Boolean(o.provider_details?.certification_url),
                        jobsCompleted: o.provider_details?.jobs_completed ?? null,
                        note: o.note,
                      }}
                      currencyFormat={(n) => formatTL(n)}
                      onAccept={() => setCheckout({ kind: "offer", offer: o })}
                      onExplainTrust={() => setTrustFor(o)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {job.status !== "Pending" && (
        <EscrowPanel
          state={escrowUi}
          amountLabel={formatTL(Number(job.total_escrow_pool))}
          providerName={providerPos?.name ?? null}
          commissionLabel={escrowUi === "released" ? formatTL(commission) : null}
          onApproveExtras={
            pendingPart ? () => setCheckout({ kind: "part", part: pendingPart }) : undefined
          }
          extrasLabel={pendingPart ? formatTL(Number(pendingPart.part_price)) : undefined}
        >
          {(job.initial_labor_cost > 0 ||
            parts.filter((p) => p.payment_status === "Paid").length > 0) && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1 text-[12px]">
              <div className="flex justify-between text-white/70">
                <span>{t("owner.labor_cost")}</span>
                <span className="tabular-nums">{formatTL(Number(job.initial_labor_cost))}</span>
              </div>
              {parts
                .filter((p) => p.payment_status === "Paid")
                .map((p) => (
                  <div key={p.id} className="flex justify-between text-white/50">
                    <span className="truncate">· {p.part_name}</span>
                    <span className="tabular-nums">{formatTL(Number(p.part_price))}</span>
                  </div>
                ))}
            </div>
          )}
          <PaymentTimeline
            currentIndex={timeline.currentIndex}
            reachedFlags={timeline.reachedFlags}
          />
        </EscrowPanel>
      )}

      {job.status !== "Pending" && (
        <details className="group rounded-2xl border border-white/10 bg-white/[0.02]">
          <summary className="list-none cursor-pointer select-none px-4 py-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60 hover:text-white/80">
            <span>{t("mission.details")}</span>
            <span className="text-white/40 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="p-3 pt-1 space-y-3">
            <PaymentIntentPanel intent={intent} />
            <EscrowLedgerPanel rows={ledger} />
          </div>
        </details>
      )}

      {["OnSite", "InProgress", "PartsPending"].includes(job.status) && (
        <button
          onClick={complete}
          disabled={completing}
          className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {completing ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-5" />
          )}
          {t("owner.confirm_complete")} · {t("mission.release_escrow")}
        </button>
      )}

      {job.provider_id && <JobChat jobId={job.id} meId={meId} />}

      {pendingPart && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-4 amber-gradient text-warning-foreground flex items-center gap-2">
              <AlertOctagon className="size-5" />
              <p className="font-bold">{t("owner.part_alert")}</p>
            </div>
            {pendingPart.part_image_url && (
              <img src={pendingPart.part_image_url} alt="" className="w-full h-40 object-cover" />
            )}
            <div className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{pendingPart.part_name}</span>
                <span className="tabular-nums font-bold">
                  {formatTL(Number(pendingPart.part_price))}
                </span>
              </div>
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Package className="size-3" /> {pendingPart.source}
              </p>
              <div className="rounded-xl bg-muted/40 p-3 text-xs">
                <div className="flex justify-between">
                  <span>{t("owner.labor_cost")}</span>
                  <span className="tabular-nums">{formatTL(Number(job.initial_labor_cost))}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("owner.parts_cost")}</span>
                  <span className="tabular-nums">+ {formatTL(Number(pendingPart.part_price))}</span>
                </div>
              </div>
              <button
                onClick={() => setCheckout({ kind: "part", part: pendingPart })}
                className="w-full h-12 rounded-xl amber-gradient text-warning-foreground font-bold"
              >
                {t("checkout.parts_pay")}
              </button>
            </div>
          </div>
        </div>
      )}

      {checkout?.kind === "offer" && (
        <CheckoutModal
          open
          amount={Number(checkout.offer.price)}
          title={checkout.offer.profiles?.full_name ?? t("mission.provider_fallback")}
          subtitle={t("owner.accept_offer")}
          tone="marine"
          onClose={() => setCheckout(null)}
          onPaid={async () => {
            const offerId = checkout.offer.id;
            const price = Number(checkout.offer.price);
            const { error: acceptErr } = await supabase.rpc("accept_offer", {
              _job_id: job.id,
              _offer_id: offerId,
            });
            if (acceptErr) throw new Error(acceptErr.message);
            // Simulated payment intent — real PSP webhook will replace this
            // once Stripe / iyzico / PayTR is wired.
            const { data: intentId, error: intentErr } = await supabase.rpc(
              "record_payment_intent",
              {
                _job_id: job.id,
                _offer_id: offerId,
              },
            );
            if (intentErr) throw new Error(intentErr.message);
            emitEvent({
              type: "offer.accepted",
              subject_type: "offer",
              subject_id: offerId,
              metadata: { job_id: job.id, price, simulated: true },
              severity: "success",
            });
            emitEvent({
              type: "payment.intent_created",
              subject_type: "job",
              subject_id: job.id,
              metadata: { intent_id: intentId, amount: price, provider: "simulated" },
            });
            emitEvent({
              type: "payment.secured",
              subject_type: "job",
              subject_id: job.id,
              metadata: { amount: price, simulated: true },
              severity: "success",
            });
            emitEvent({
              type: "escrow.secured",
              subject_type: "escrow",
              subject_id: job.id,
              metadata: { amount: price, simulated: true },
            });
          }}
        />
      )}
      {checkout?.kind === "part" && (
        <CheckoutModal
          open
          amount={Number(checkout.part.part_price)}
          title={checkout.part.part_name}
          subtitle={checkout.part.source}
          tone="amber"
          cta={t("checkout.parts_pay")}
          onClose={() => setCheckout(null)}
          onPaid={async () => {
            const partId = checkout.part.id;
            const { error } = await supabase.rpc("approve_part", { _part_id: partId });
            if (error) throw new Error(error.message);
            // Eagerly refetch parts so the outer "pending part" overlay
            // disappears immediately instead of waiting on realtime; without
            // this, the part-pay screen looked stuck after the modal closed.
            const { data: freshParts } = await supabase
              .from("job_parts")
              .select("*")
              .eq("job_id", job.id)
              .order("created_at");
            if (freshParts) setParts(freshParts as never);
            emitEvent({
              type: "payment.secured",
              subject_type: "job",
              subject_id: job.id,
              metadata: {
                amount: Number(checkout.part.part_price),
                kind: "extra_part",
                simulated: true,
              },
              severity: "success",
            });
          }}
        />
      )}
      <TrustExplanationSheet
        open={!!trustFor}
        onClose={() => setTrustFor(null)}
        subject={trustFor?.profiles?.full_name ?? t("mission.provider_fallback")}
        report={computeTrust({
          rating: trustFor?.provider_details?.rating ?? null,
          jobsCompleted: trustFor?.provider_details?.jobs_completed ?? null,
          verified: Boolean(trustFor?.provider_details?.certification_url),
        })}
      />
    </div>
  );
}

/* ---------------- PROVIDER ---------------- */
function ProviderJob({ job, meId }: { job: Job; meId: string }) {
  const { t } = useTranslation();
  const [parts, setParts] = useState<Part[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [partName, setPartName] = useState("");
  const [partPrice, setPartPrice] = useState("");
  const [partPhoto, setPartPhoto] = useState("");
  const [source, setSource] = useState("Tedarikçi Firma (Local Supplier)");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = () =>
      supabase
        .from("job_parts")
        .select("*")
        .eq("job_id", job.id)
        .order("created_at")
        .then(({ data }) => setParts((data as never) ?? []));
    load();
    const ch = supabase
      .channel(`p-parts:${job.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_parts", filter: `job_id=eq.${job.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [job.id]);

  // M9 provider payout view.
  const [payout, setPayout] = useState<ProviderPayoutRow | null>(null);
  useEffect(() => {
    const load = () =>
      supabase
        .from("provider_payouts")
        .select("id, status, amount_cents, currency, requested_at, completed_at, external_ref")
        .eq("job_id", job.id)
        .eq("provider_id", meId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setPayout((data as ProviderPayoutRow | null) ?? null));
    load();
    const ch = supabase
      .channel(`ppay:${job.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "provider_payouts", filter: `job_id=eq.${job.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [job.id, meId]);
  const providerCommission = computeCommission(Number(job.total_escrow_pool));

  const setSail = async () => {
    await supabase.rpc("set_sail", { _job_id: job.id });
  };
  const arrived = async () => {
    await supabase.rpc("mark_arrived", { _job_id: job.id });
  };
  const addPart = async () => {
    if (!partName || !partPrice) return;
    setBusy(true);
    await supabase.rpc("add_extra_part", {
      _job_id: job.id,
      _name: sanitizePlainText(partName, 200),
      _price: Number(partPrice),
      _photo: partPhoto || "https://images.unsplash.com/photo-1581092160607-ee22b1a3f4a1?w=400",
      _source: sanitizePlainText(source, 120),
    });
    setBusy(false);
    setShowAdd(false);
    setPartName("");
    setPartPrice("");
    setPartPhoto("");
  };

  return (
    <div className="space-y-4">
      <GlassPanel className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <StatusChip tone="info">{t(`status.${job.status}`)}</StatusChip>
            <h1 className="mt-2 text-lg font-semibold text-white leading-tight">
              {t(`problems.${job.problem_category}`, { defaultValue: job.problem_category })}
            </h1>
            <p className="text-[11px] text-white/50 mt-0.5 inline-flex items-center gap-1">
              <PinIcon className="size-3" /> {job.marina}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {t("escrow.pool_label")}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {formatTL(Number(job.total_escrow_pool))}
            </p>
          </div>
        </div>
      </GlassPanel>

      <details className="group rounded-2xl border border-white/10 bg-white/[0.02]">
        <summary className="list-none cursor-pointer select-none px-4 py-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60 hover:text-white/80">
          <span>{t("mission.details")}</span>
          <span className="text-white/40 group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="p-3 pt-1 space-y-3">
          <ProviderPayoutPanel
            payout={payout}
            expectedNet={providerCommission.net}
            feeAmount={providerCommission.fee}
          />
          <CommissionBreakdown gross={providerCommission.gross} />
        </div>
      </details>

      {job.status === "Accepted" && (
        <button
          onClick={setSail}
          className="w-full h-14 rounded-2xl amber-gradient text-warning-foreground font-bold inline-flex items-center justify-center gap-2"
        >
          <Send className="size-5" /> {t("provider.set_sail")}
        </button>
      )}
      {job.status === "EnRoute" && (
        <button
          onClick={arrived}
          className="w-full h-14 rounded-2xl marine-gradient text-white font-bold inline-flex items-center justify-center gap-2"
        >
          <PinIcon className="size-5" /> {t("provider.arrived")}
        </button>
      )}

      {["OnSite", "InProgress", "PartsPending"].includes(job.status) && (
        <GlassPanel>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              {t("mission.parts")}
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="text-[10px] font-black rounded-full amber-gradient text-warning-foreground px-3 py-1.5 uppercase tracking-[0.14em]"
            >
              + {t("provider.add_part")}
            </button>
          </div>
          {parts.length === 0 ? (
            <p className="text-xs text-white/40">—</p>
          ) : (
            <ul className="space-y-2">
              {parts.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  {p.part_image_url && (
                    <img
                      src={p.part_image_url}
                      alt=""
                      className="size-12 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.part_name}</p>
                    <p className="text-xs text-white/50">{p.source}</p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold tabular-nums text-white">
                      {formatTL(Number(p.part_price))}
                    </p>
                    <StatusChip
                      tone={
                        p.payment_status === "Paid"
                          ? "success"
                          : p.payment_status === "Rejected"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {t(`owner.part_status_${p.payment_status}`, {
                        defaultValue: p.payment_status,
                      })}
                    </StatusChip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-card rounded-3xl p-4 space-y-3 max-h-[85vh] overflow-y-auto">
            <h3 className="font-bold">{t("provider.add_part")}</h3>
            <CatalogPicker
              onPick={(p) => {
                setPartName(p.name);
                setPartPrice(String(p.price));
                setPartPhoto(p.image_url ?? "");
                setSource(`THALVO Catalog · ${p.brand}`);
              }}
            />
            <input
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              placeholder={t("provider.part_name")}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
            />
            <input
              value={partPrice}
              onChange={(e) => setPartPrice(e.target.value)}
              inputMode="numeric"
              placeholder={t("provider.part_price")}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
            />
            <input
              value={partPhoto}
              onChange={(e) => setPartPhoto(e.target.value)}
              placeholder={`${t("common.photo")} URL (${t("common.optional")})`}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
            />
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option>Tedarikçi Firma (Local Supplier)</option>
              <option>OEM Distributor</option>
              <option>Marina Chandlery</option>
              <option>THALVO Catalog</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 h-11 rounded-xl border border-border"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={addPart}
                disabled={busy}
                className="flex-1 h-11 rounded-xl amber-gradient text-warning-foreground font-bold inline-flex items-center justify-center gap-1.5"
              >
                {busy && <Loader2 className="size-4 animate-spin" />} {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      <JobChat jobId={job.id} meId={meId} />
    </div>
  );
}

interface CatalogItem {
  id: string;
  name: string;
  price: number;
  brand: string;
  image_url: string | null;
  sku: string | null;
}
function CatalogPicker({ onPick }: { onPick: (p: CatalogItem) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  useEffect(() => {
    if (!open) return;
    supabase
      .from("parts_catalog")
      .select("id, name, price, brand, image_url, sku")
      .eq("active", true)
      .limit(50)
      .then(({ data }) => setItems((data as never) ?? []));
  }, [open]);
  const filtered = items.filter(
    (i) =>
      !q ||
      i.name.toLowerCase().includes(q.toLowerCase()) ||
      i.brand.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="rounded-xl border border-deep/30 bg-deep/5 p-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 rounded-lg marine-gradient text-white text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-1.5"
      >
        <Package className="size-3.5" /> {t("shop.browse_catalog")}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("shop.search")}
            className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
          />
          <ul className="max-h-56 overflow-y-auto space-y-1">
            {filtered.map((i) => (
              <li key={i.id}>
                <button
                  onClick={() => {
                    onPick(i);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 text-left"
                >
                  {i.image_url && (
                    <img src={i.image_url} alt="" className="size-9 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{i.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {i.brand} · {i.sku ?? ""}
                    </p>
                  </div>
                  <p className="text-xs font-black tabular-nums">{formatTL(Number(i.price))}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
