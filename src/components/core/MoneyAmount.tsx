import { formatMoney } from "@/lib/formatters";

interface Props {
  value: number | null | undefined;
  precise?: boolean;
  muted?: boolean;
  currency?: string;
  className?: string;
  tone?: "default" | "gold";
}

/** MoneyAmount — tabular value with consistent formatting. Defaults to TRY. */
export function MoneyAmount({ value, precise, muted, currency, className = "", tone = "default" }: Props) {
  const color =
    tone === "gold" ? "text-gold" : muted ? "text-white/60" : "text-white";
  return (
    <span className={`tabular-nums font-semibold ${color} ${className}`}>
      {formatMoney(value, { precise, currency })}
    </span>
  );
}
