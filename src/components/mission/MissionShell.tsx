import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/Wordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThalvoAiFab } from "@/components/ThalvoAiFab";
import { AccountMenuButton } from "@/components/mission/AccountMenuButton";
import { SosSheet } from "@/components/mission/SosSheet";
import { EmergencyServiceSheet } from "@/components/mission/EmergencyServiceSheet";
import { ClipboardList, Map as MapIcon, Store, UserCircle2, AlertOctagon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { useFirstRun } from "@/components/onboarding/useFirstRun";
import { THALVO_SOS_OPEN_EVENT } from "@/lib/sos-bus";
import {
  THALVO_EMERGENCY_SERVICE_EVENT,
  type EmergencyServiceOpenDetail,
} from "@/lib/emergency-service-bus";
import type { EmergencyServiceCategory } from "@/lib/emergency-service";
import { setMapChromeOverlay } from "@/lib/map-chrome";

import { RescueMark, PassportMark, MarketplaceMark } from "@/components/brand/ProductMarks";
import type { Profile } from "@/lib/session";

interface Props {
  profile: Profile;
  children: ReactNode;
  /**
   * Chromeless full-viewport mode for the map cockpit home screen: no sticky
   * header/identity strip, no `<main>` padding or scroll — the child owns
   * the whole viewport. The floating bottom nav and AI fab stay put.
   */
  fullBleed?: boolean;
}

/**
 * MissionShell — the single MarineOS chrome used by every authenticated
 * THALVO route. Provides:
 *   • Dark cockpit background + LIVE status rail
 *   • Captain identity strip + account menu (Profile / Admin / Sign out)
 *   • Unified bottom nav: Map · Missions · Marketplace · My Vessel
 *   • Global Thalvo AI copilot fab
 */
export function MissionShell({ profile, children, fullBleed = false }: Props) {
  const { t } = useTranslation();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isSupplier = profile.role === "Supplier";
  const isProvider = profile.role === "Provider";
  const [isAdmin, setIsAdmin] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosCat, setSosCat] = useState<"mechanic" | "diver">("mechanic");
  const [sosDetails, setSosDetails] = useState<string | undefined>();
  const [svcOpen, setSvcOpen] = useState(false);
  const [svcBay, setSvcBay] = useState<string | undefined>();
  const [svcCat, setSvcCat] = useState<EmergencyServiceCategory>("diver");
  const firstRun = useFirstRun(profile.id);
  const isCaptain = profile.role === "Client";
  useEffect(() => {
    // UI-level gate; server RPCs still enforce has_role('admin') for real data.
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [profile.id]);

  useEffect(() => {
    if (!isCaptain) return;
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ category?: "mechanic" | "diver"; details?: string }>).detail;
      const cat = detail?.category;
      if (cat === "diver" || cat === "mechanic") setSosCat(cat);
      setSosDetails(detail?.details);
      setSosOpen(true);
      setMapChromeOverlay("sos", true);
    };
    window.addEventListener(THALVO_SOS_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(THALVO_SOS_OPEN_EVENT, onOpen);
  }, [isCaptain]);

  useEffect(() => {
    if (!isCaptain) return;
    const onSvc = (event: Event) => {
      const detail = (event as CustomEvent<EmergencyServiceOpenDetail>).detail;
      setSvcBay(detail?.bayName);
      if (detail?.category) setSvcCat(detail.category);
      setSosOpen(false);
      setSvcOpen(true);
      setMapChromeOverlay("sos", true);
    };
    window.addEventListener(THALVO_EMERGENCY_SERVICE_EVENT, onSvc);
    return () => window.removeEventListener(THALVO_EMERGENCY_SERVICE_EVENT, onSvc);
  }, [isCaptain]);

  useEffect(() => {
    setMapChromeOverlay("sos", sosOpen || svcOpen);
    return () => setMapChromeOverlay("sos", false);
  }, [sosOpen, svcOpen]);

  return (
    <div
      className={
        "thalvo-dark thalvo-cockpit text-foreground flex w-full max-w-[100vw] flex-col overflow-x-hidden " +
        (fullBleed ? "fixed inset-0 h-[100dvh] overflow-hidden" : "min-h-dvh")
      }
    >
      {/* Top status rail — replaced by the map cockpit's own floating top bar in fullBleed mode */}
      {!fullBleed && (
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[oklch(0.13_0.02_250/0.7)] backdrop-blur-xl pt-[env(safe-area-inset-top)]">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
            <Link to="/app" className="flex items-center gap-3 min-w-0">
              <Wordmark size="sm" className="text-white" />
              <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
                MarineOS · Mission Control
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-white/60">
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_theme(colors.emerald.400)]" />
                LIVE
              </div>
              <LanguageSwitcher tone="dark" />
              <AccountMenuButton profile={profile} isAdmin={isAdmin} />
            </div>
          </div>
          {/* Captain identity line */}
          <div className="mx-auto max-w-6xl px-4 pb-2.5 flex items-center justify-between gap-3 text-[11px]">
            <div className="text-white/70 truncate">
              <span className="text-white/40 uppercase tracking-[0.18em] mr-2">
                {isSupplier ? "Supplier" : profile.role === "Provider" ? "Provider" : "Captain"}
              </span>
              <span className="font-semibold text-white">{profile.full_name}</span>
              {profile.boat_name && (
                <span className="text-white/50"> · ⚓ {profile.boat_name}</span>
              )}
              {profile.business_name && (
                <span className="text-white/50"> · {profile.business_name}</span>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-3 text-white/50">
              <span>
                {new Date().toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}
              </span>
            </div>
          </div>
        </header>
      )}

      <main
        className={
          fullBleed
            ? "relative min-w-0 flex-1 overflow-hidden"
            : "mx-auto min-w-0 w-full max-w-6xl flex-1 overflow-x-hidden px-4 py-5 pb-28"
        }
      >
        {children}
      </main>

      {/* Full-width dock — 5 equal columns so labels never collide */}
      <nav
        className="fixed inset-x-0 z-40 pointer-events-none"
        style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-auto mx-auto w-full max-w-lg px-2">
          <div className="rounded-full border border-white/10 bg-[oklch(0.14_0.02_250/0.86)] backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
            <div
              className={
                "grid w-full items-center px-1 " +
                (isSupplier ? "grid-cols-3" : isProvider ? "grid-cols-4" : "grid-cols-5")
              }
              style={{ height: 60 }}
            >
              {!isProvider && (
                <NavTab
                  to="/app"
                  active={path === "/app"}
                  icon={<MapIcon className="size-[16px]" />}
                  label={t("nav.map")}
                />
              )}
              {isSupplier ? (
                <>
                  <NavTab
                    to="/app/dealer"
                    active={path.startsWith("/app/dealer") || path.startsWith("/app/supplier")}
                    icon={<Store className="size-[16px]" />}
                    label={t("nav.inventory")}
                  />
                  <NavTab
                    to="/app/marketplace"
                    active={
                      path.startsWith("/app/marketplace") ||
                      path.startsWith("/app/orders") ||
                      path.startsWith("/app/dealer")
                    }
                    icon={<MarketplaceMark size={18} />}
                    label={t("nav.dock_market")}
                  />
                </>
              ) : isProvider ? (
                <>
                  <NavTab
                    to="/app"
                    active={path === "/app" || path.startsWith("/app/job")}
                    icon={<RescueMark size={18} />}
                    label={t("nav.missions")}
                  />
                  <NavTab
                    to="/app/marketplace"
                    active={
                      path.startsWith("/app/marketplace") ||
                      path.startsWith("/app/shop") ||
                      path.startsWith("/app/dealer")
                    }
                    icon={<MarketplaceMark size={18} />}
                    label={t("nav.dock_market")}
                  />
                  <NavTab
                    to="/app/orders"
                    active={path.startsWith("/app/orders")}
                    icon={<ClipboardList className="size-[16px]" />}
                    label={t("nav.orders")}
                  />
                  <NavTab
                    to="/app/profile"
                    active={path.startsWith("/app/profile")}
                    icon={<UserCircle2 className="size-[16px]" />}
                    label={t("nav.profile")}
                  />
                </>
              ) : (
                <>
                  <NavTab
                    to="/app/services"
                    active={
                      path.startsWith("/app/services") ||
                      path.startsWith("/app/job") ||
                      path.startsWith("/app/report")
                    }
                    icon={<RescueMark size={18} />}
                    label={t("nav.missions")}
                  />
                  <SosNavButton
                    onClick={() => {
                      setSosOpen(true);
                      setMapChromeOverlay("sos", true);
                    }}
                  />
                  <NavTab
                    to="/app/marketplace"
                    active={
                      path.startsWith("/app/marketplace") ||
                      path.startsWith("/app/shop") ||
                      path.startsWith("/app/orders") ||
                      path.startsWith("/app/dealer")
                    }
                    icon={<MarketplaceMark size={18} />}
                    label={t("nav.dock_market")}
                  />
                  <NavTab
                    to="/app/passport"
                    active={path.startsWith("/app/passport") || path.startsWith("/app/reputation")}
                    icon={<PassportMark size={18} />}
                    label={t("nav.dock_vessel")}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* The floating Compass/AI launcher used to sit at the exact same
          bottom offset as the dock nav above and collide with it on every
          non-map screen (Marketplace, Missions, My Vessel…). The map
          cockpit already exposes its own AI entry point via ChartFabStack,
          well clear of the dock — so the standalone launcher stays hidden
          everywhere and only the chat sheet it owns (opened through the
          shared THALVO_AI_OPEN_EVENT bus) is reused. */}
      <ThalvoAiFab hideLauncher />

      {isCaptain && (
        <>
          <SosSheet
            open={sosOpen}
            onClose={() => {
              setSosOpen(false);
              setMapChromeOverlay("sos", false);
            }}
            initialCategory={sosCat}
            initialNote={sosDetails}
          />
          <EmergencyServiceSheet
            open={svcOpen}
            onClose={() => {
              setSvcOpen(false);
              setMapChromeOverlay("sos", false);
            }}
            initialBayName={svcBay}
            initialCategory={svcCat}
          />
        </>
      )}

      {firstRun.open && (
        <OnboardingOverlay profile={profile} isAdmin={isAdmin} onComplete={firstRun.complete} />
      )}
    </div>
  );
}

function SosNavButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="SOS"
      className="relative flex min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden px-0.5 text-[10px] font-semibold uppercase tracking-tight text-red-200"
    >
      <span
        className="relative grid size-8 place-items-center rounded-full text-white"
        style={{
          background: "linear-gradient(135deg, oklch(0.68 0.24 25) 0%, oklch(0.6 0.24 18) 100%)",
          boxShadow: "0 8px 20px -8px rgba(244,63,94,0.7)",
        }}
      >
        <span className="absolute -inset-1 -z-10 rounded-full bg-red-500/35 blur-sm animate-pulse" />
        <AlertOctagon className="size-3.5" />
      </span>
      <span>SOS</span>
    </button>
  );
}

function NavTab({
  to,
  active,
  icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={
        "relative flex min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden px-0.5 text-[10px] font-semibold uppercase tracking-tight transition-colors " +
        (active ? "text-white" : "text-white/50 hover:text-white/80")
      }
    >
      {active && (
        <span className="absolute -top-0.5 h-1 w-6 rounded-full bg-sky-400 shadow-[0_0_12px_theme(colors.sky.400)]" />
      )}
      {icon}
      <span className="max-w-full truncate leading-none">{label}</span>
    </Link>
  );
}
