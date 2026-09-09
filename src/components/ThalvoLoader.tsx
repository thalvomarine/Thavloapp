import { useTranslation } from "react-i18next";
import { Wordmark } from "./Wordmark";

export function ThalvoLoader() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between py-16 bg-[#0A192F] text-white overflow-hidden">
      <div aria-hidden className="absolute inset-0 opacity-40"
        style={{ background: "radial-gradient(60% 40% at 50% 45%, rgba(0,180,216,0.25), transparent 70%)" }} />
      <div className="flex-1" />
      <div className="relative flex flex-col items-center gap-6">
        <span className="thalvo-pulse">
          <Wordmark size="xl" />
        </span>
        <svg width="180" height="24" viewBox="0 0 180 24" fill="none" className="thalvo-wave" aria-hidden>
          <path d="M0 12 Q 22.5 0 45 12 T 90 12 T 135 12 T 180 12" stroke="#00B4D8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      <div className="flex-1" />
      <div className="relative text-center px-6">
        <p className="text-xs sm:text-sm text-white/80 font-semibold tracking-wide">{t("slogan.tagline")}</p>
        <p className="mt-2 text-[10px] text-white/50 tracking-wide">{t("loading.caption")}</p>
      </div>
      <style>{`
        @keyframes thalvoPulse { 0%,100% { transform: scale(0.96); opacity: 0.8; } 50% { transform: scale(1.04); opacity: 1; } }
        .thalvo-pulse { display: inline-block; animation: thalvoPulse 2.4s ease-in-out infinite; }

        @keyframes thalvoWave { 0%,100% { transform: translateY(0); opacity: 0.7; } 50% { transform: translateY(-4px); opacity: 1; } }
        .thalvo-wave { animation: thalvoWave 1.8s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
