import type { ReactNode } from "react";
import { CockpitHeader } from "@/components/core/CockpitHeader";

interface Props {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  right?: ReactNode;
  /** Full-width strip under the title/actions (e.g. location warning). */
  banner?: ReactNode;
  children: ReactNode;
}

/**
 * MarketplaceShell — dark cockpit wrapper for marketplace + dealer pages.
 * Provides consistent header + spacing. Use inside AppShell.
 *
 * Header is a column: title, then action buttons, then the banner. Nothing
 * in this stack shares a row with the location warning on iPhone notches.
 */
export function MarketplaceShell({ title, eyebrow, subtitle, right, banner, children }: Props) {
  return (
    <div className="thalvo-dark thalvo-cockpit min-h-[calc(100dvh-4rem)] w-full min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <div className="flex min-w-0 w-full flex-col gap-2">
        <CockpitHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actions={right} />
        {banner ? <div className="min-w-0 w-full">{banner}</div> : null}
      </div>
      {children}
    </div>
  );
}
