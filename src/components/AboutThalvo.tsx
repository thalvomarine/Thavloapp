import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";

/**
 * AboutThalvo — compact "About THALVO" card for the profile page.
 * Visual-only, no data fetching. Future-vision section is a collapsed
 * <details> to keep the card short on mobile.
 */
export function AboutThalvo() {
  const { t } = useTranslation();

  return (
    <GlassPanel className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{t("about.title")}</h3>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300/90">
          {t("about.subtitle")}
        </span>
      </div>

      <p className="text-[12px] leading-relaxed text-white/70">{t("about.body")}</p>

      <div className="grid grid-cols-1 gap-2">
        <MiniRow label={t("about.who_title")} body={t("about.who_body")} />
        <MiniRow label={t("about.purpose_title")} body={t("about.purpose_body")} />
      </div>

      <details className="group rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
        <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60 flex items-center justify-between">
          <span>{t("about.vision_title")}</span>
          <span className="text-white/40 group-open:rotate-180 transition-transform">⌄</span>
        </summary>
        <p className="mt-2 text-[12px] leading-relaxed text-white/65">{t("about.vision_body")}</p>
      </details>

      <p className="pt-1 text-center text-[10px] italic text-amber-200/70">
        {t("about.tagline")}
      </p>
    </GlassPanel>
  );
}

function MiniRow({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">{label}</p>
      <p className="mt-0.5 text-[12px] leading-snug text-white/75">{body}</p>
    </div>
  );
}
