import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, LocateFixed, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GEO_OPTIONS, getFix, isValidCoordinate } from "@/lib/geolocation";
import {
  NOTE_FORM_CATEGORIES,
  REPORT_CATEGORY_LABEL_KEYS,
  SEABED_LABEL_KEYS,
  SEABEDS,
  formatDegrees,
  type ReportCategory,
  type Seabed,
} from "@/lib/marine-data";
import { sanitizeMultiline } from "@/lib/sanitize";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  picked: { lat: number; lng: number } | null;
  onSubmitted: () => void;
}

const fieldClass =
  "w-full min-h-11 rounded-lg border border-cyan-500/25 bg-[#0a192f]/70 px-2.5 text-[13px] text-white outline-none focus:border-cyan-400/70";
const labelClass =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/80";

/**
 * Passage / bay note sheet. Portaled onto `document.body` so it sits above
 * the fullscreen HUD overlay (z-600) and remains tappable on iOS.
 */
export function ReportModal({ open, onOpenChange, picked, onSubmitted }: Props) {
  const { t } = useTranslation();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(picked);
  const [locating, setLocating] = useState(false);
  const [category, setCategory] = useState<ReportCategory>("anchorage");
  const [seabed, setSeabed] = useState<Seabed | "">("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setCoords(picked);
  }, [open, picked]);

  if (!open || typeof document === "undefined") return null;

  const effective = picked ?? coords;

  const grabMyPosition = async () => {
    setLocating(true);
    setError(null);
    const res = await getFix(GEO_OPTIONS);
    setLocating(false);
    if (!res.ok) {
      setError(t(res.failure.messageKey, { defaultValue: res.failure.defaultMessage }));
      return;
    }
    setCoords({ lat: res.fix.lat, lng: res.fix.lng });
  };

  const reset = () => {
    setNote("");
    setSeabed("");
    setCoords(null);
    setCategory("anchorage");
  };

  const submit = async () => {
    setError(null);
    if (!effective || !isValidCoordinate(effective.lat, effective.lng)) {
      setError(t("chart.report_need_position"));
      return;
    }
    const noteText = sanitizeMultiline(note, 1000);
    if (noteText.length < 3) {
      setError(t("chart.report_need_note"));
      return;
    }
    setPending(true);
    const { data: auth } = await supabase.auth.getUser();
    const titleText = t(REPORT_CATEGORY_LABEL_KEYS[category]);
    const { error: insertError } = await supabase.from("community_reports").insert({
      reporter_id: auth.user?.id ?? null,
      title: titleText.slice(0, 120),
      category,
      lat: effective.lat,
      lng: effective.lng,
      depth_m: null,
      seabed: seabed === "" ? null : seabed,
      note: noteText,
      submitted_by: null,
      status: "pending_approval",
    });
    setPending(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    toast.success(t("chart.report_sent"));
    reset();
    onOpenChange(false);
    onSubmitted();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 z-[99] bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!pending) onOpenChange(false);
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="thalvo-add-note-title"
        className="thalvo-dark pointer-events-auto absolute inset-x-0 bottom-0 z-[100] mx-auto flex w-full max-w-lg flex-col rounded-t-3xl border border-cyan-500/30 bg-[#0a192f]/97 shadow-2xl sm:bottom-auto sm:top-1/2 sm:max-h-[85dvh] sm:-translate-y-1/2 sm:rounded-3xl"
        style={{
          maxHeight: "85dvh",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
              {t("chart.report_eyebrow")}
            </p>
            <h2 id="thalvo-add-note-title" className="mt-1 text-base font-semibold text-white">
              {t("chart.report_title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            aria-label={t("common.close")}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <p className={labelClass}>{t("chart.report_position")}</p>
            <div className="flex items-center gap-2">
              <span className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2.5 font-mono text-[11px] text-cyan-100">
                {effective
                  ? formatDegrees(effective.lat, effective.lng)
                  : t("chart.report_no_position")}
              </span>
              <button
                type="button"
                onClick={() => void grabMyPosition()}
                disabled={locating}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-100 disabled:opacity-50"
              >
                {locating ? <Loader2 className="size-3.5 animate-spin" /> : <LocateFixed className="size-3.5" />}
                {t("chart.report_use_gps")}
              </button>
            </div>
          </div>

          <div>
            <p className={labelClass}>{t("chart.report_category")}</p>
            <div className="grid grid-cols-2 gap-2">
              {NOTE_FORM_CATEGORIES.map((c) => {
                const selected = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={
                      "min-h-11 rounded-xl border px-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors " +
                      (selected
                        ? "border-amber-300/60 bg-amber-300/15 text-amber-100"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10")
                    }
                  >
                    {t(REPORT_CATEGORY_LABEL_KEYS[c])}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className={labelClass}>{t("chart.report_note")}</span>
            <textarea
              rows={4}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("chart.report_note_placeholder")}
              className="w-full rounded-lg border border-cyan-500/25 bg-[#0a192f]/70 p-3 text-[13px] text-white outline-none focus:border-cyan-400/70"
            />
          </label>

          <div>
            <p className={labelClass}>{t("chart.report_seabed")}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {SEABEDS.map((s) => {
                const selected = seabed === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeabed(s)}
                    className={
                      "min-h-11 rounded-xl border px-1 text-[10px] font-semibold uppercase tracking-[0.06em] " +
                      (selected
                        ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/65")
                    }
                  >
                    {t(SEABED_LABEL_KEYS[s])}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-200">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-white/10 px-4 pt-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={pending}
            className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-amber-300 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-900 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {t("chart.report_submit")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
