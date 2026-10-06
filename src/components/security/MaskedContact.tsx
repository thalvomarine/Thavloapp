import { useEffect, useState } from "react";
import { EyeOff, Phone, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
 * The raw value stays hidden until `reveal_contact_allowed` confirms an admin.
 */
export function MaskedContact({ kind, value, reveal = false, className = "" }: Props) {
  const [allowed, setAllowed] = useState(false);
  const Icon = kind === "phone" ? Phone : Mail;

  useEffect(() => {
    if (!reveal) {
      setAllowed(false);
      return;
    }
    let live = true;
    supabase.rpc("reveal_contact_allowed").then(({ data }) => {
      if (live) setAllowed(data === true);
    });
    return () => {
      live = false;
    };
  }, [reveal]);

  const shown = reveal && allowed
    ? (value ?? "—")
    : kind === "phone" ? maskPhoneNumber(value) : maskEmail(value);

  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium tabular-nums text-white/80 " +
        className
      }
      title={reveal && allowed ? "Admin view" : "Protected contact — kept inside THALVO"}
    >
      <Icon className="size-3 text-white/50" />
      <span className="tracking-wider">{shown}</span>
      {reveal && allowed ? (
        <ShieldCheck className="size-3 text-emerald-300" />
      ) : (
        <EyeOff className="size-3 text-white/40" />
      )}
    </span>
  );
}
