import { AlertOctagon } from "lucide-react";

interface Props {
  onClick: () => void;
  label?: string;
  compact?: boolean;
}

/**
 * SOS dock — always-accessible emergency affordance. Reserved bright color.
 * Floating pill on the bottom-LEFT (mirrors the top-left MetoceanHud/brand
 * stack) so it never competes with the bottom-right FAB stack (compass /
 * locate / AI) or the coordinate readout — that corner is reserved for
 * chartplotter controls.
 */
export function SosDock({ onClick, label = "SOS", compact = false }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label="Emergency SOS"
      className={
        "group fixed z-40 left-4 inline-flex items-center gap-2 rounded-full " +
        "text-white font-bold tracking-[0.18em] uppercase " +
        (compact ? "h-12 px-4 text-xs" : "h-14 px-5 text-sm") +
        " shadow-[0_18px_50px_-10px_rgba(244,63,94,0.65)] transition-transform active:scale-[0.97]"
      }
      style={{
        // Bottom-left, clear of the centered nav capsule and the safe-area
        // inset on iOS home-indicator devices.
        bottom: "max(1rem, env(safe-area-inset-bottom))",
        background: "linear-gradient(135deg, oklch(0.68 0.24 25) 0%, oklch(0.6 0.24 18) 100%)",
        boxShadow: "0 18px 50px -10px rgba(244,63,94,0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
      }}
    >
      {/* Soft breathing glow behind the pill — the emergency affordance should
          read as "always alive" even when idle, without disturbing the label. */}
      <span className="absolute -inset-1.5 -z-10 rounded-full bg-red-500/40 blur-md animate-pulse" />

      <span className="relative grid place-items-center size-6 rounded-full bg-white/15">
        <span className="absolute inset-0 rounded-full bg-white/40 animate-ping opacity-60" />
        <AlertOctagon className="relative size-3.5" />
      </span>
      {label}
    </button>
  );
}
