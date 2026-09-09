import { Clock } from "lucide-react";
import { formatEta } from "@/lib/formatters";
import { StatusBadge } from "./StatusBadge";
import type { StatusTone } from "@/types/marine";

interface Props {
  minutes: number | null | undefined;
  tone?: StatusTone;
  label?: string;
}

/** EtaBadge — normalized "ETA · 18 min" pill. */
export function EtaBadge({ minutes, tone = "info", label = "ETA" }: Props) {
  return (
    <StatusBadge tone={tone} icon={<Clock className="size-3" />}>
      {label} · {formatEta(minutes)}
    </StatusBadge>
  );
}
