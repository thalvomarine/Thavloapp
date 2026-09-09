import { EyeOff, Phone, Mail, ShieldCheck } from "lucide-react";
import { maskEmail, maskPhoneNumber } from "@/lib/security";

interface Props {
  kind: "phone" | "email";
  value: string | null | undefined;
  /** When true, reveal the actual value (admin surfaces only). */
  reveal?: boolean;
  className?: string;
}

/**
 * MaskedContact — display a phone or email safely.
 * Non-admins always see the masked variant; admins may pass reveal=true.
 * TODO(admin-reveal): gate `reveal` behind server-side has_role check when
 * the admin contact view route ships.
 */
export function MaskedContact({ kind, value, reveal = false, className = "" }: Props) {
  const Icon = kind === "phone" ? Phone : Mail;
  const shown = reveal
    ? (value ?? "—")
    : kind === "phone" ? maskPhoneNumber(value) : maskEmail(value);

  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium tabular-nums text-white/80 " +
        className
      }
      title={reveal ? "Admin view" : "Protected contact — kept inside THALVO"}
    >
      <Icon className="size-3 text-white/50" />
      <span className="tracking-wider">{shown}</span>
      {reveal ? (
        <ShieldCheck className="size-3 text-emerald-300" />
      ) : (
        <EyeOff className="size-3 text-white/40" />
      )}
    </span>
  );
}
