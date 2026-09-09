import type { ReactNode } from "react";
import { useProfile } from "@/lib/session";
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
  const { profile } = useProfile(userId);
  if (!profile) return <ThalvoLoader />;
  return <MissionShell profile={profile}>{children}</MissionShell>;
}
