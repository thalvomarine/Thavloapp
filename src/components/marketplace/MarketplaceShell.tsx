import type { ReactNode } from "react";
import { CockpitHeader } from "@/components/core/CockpitHeader";

interface Props {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}

/**
 * MarketplaceShell — dark cockpit wrapper for marketplace + dealer pages.
 * Provides consistent header + spacing. Use inside AppShell.
 *
 * M8 UI Consistency Pass: header markup delegated to CockpitHeader so the
 * eyebrow / title typography matches Mission Control and Boat Passport.
 */
export function MarketplaceShell({ title, eyebrow, subtitle, right, children }: Props) {
  return (
    <div className="thalvo-dark thalvo-cockpit min-h-[calc(100dvh-4rem)] w-full min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <CockpitHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actions={right} />
      {children}
    </div>
  );
}
