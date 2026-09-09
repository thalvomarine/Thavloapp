import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CreditCard, Loader2, ShieldCheck, Lock, CheckCircle2, X, AlertTriangle, WifiOff, FlaskConical } from "lucide-react";
import { formatTL } from "@/lib/filter";
import { useOnlineStatus } from "@/lib/pwa";

interface Props {
  open: boolean;
  amount: number;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onPaid: () => Promise<void> | void;
  cta?: string;
  tone?: "marine" | "amber";
}

/**
 * Simulated / test-mode checkout.
 *
 * NOTE: No real payment provider is wired. This modal exists to make the
 * simulated escrow flow visible and honest — captains must consciously
 * "confirm" a test payment before we mark the job as funded. onPaid runs
 * ONLY after the user submits the (fake) card form.
 *
 * Hardening:
 *  - Offline guard: refuses while `navigator.onLine === false`.
 *  - Duplicate-submit lock via `phase === "processing"`.
 *  - onPaid errors surface in-modal; the caller does not need to unmount it.
 *  - Success screen holds briefly, then `onClose()` fires exactly once.
 *  - Client-side validation on the fake card fields so users experience
 *    the "form → confirmation" contract even though nothing is sent.
 */
export function CheckoutModal({ open, amount, title, subtitle, onClose, onPaid, cta, tone = "marine" }: Props) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [phase, setPhase] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      setPhase("idle");
      setErrMsg(null);
      setCard("");
      setExp("");
      setCvc("");
      setName("");
    }
  }, [open]);

  if (!open) return null;

  const validate = (): string | null => {
    const digits = card.replace(/\s/g, "");
    if (!name.trim()) return t("checkout.field_required");
    if (digits.length < 13) return t("checkout.field_required");
    if (!/^\d{2}\/\d{2}$/.test(exp.trim())) return t("checkout.field_required");
    if (!/^\d{3,4}$/.test(cvc.trim())) return t("checkout.field_required");
    return null;
  };

  const pay = async () => {
    if (phase === "processing") return; // duplicate-submit guard
    if (!online) {
      setPhase("error");
      setErrMsg("You appear to be offline. Reconnect to run the simulated payment.");
      return;
    }
    const invalid = validate();
    if (invalid) {
      setPhase("error");
      setErrMsg(invalid);
      return;
    }
    setPhase("processing");
    setErrMsg(null);
    try {
      await new Promise((r) => setTimeout(r, 900));
      await onPaid();
      setPhase("done");
      await new Promise((r) => setTimeout(r, 900));
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Simulated payment could not complete.";
      setPhase("error");
      setErrMsg(msg);
    }
  };

  const grad = tone === "amber" ? "amber-gradient text-warning-foreground" : "marine-gradient text-white";
  const busy = phase === "processing";

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className={"p-5 " + grad}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] opacity-80 font-bold inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" /> {t("checkout.title")}
              </p>
              <h3 className="mt-1 text-xl font-bold">{title}</h3>
              {subtitle && <p className="text-sm opacity-90 mt-0.5">{subtitle}</p>}
            </div>
            {!busy && (
              <button onClick={onClose} aria-label="Close" className="size-9 grid place-items-center rounded-full bg-black/20 hover:bg-black/30">
                <X className="size-4" />
              </button>
            )}
          </div>
          <p className="mt-4 text-4xl font-black tabular-nums">{formatTL(amount)}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] opacity-80">Test amount · not charged</p>
        </div>

        {phase === "done" ? (
          <div className="p-8 text-center">
            <div className="mx-auto size-16 rounded-full bg-success/20 grid place-items-center">
              <CheckCircle2 className="size-9 text-success" />
            </div>
            <p className="mt-4 font-bold text-lg">{t("checkout.secured")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("checkout.secured_sub")}</p>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="rounded-xl border-2 border-amber-400/60 bg-amber-400/[0.14] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100 inline-flex items-center gap-2 w-full">
              <FlaskConical className="size-3.5 shrink-0" />
              <span>{t("checkout.test_mode_badge")}</span>
            </div>
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.1] px-3 py-2 text-[11px] text-amber-200 leading-relaxed">
              {t("checkout.sim_banner")}
            </div>
            {!online && (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100 inline-flex items-start gap-2">
                <WifiOff className="size-3.5 mt-0.5 shrink-0" />
                You are offline. Reconnect to run the simulated payment — nothing has been sent.
              </div>
            )}
            {phase === "error" && errMsg && (
              <div role="alert" className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100 inline-flex items-start gap-2">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                <span>{errMsg}</span>
              </div>
            )}
            <div className="relative rounded-2xl border-2 border-dashed border-amber-400/40 bg-muted/20 p-3 space-y-3">
              <div className="absolute -top-2 left-3 px-1.5 py-0.5 rounded-md bg-amber-400/90 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-900 inline-flex items-center gap-1">
                <FlaskConical className="size-2.5" /> {t("checkout.test_mode_badge")}
              </div>
              <div className="rounded-xl border border-border p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <CreditCard className="size-4" /> {t("checkout.card")}
                </div>
                <input
                  value={card}
                  onChange={(e) => setCard(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={23}
                  className="mt-1 w-full bg-transparent text-lg font-semibold tracking-widest tabular-nums focus:outline-none placeholder:text-white/20"
                />
              </div>
              <div className="rounded-xl border border-border p-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground">{t("checkout.name")}</p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Test Captain"
                  autoComplete="off"
                  maxLength={64}
                  className="mt-1 w-full bg-transparent text-lg font-semibold focus:outline-none placeholder:text-white/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border p-3 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground">{t("checkout.exp")}</p>
                  <input
                    value={exp}
                    onChange={(e) => setExp(e.target.value)}
                    placeholder="12/28"
                    autoComplete="off"
                    maxLength={5}
                    className="mt-1 w-full bg-transparent text-lg font-semibold focus:outline-none placeholder:text-white/20"
                  />
                </div>
                <div className="rounded-xl border border-border p-3 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground">{t("checkout.cvc")}</p>
                  <input
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    placeholder="123"
                    autoComplete="off"
                    maxLength={4}
                    inputMode="numeric"
                    className="mt-1 w-full bg-transparent text-lg font-semibold focus:outline-none placeholder:text-white/20"
                  />
                </div>
              </div>
              <p className="text-[10px] text-amber-200/80 text-center italic">
                {t("checkout.test_mode_fields_note")}
              </p>
            </div>
            <button
              onClick={pay}
              disabled={busy || !online}
              className={"mt-2 w-full h-14 rounded-2xl font-bold text-lg inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed " + grad}
            >
              {busy ? (
                <><Loader2 className="size-5 animate-spin" /> {t("checkout.processing")}</>
              ) : phase === "error" ? (
                <><Lock className="size-5" /> Retry simulated payment</>
              ) : (
                <><Lock className="size-5" /> {cta ?? t("checkout.labor_pay")}</>
              )}
            </button>
            {phase === "error" && (
              <button
                onClick={onClose}
                className="w-full h-10 rounded-xl border border-white/10 text-white/70 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
