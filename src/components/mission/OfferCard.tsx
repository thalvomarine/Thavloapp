import { useTranslation } from "react-i18next";
import { Anchor, Clock, Loader2, ShieldCheck, Star, Wrench } from "lucide-react";

export interface OfferCardData {
  id: string;
  providerName: string;
  role: "mechanic" | "diver";
  price: number;
  etaMinutes: number;
  distanceKm?: number | null;
  rating?: number | null;
  verified?: boolean;
  jobsCompleted?: number | null;
  note?: string | null;
}

interface Props {
  offer: OfferCardData;
  currencyFormat: (n: number) => string;
  onAccept?: (offer: OfferCardData) => void;
  onExplainTrust?: (offer: OfferCardData) => void;
  accepting?: boolean;
  selected?: boolean;
  disabled?: boolean;
}

/**
 * OfferCard — MarineOS offer surface (simplified).
 * Identity + price hero · one trust chip · muted ETA · single CTA.
 */
export function OfferCard({ offer, currencyFormat, onAccept, onExplainTrust, accepting, selected, disabled }: Props) {
  const { t } = useTranslation();
  const isDiver = offer.role === "diver";
  const rating = typeof offer.rating === "number" ? offer.rating : 5;
  const verified = offer.verified ?? true;

  return (
    <div
      className={
        "rounded-2xl border p-4 transition-colors " +
        (selected
          ? "border-sky-400/50 bg-sky-400/[0.06]"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]")
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={
            "size-11 rounded-xl grid place-items-center shrink-0 " +
            (isDiver
              ? "bg-cyan-500/15 border border-cyan-400/30 text-cyan-300"
              : "bg-sky-500/15 border border-sky-400/30 text-sky-300")
          }
        >
          {isDiver ? <Anchor className="size-5" /> : <Wrench className="size-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{offer.providerName}</p>
          <button
            type="button"
            onClick={onExplainTrust ? () => onExplainTrust(offer) : undefined}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 hover:text-white"
          >
            <Star className="size-2.5 fill-amber-300 text-amber-300" />
            <span className="tabular-nums text-amber-200">{rating.toFixed(1)}</span>
            {verified && (
              <>
                <span className="text-white/20">·</span>
                <ShieldCheck className="size-2.5 text-sky-300" />
                <span className="text-sky-200">{t("offer_card.verified")}</span>
              </>
            )}
          </button>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-semibold text-white tabular-nums tracking-tight leading-none">
            {currencyFormat(offer.price)}
          </p>
          <p className="mt-1.5 text-[11px] text-white/50 inline-flex items-center gap-1 justify-end">
            <Clock className="size-3" /> {offer.etaMinutes} min
          </p>
        </div>
      </div>

      {offer.note && (
        <p className="mt-3 text-[12px] text-white/60 whitespace-pre-wrap border-l-2 border-white/10 pl-3">
          {offer.note}
        </p>
      )}

      {onAccept && (
        <button
          type="button"
          onClick={() => onAccept(offer)}
          disabled={disabled || accepting}
          className="mt-3 w-full h-12 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
        >
          {accepting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {t("owner.accept_and_demo_pay", { defaultValue: "Accept & demo pay" })}
        </button>
      )}
    </div>
  );
}
