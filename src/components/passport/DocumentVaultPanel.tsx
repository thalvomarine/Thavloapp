import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { FileText, ShieldAlert } from "lucide-react";

interface DocSlot {
  key: string;
  labelKey: string;
  hintKey: string;
  present: boolean;
}

interface Props {
  slots?: DocSlot[];
}

const DEFAULT_SLOTS: DocSlot[] = [
  { key: "registration", labelKey: "passport.doc_registration", hintKey: "passport.doc_registration_hint", present: false },
  { key: "insurance", labelKey: "passport.doc_insurance", hintKey: "passport.doc_insurance_hint", present: false },
  { key: "transit_log", labelKey: "passport.doc_transit_log", hintKey: "passport.doc_transit_log_hint", present: false },
  { key: "survey", labelKey: "passport.doc_survey", hintKey: "passport.doc_survey_hint", present: false },
];

/** Document vault — placeholder slots until secure uploads ship. */
export function DocumentVaultPanel({ slots = DEFAULT_SLOTS }: Props) {
  const { t } = useTranslation();
  return (
    <GlassPanel padded={false}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-sky-300/80" />
          <p className="text-sm font-medium text-white/90">{t("passport.document_vault")}</p>
        </div>
        <StatusChip tone="warning" icon={<ShieldAlert className="size-3" />}>{t("passport.documents_coming_soon")}</StatusChip>
      </div>
      <ul className="p-2">
        {slots.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl">
            <div className="min-w-0">
              <p className="text-sm text-white/85 truncate">{t(s.labelKey)}</p>
              <p className="text-[11px] text-white/45 truncate">{t(s.hintKey)}</p>
            </div>
            <StatusChip tone={s.present ? "success" : "neutral"}>{s.present ? t("passport.on_file") : t("passport.not_uploaded")}</StatusChip>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
