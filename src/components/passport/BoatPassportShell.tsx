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
 * BoatPassportShell — luxury dark cockpit wrapper for the vessel passport.
 * Mirrors MarketplaceShell / MissionShell language.
 *
 * M8 UI Consistency Pass: header markup delegated to CockpitHeader.
 */
export function BoatPassportShell({ title, eyebrow, subtitle, right, children }: Props) {
  return (
    <div className="thalvo-dark thalvo-cockpit -m-4 p-4 space-y-4 min-h-[calc(100dvh-4rem)]">
      <CockpitHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actions={right} />
      {children}
    </div>
  );
}
