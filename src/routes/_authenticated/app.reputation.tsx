import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { useProfile, useSessionUser } from "@/lib/session";
import { BoatPassportShell } from "@/components/passport/BoatPassportShell";
import { ReputationPanel } from "@/components/trust/ReputationPanel";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { computeTrust, type TrustReport } from "@/lib/trust";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/reputation")({
  ssr: false,
  component: ReputationPage,
});

function ReputationPage() {
  const { user, loading } = useSessionUser();
  if (loading) return <ThalvoLoader />;
  if (!user) return null;
  return (
    <AppShell userId={user.id}>
      <ReputationInner userId={user.id} />
    </AppShell>
  );
}

function ReputationInner({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { profile } = useProfile(userId);
  const [details, setDetails] = useState<{ rating: number | null; jobs_completed: number | null; certification_url: string | null } | null>(null);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [offerCount, setOfferCount] = useState(0);
  const [report, setReport] = useState<TrustReport | null>(null);

  useEffect(() => {
    (async () => {
      const { data: pd } = await supabase
        .from("provider_details")
        .select("rating, jobs_completed, certification_url")
        .eq("id", userId)
        .maybeSingle();
      const d = (pd as { rating: number | null; jobs_completed: number | null; certification_url: string | null } | null) ?? null;
      setDetails(d);

      const { count: accepted } = await supabase
        .from("jobs")
        .select("id", { head: true, count: "exact" })
        .eq("provider_id", userId)
        .in("status", ["Accepted", "EnRoute", "OnSite", "InProgress", "PartsPending", "Completed"]);
      setAcceptedCount(accepted ?? 0);

      const { count: offers } = await supabase
        .from("job_offers")
        .select("id", { head: true, count: "exact" })
        .eq("provider_id", userId);
      setOfferCount(offers ?? 0);

      setReport(
        computeTrust({
          rating: d?.rating ?? null,
          jobsCompleted: d?.jobs_completed ?? null,
          offersAccepted: accepted ?? 0,
          verified: Boolean(d?.certification_url),
        }),
      );
    })();
  }, [userId]);

  if (!profile) return <ThalvoLoader />;

  if (profile.role !== "Provider") {
    return (
      <BoatPassportShell title={t("trust.captain_title")} eyebrow={t("trust.captain_eyebrow")}>
        <GlassPanel className="text-sm text-white/70">
          {t("trust.captain_notice_prefix")}{" "}
          <Link to="/app/passport" className="text-sky-300 hover:text-sky-200">
            {t("trust.captain_notice_link")}
          </Link>
          . {t("trust.captain_notice_suffix")}
        </GlassPanel>
      </BoatPassportShell>
    );
  }

  if (!report) return <ThalvoLoader />;

  return (
    <BoatPassportShell title={t("trust.page_title")} eyebrow={t("trust.eyebrow")}>
      <ReputationPanel
        report={report}
        subject={profile.full_name || t("trust.operator_fallback")}
        verified={Boolean(details?.certification_url)}
        extraStats={[
          { label: t("trust.stats.completed"), value: String(details?.jobs_completed ?? 0) },
          { label: t("trust.stats.accepted_offers"), value: String(acceptedCount) },
          { label: t("trust.stats.bids_submitted"), value: String(offerCount) },
          { label: t("trust.stats.rating"), value: details?.rating ? details.rating.toFixed(1) : "—" },
        ]}
        onAction={(key) => {
          if (key === "profile") window.location.assign("/app/profile");
          else if (key === "certs") toast(t("trust.toast.certs_coming_soon"));
          else if (key === "missions") window.location.assign("/app");
          else toast(t("trust.toast.eta_hint"));
        }}
      />
      <p className="text-[10px] text-white/30 text-center pt-2">
        {t("trust.footnote")}
      </p>
    </BoatPassportShell>
  );
}
