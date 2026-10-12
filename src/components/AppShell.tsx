import type { ReactNode } from "react";
import { cockpitFallbackProfile, recalledCockpitRole, useProfile } from "@/lib/session";
import { MissionShell } from "@/components/mission/MissionShell";
import { ThalvoLoader } from "./ThalvoLoader";

/**
 * AppShell — thin compatibility wrapper.
 *
 * M8 Design Freeze: every authenticated THALVO route now renders inside the
 * MissionShell (dark MarineOS cockpit + unified bottom nav + account menu).
 * AppShell remains only so existing route files that pass `userId` continue
 * to compile — it resolves the profile and delegates to MissionShell.
 */
export function AppShell({ userId, children }: { userId: string; children: ReactNode }) {
  const { profile, loading } = useProfile(userId);
  // Full-screen ThalvoLoader only while the first profile fetch is in flight.
  // A null profile after loading (error / missing row) used to spin forever —
  // that looked like /app/orders "takılıyor" after a hard post-checkout nav.
  if (loading && !profile) return <ThalvoLoader />;
  const resolved =
    profile ?? cockpitFallbackProfile(userId, recalledCockpitRole(userId) ?? "Client");
  return <MissionShell profile={resolved}>{children}</MissionShell>;
}
