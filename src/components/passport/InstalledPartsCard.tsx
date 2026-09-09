import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { Package } from "lucide-react";
import { formatTL } from "@/lib/filter";

export interface InstalledPart {
  id: string;
  part_name: string;
  part_price: number | null;
  installed_at: string;
  source?: string | null;
}

interface Props {
  parts: InstalledPart[];
}

/** Installed parts — pulled from completed job_parts for the vessel owner. */
export function InstalledPartsCard({ parts }: Props) {
  const { t } = useTranslation();
  return (
    <GlassPanel padded={false}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="size-4 text-sky-300/80" />
          <p className="text-sm font-medium text-white/90">{t("passport.installed_parts")}</p>
        </div>
        <span className="text-[10px] text-white/40">{t("passport.parts_logged", { count: parts.length })}</span>
      </div>
      {parts.length === 0 ? (
        <p className="p-4 text-sm text-white/50">{t("passport.no_parts_yet")}</p>
      ) : (
        <ul className="p-2">
          {parts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.03]">
              <div className="min-w-0">
                <p className="text-sm text-white/90 truncate">{p.part_name}</p>
                <p className="text-[10px] text-white/40">{new Date(p.installed_at).toLocaleDateString()} · {p.source || t("passport.part_source_provider")}</p>
              </div>
              {p.part_price != null && (
                <span className="text-xs text-white/70 font-medium tabular-nums">{formatTL(p.part_price)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
