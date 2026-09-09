import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  ZONE_KINDS,
  ZONE_KIND_LABEL_KEYS,
  formatDegrees,
  type MarineZoneKind,
} from "@/lib/marine-data";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Coordinate of the admin's chart click; the form never invents one. */
  position: { lat: number; lng: number } | null;
  onSaved: () => void;
}

const fieldClass =
  "w-full h-9 rounded-lg border border-cyan-500/25 bg-[#0a192f]/70 px-2.5 text-[12px] text-white outline-none focus:border-cyan-400/70";

/** Admin-only "draw a new chart point" modal, writing to `marine_zones`. */
export function AdminZoneDialog({ open, onOpenChange, position, onSaved }: Props) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<MarineZoneKind>("marina");
  const [name, setName] = useState("");
  const [vhf, setVhf] = useState("");
  const [depth, setDepth] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!position) {
      setError(t("chart.zone_need_position"));
      return;
    }
    if (name.trim().length < 2) {
      setError(t("chart.zone_need_name"));
      return;
    }
    setPending(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("marine_zones").insert({
      kind,
      name: name.trim().slice(0, 120),
      lat: position.lat,
      lng: position.lng,
      vhf_channel: vhf.trim() === "" ? null : vhf.trim().slice(0, 12),
      depth_m: depth.trim() === "" ? null : Number(depth),
      description: description.trim() === "" ? null : description.trim().slice(0, 600),
      created_by: auth.user?.id ?? null,
    });
    setPending(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    toast.success(t("chart.zone_saved"));
    setName("");
    setVhf("");
    setDepth("");
    setDescription("");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) onOpenChange(v);
      }}
    >
      <DialogContent className="thalvo-dark border-cyan-500/30 bg-[#0a192f]/95 text-white backdrop-blur-xl sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-white">{t("chart.zone_title")}</DialogTitle>
          <DialogDescription className="text-white/60">
            {t("chart.zone_subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 font-mono text-[11px] text-cyan-100">
            {position ? formatDegrees(position.lat, position.lng) : t("chart.report_no_position")}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/70">
                {t("chart.zone_kind")}
              </span>
              <select
                className={fieldClass}
                value={kind}
                onChange={(e) => setKind(e.target.value as MarineZoneKind)}
              >
                {ZONE_KINDS.map((k) => (
                  <option key={k} value={k} className="bg-[#0a192f]">
                    {t(ZONE_KIND_LABEL_KEYS[k])}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/70">
                {t("chart.zone_name")}
              </span>
              <input
                className={fieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/70">
                {t("chart.zone_vhf")}
              </span>
              <input
                className={fieldClass}
                value={vhf}
                onChange={(e) => setVhf(e.target.value)}
                placeholder="73"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/70">
                {t("chart.zone_depth")}
              </span>
              <input
                className={fieldClass}
                inputMode="decimal"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/70">
              {t("chart.zone_description")}
            </span>
            <textarea
              rows={3}
              maxLength={600}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-cyan-500/25 bg-[#0a192f]/70 p-2.5 text-[12px] text-white outline-none focus:border-cyan-400/70"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-200">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="h-9 rounded-lg border border-white/15 px-3 text-[11px] font-semibold text-white/70 disabled:opacity-50"
          >
            {t("admin.actions.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cyan-400 px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0a192f] disabled:opacity-50"
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {t("chart.zone_save")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
