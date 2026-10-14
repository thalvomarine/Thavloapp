import { useTranslation } from "react-i18next";
import { Wordmark } from "./Wordmark";

type Props = {
  /** Full-screen splash (cold boot) vs soft in-shell pending for tab switches. */
  variant?: "fullscreen" | "inline";
};

export function ThalvoLoader({ variant = "fullscreen" }: Props) {
  const { t } = useTranslation();

  if (variant === "inline") {
    return (
      <div
        className="flex min-h-[42vh] flex-col items-center justify-center gap-5 px-6 py-14 text-white"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Wordmark size="md" className="opacity-90" />
        <div className="h-0.5 w-28 overflow-hidden rounded-full bg-white/10">
          <div className="thalvo-inline-bar h-full w-1/2 rounded-full bg-amber-400/85" />
        </div>
        <p className="text-[10px] tracking-wide text-white/45">{t("loading.caption")}</p>
        <style>{`
          @keyframes thalvoInlineBar {
            0% { transform: translateX(-120%); }
            100% { transform: translateX(220%); }
          }
          .thalvo-inline-bar { animation: thalvoInlineBar 1.05s ease-in-out infinite; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-between py-16 bg-[#0A192F] text-white overflow-hidden">
      <div aria-hidden className="absolute inset-0 opacity-40"
        style={{ background: "radial-gradient(60% 40% at 50% 45%, rgba(0,180,216,0.25), transparent 70%)" }} />
      <div className="flex-1" />
      <div className="relative flex flex-col items-center gap-6">
        <span className="thalvo-pulse">
          <Wordmark size="xl" />
        </span>
        <svg width="180" height="24" viewBox="0 0 180 24" fill="none" className="thalvo-wave" aria-hidden>
          <path d="M0 12 Q 22.5 0 45 12 T 90 12 T 135 12 T 180 12" stroke="#F5B942" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      <div className="flex-1" />
      <div className="relative text-center px-6">
        <p className="text-xs sm:text-sm text-white/80 font-semibold tracking-wide">{t("slogan.tagline")}</p>
        <p className="mt-2 text-[10px] text-white/50 tracking-wide">{t("loading.caption")}</p>
      </div>
      <style>{`
        @keyframes thalvoPulse { 0%,100% { transform: scale(0.96); opacity: 0.8; } 50% { transform: scale(1.04); opacity: 1; } }
        .thalvo-pulse { display: inline-block; animation: thalvoPulse 1.4s ease-in-out infinite; }

        @keyframes thalvoWave { 0%,100% { transform: translateY(0); opacity: 0.7; } 50% { transform: translateY(-4px); opacity: 1; } }
        .thalvo-wave { animation: thalvoWave 1.1s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
