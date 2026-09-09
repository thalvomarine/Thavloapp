import { ShieldCheck } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { StatusTone, TrustTone } from "@/types/marine";

const MAP: Record<TrustTone, { tone: StatusTone; label: string }> = {
  reliable: { tone: "success", label: "Reliable" },
  building: { tone: "info", label: "Building" },
  watch: { tone: "warning", label: "Watch" },
  risk: { tone: "danger", label: "Risk" },
};

interface Props {
  tone: TrustTone;
  score?: number | null;
}

/** TrustBadge — normalized trust pill for provider/dealer surfaces. */
export function TrustBadge({ tone, score }: Props) {
  const m = MAP[tone];
  return (
    <StatusBadge tone={m.tone} icon={<ShieldCheck className="size-3" />}>
      {m.label}
      {score != null ? ` · ${Math.round(score)}` : ""}
    </StatusBadge>
  );
}
