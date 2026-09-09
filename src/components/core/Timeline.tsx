import type { ReactNode } from "react";
import type { StatusTone } from "@/types/marine";

const DOT: Record<StatusTone, string> = {
  neutral: "bg-white/25",
  info: "bg-sky-400 shadow-[0_0_10px_theme(colors.sky.400)]",
  success: "bg-emerald-400 shadow-[0_0_10px_theme(colors.emerald.400)]",
  warning: "bg-amber-400 shadow-[0_0_10px_theme(colors.amber.400)]",
  danger: "bg-rose-500 shadow-[0_0_10px_theme(colors.rose.500)]",
};

interface StepProps {
  tone?: StatusTone;
  title: ReactNode;
  detail?: ReactNode;
  time?: ReactNode;
  active?: boolean;
  last?: boolean;
}

/** TimelineStep — single row inside a Timeline. */
export function TimelineStep({
  tone = "neutral",
  title,
  detail,
  time,
  active = false,
  last = false,
}: StepProps) {
  return (
    <li className="relative pl-6">
      {!last && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-white/10" />}
      <span
        className={
          "absolute left-0 top-1.5 size-3.5 rounded-full ring-2 ring-black/30 " +
          DOT[tone] +
          (active ? " animate-pulse" : "")
        }
      />
      <div className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-white">{title}</p>
          {time && <p className="text-[10px] text-white/40 shrink-0">{time}</p>}
        </div>
        {detail && <p className="text-[11px] text-white/55 mt-0.5">{detail}</p>}
      </div>
    </li>
  );
}

/** Timeline — vertical operational timeline. */
export function Timeline({ children }: { children: ReactNode }) {
  return <ol className="relative">{children}</ol>;
}
