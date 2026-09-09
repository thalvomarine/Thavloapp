import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { Sparkles, Loader2, Send } from "lucide-react";
import { askThalvoAi } from "@/lib/thalvo-ai.functions";
import { useServerFn } from "@tanstack/react-start";
import type { VesselIdentity } from "./VesselIdentityCard";

interface Props {
  vessel: VesselIdentity;
  context: {
    activeMissions: number;
    completedMissions: number;
    installedParts: string[];
    lastServiceAt: string | null;
  };
}

/** VesselAiPanel — calm AI advisor grounded in vessel data. */
export function VesselAiPanel({ vessel, context }: Props) {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askThalvoAi);

  const suggestions = useMemo(
    () => [
      t("passport.ai_suggest_pre_departure"),
      t("passport.ai_suggest_vibration"),
      t("passport.ai_suggest_maintenance"),
    ],
    [t],
  );

  const send = async (prompt: string) => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setAnswer(null);
    const primer =
      `Vessel dossier — name: ${vessel.name || "unnamed"}; type: ${vessel.vessel_type || "?"}; ` +
      `length: ${vessel.length_m ?? "?"}m; engine: ${vessel.engine_model || "?"}; fuel: ${vessel.fuel_type || "?"}; ` +
      `home marina: ${vessel.home_marina || "?"}. ` +
      `Active missions: ${context.activeMissions}. Completed missions: ${context.completedMissions}. ` +
      `Recently installed parts: ${context.installedParts.slice(0, 6).join(", ") || "none"}. ` +
      `Last service: ${context.lastServiceAt ?? "unknown"}. ` +
      `Captain question: ${prompt}`;
    try {
      const r = await ask({
        data: { messages: [{ role: "user", content: primer }], lang: i18n.resolvedLanguage?.startsWith("tr") ? "tr" : "en" },
      });
      setAnswer(r.text);
    } catch {
      setAnswer(t("passport.ai_unavailable"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassPanel>
      <div className="flex items-center gap-2 mb-3">
        <div className="size-8 rounded-xl bg-sky-400/10 border border-sky-400/25 grid place-items-center text-sky-300">
          <Sparkles className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-white/90">{t("passport.ai_title")}</p>
          <p className="text-[11px] text-white/45">{t("passport.ai_subtitle")}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => { setQ(s); void send(s); }}
            className="text-[11px] rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] px-2.5 py-1 text-white/75"
          >
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); void send(q); }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("passport.ai_placeholder")}
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-sky-400/40"
        />
        <button
          type="submit"
          disabled={loading || !q.trim()}
          className="rounded-xl border border-sky-400/30 bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-50 px-3 text-sky-200"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
      {answer && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/85 whitespace-pre-wrap leading-relaxed">
          {answer}
        </div>
      )}
    </GlassPanel>
  );
}
