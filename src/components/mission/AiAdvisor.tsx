import { useState } from "react";
import { ChevronDown, Sparkle } from "lucide-react";
import { GlassPanel } from "./GlassPanel";

export interface AiRecommendation {
  id: string;
  title: string;
  detail: string;
  tone?: "info" | "warning" | "success";
  action?: { label: string; onClick: () => void };
}

interface Props {
  recommendations: AiRecommendation[];
  title?: string;
}

const TONE_DOT: Record<NonNullable<AiRecommendation["tone"]>, string> = {
  info:    "bg-sky-400",
  warning: "bg-amber-400",
  success: "bg-emerald-400",
};

/**
 * Calm AI recommendation surface. Never a modal. Never blocking.
 * Renders inline as a collapsible panel — captain reads at their own pace.
 */
export function AiAdvisor({ recommendations, title = "THALVO AI · Advisor" }: Props) {
  const [open, setOpen] = useState(true);
  if (recommendations.length === 0) return null;
  return (
    <GlassPanel padded={false} className="mission-rise overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <span className="relative grid place-items-center size-8 rounded-lg bg-sky-500/10 border border-sky-400/20 text-sky-300">
          <Sparkle className="size-4" />
        </span>
        <div className="flex-1 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recommendation</p>
          <p className="text-sm font-medium text-foreground">{title}</p>
        </div>
        <span className="text-[10px] text-muted-foreground font-medium mr-1">{recommendations.length}</span>
        <ChevronDown className={"size-4 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <ul className="border-t border-white/5 divide-y divide-white/5">
          {recommendations.map((r) => (
            <li key={r.id} className="px-4 py-3 flex items-start gap-3">
              <span className={"mt-1.5 size-1.5 rounded-full shrink-0 " + TONE_DOT[r.tone ?? "info"]} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{r.title}</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{r.detail}</p>
                {r.action && (
                  <button
                    onClick={r.action.onClick}
                    className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-sky-300 hover:text-sky-200"
                  >
                    {r.action.label} →
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
