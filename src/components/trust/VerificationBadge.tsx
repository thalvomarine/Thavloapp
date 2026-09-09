import { BadgeCheck, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  verified: boolean;
  label?: string;
  className?: string;
}

/** VerificationBadge — compact chip for KYC / document status. */
export function VerificationBadge({ verified, label, className = "" }: Props) {
  const { t } = useTranslation();
  const text = label ?? (verified ? t("trust.verification.verified") : t("trust.verification.unverified"));
  const styles = verified
    ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
    : "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] " +
        styles + " " + className
      }
    >
      {verified ? <BadgeCheck className="size-2.5" /> : <ShieldAlert className="size-2.5" />}
      {text}
    </span>
  );
}
