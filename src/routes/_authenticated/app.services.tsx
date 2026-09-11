import { getFix, fixToJobFields } from "@/lib/geolocation";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { CheckoutModal } from "@/components/CheckoutModal";
import { ThalvoLoader } from "@/components/ThalvoLoader";
import { useSessionUser } from "@/lib/session";

import { Wrench, Anchor, Star, Clock } from "lucide-react";
import { toast } from "sonner";
import { emitEvent } from "@/lib/events";
import { sanitizePlainText } from "@/lib/sanitize";
import { CockpitHeader } from "@/components/core/CockpitHeader";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { LiveOpsPanel } from "@/components/mission/LiveOpsPanel";
import { MoneyAmount } from "@/components/core/MoneyAmount";
import { EmptyState } from "@/components/core/EmptyState";

export const Route = createFileRoute("/_authenticated/app/services")({
  ssr: false,
  component: ServicesPage,
});

interface Pkg { id: string; key: string; title_tr: string; title_en: string; category: "mechanic" | "diver"; base_duration_min: number; }
interface Offer {
  id: string; provider_id: string; price: number; eta_minutes: number;
  profiles: { full_name: string; company_name: string | null } | null;
  provider_details: { rating: number; service_type: string } | null;
}

function ServicesPage() {
  const { user, loading } = useSessionUser();
  if (loading) return <ThalvoLoader />;
  if (!user) return null;
  return <AppShell userId={user.id}><Services /></AppShell>;
}

function Services() {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<"mechanic" | "diver">("mechanic");
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [selected, setSelected] = useState<Pkg | null>(null);

  useEffect(() => {
    supabase.from("service_packages").select("*").order("key")
      .then(({ data, error }) => {
        if (error) console.warn("[services] service_packages unavailable", error.message);
        setPackages((data as never) ?? []);
      });
  }, []);

  const visible = useMemo(() => packages.filter((p) => p.category === filter), [packages, filter]);
  const label = (p: Pkg) => (i18n.language === "en" ? p.title_en : p.title_tr);

  return (
    <div className="space-y-6">
      <LiveOpsPanel />

      <CockpitHeader eyebrow={t("services.eyebrow")} title={t("services.title")} subtitle={t("services.subtitle")} />

      <div className="flex gap-2">
        <button onClick={() => setFilter("mechanic")}
          className={"flex-1 h-11 rounded-2xl text-sm font-semibold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 border transition-colors " +
            (filter === "mechanic" ? "bg-sky-500/20 border-sky-400/50 text-sky-100" : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/10")}>
          <Wrench className="size-4" /> {t("services.filter_mech")}
        </button>
        <button onClick={() => setFilter("diver")}
          className={"flex-1 h-11 rounded-2xl text-sm font-semibold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 border transition-colors " +
            (filter === "diver" ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-100" : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/10")}>
          <Anchor className="size-4" /> {t("services.filter_diver")}
        </button>
      </div>

      {visible.length === 0 ? (
        <GlassPanel>
          <EmptyState
            icon={<Wrench className="size-4" />}
            title="No packages yet"
            body="Standard service packages will appear here."
          />
        </GlassPanel>
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => (
            <li key={p.id}>
              <button onClick={() => setSelected(p)}
                className="w-full text-left glass-panel rounded-2xl p-4 flex items-center justify-between hover:border-sky-400/40 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{label(p)}</p>
                  <p className="text-[11px] text-white/50 inline-flex items-center gap-1 mt-0.5"><Clock className="size-3" /> ~{p.base_duration_min} {t("common.min")}</p>
                </div>
                <span className="text-white/40 text-lg">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && <PackageOffers pkg={selected} label={label(selected)} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PackageOffers({ pkg, label, onClose }: { pkg: Pkg; label: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useSessionUser();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [booking, setBooking] = useState<Offer | null>(null);

  useEffect(() => {
    supabase.from("provider_service_packages")
      .select("id, provider_id, price, eta_minutes, profiles!provider_service_packages_provider_id_fkey(full_name, company_name), provider_details!provider_service_packages_provider_id_fkey(rating, service_type)")
      .eq("package_id", pkg.id).order("price")
      .then(({ data }) => setOffers((data as never) ?? []));
  }, [pkg.id]);

  const bookingInFlight = useRef(false);
  const book = async () => {
    if (!booking || !user) return;
    if (bookingInFlight.current) return; // duplicate-click guard
    bookingInFlight.current = true;
    try {
      // Location Integrity — require a real, validated device fix before booking.
      // Failure is thrown so CheckoutModal surfaces it in-modal and preserves selection.
      const res = await getFix();
      if (!res.ok) throw new Error(t(res.failure.messageKey, { defaultValue: res.failure.defaultMessage }));
      const fix = res.fix;
      const fields = fixToJobFields(fix);
      const { data, error } = await supabase.rpc("book_service_package", {
        _psp_id: booking.id,
        _lat: fields.lat,
        _lng: fields.lng,
        _marina: "Göcek",
        _description: sanitizePlainText(`Routine service · ${label}`, 400),
        _location_accuracy_m: fields.location_accuracy_m ?? undefined,
        _location_captured_at: fields.location_captured_at ?? undefined,
      });
      if (error) throw new Error(error.message);
      const jobId = data as string;
      emitEvent({
        type: "mission.created",
        subject_type: "mission",
        subject_id: jobId,
        metadata: { source: "service_package", package: pkg.key, price: booking.price },
      });
      toast.success(t("owner.accept_offer"));
      setBooking(null); onClose();
      navigate({ to: "/app/job/$id", params: { id: jobId } });
    } finally {
      bookingInFlight.current = false;
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl mx-auto bg-card rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-black uppercase tracking-tight">{label}</p>
          <button onClick={onClose} className="text-xs text-muted-foreground">{t("common.close")}</button>
        </div>
        {offers.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">{t("services.no_offers")}</p>
        ) : (
          <ul className="space-y-2">
            {offers.map((o) => (
              <li key={o.id} className="rounded-2xl border border-border bg-background p-3 flex items-center gap-3">
                <div className={"size-11 rounded-xl grid place-items-center text-white " +
                  (o.provider_details?.service_type === "Underwater Diver" ? "aqua-gradient" : "marine-gradient")}>
                  {o.provider_details?.service_type === "Underwater Diver" ? <Anchor className="size-5" /> : <Wrench className="size-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{o.profiles?.company_name || o.profiles?.full_name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5"><Star className="size-3 fill-amber text-amber" /> {(o.provider_details?.rating ?? 5).toFixed(1)}</span>
                    <span>·</span>
                    <span>{o.eta_minutes} {t("common.min")}</span>
                  </div>
                </div>
                <div className="text-right">
                  <MoneyAmount value={Number(o.price)} className="text-base" />
                  <button onClick={() => setBooking(o)}
                    className="mt-1 block ml-auto text-[10px] font-black uppercase tracking-widest rounded-full amber-gradient text-warning-foreground px-3 py-1.5">
                    {t("services.book_now")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {booking && (
          <CheckoutModal open amount={Number(booking.price)}
            title={booking.profiles?.company_name || booking.profiles?.full_name || "Provider"}
            subtitle={label} tone="marine"
            onClose={() => setBooking(null)} onPaid={book} />
        )}
      </div>
    </div>
  );
}
