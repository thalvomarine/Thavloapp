import { useMemo, type ReactNode } from "react";
import { classifyLeakRisk, riskCopy, type LeakReport } from "@/lib/security";
import { SecurityWarningBanner } from "./SecurityWarningBanner";

interface Props {
  value: string;
  children: (state: {
    report: LeakReport;
    blocked: boolean;
    canSend: boolean;
  }) => ReactNode;
  /** When true (default) high-risk messages cannot be sent. */
  blockHighRisk?: boolean;
  className?: string;
}

/**
 * MessageLeakGuard — headless guard that classifies message text and
 * enforces a block on high-risk content.
 *
 * Usage: wrap your composer and render input + button via children.
 * Pair with server-side `mask_job_message` trigger for defense-in-depth.
 */
export function MessageLeakGuard({ value, children, blockHighRisk = true, className = "" }: Props) {
  const report = useMemo(() => classifyLeakRisk(value), [value]);
  const blocked = blockHighRisk && report.risk === "high";
  const canSend = !blocked;
  const copy = riskCopy(report.risk);

  return (
    <div className={className}>
      {report.risk !== "safe" && (
        <SecurityWarningBanner
          risk={report.risk}
          title={copy.title}
          body={copy.body}
          className="mb-2"
        />
      )}
      {children({ report, blocked, canSend })}
    </div>
  );
}
