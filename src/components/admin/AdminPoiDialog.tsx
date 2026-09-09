import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { isValidCoordinate } from "@/lib/geolocation";
import { ZONE_KINDS, ZONE_KIND_LABEL_KEYS, type MarineZoneKind } from "@/lib/marine-data";

interface Props {
  onSaved: () => void;
}

const fieldClass =
  "w-full h-9 rounded-lg border border-cyan-500/25 bg-[#0a192f]/70 px-2.5 text-[12px] text-white outline-none focus:border-cyan-400/70";
const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/70";

/**
 * Manual chart-point entry — the Control Tower counterpart to the on-map
 * "draw a point" flow. Admins type coordinates directly (no need to be
 * looking at the live chart) and the point writes straight to
 * `marine_zones`, going live the moment `loadZones()` re-reads it.
 */
export function AdminPoiDialog({ onSaved }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MarineZoneKind>("marina");
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [vhf, setVhf] = useState("");
  const [depth, setDepth] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setKind("marina");
    setName("");
    setLat("");
    setLng("");
    setVhf("");
    setDepth("");
    setDescription("");
    setError(null);
  };

  const save = async () => {
    setError(null);
    const latNum = Number(lat.trim());
    const lngNum = Number(lng.trim());
    if (lat.trim() === "" || lng.trim() === "" || !isValidCoordinate(latNum, lngNum)) {
      setError(t("admin.poi.need_coords"));
      return;
    }
    if (name.trim().length < 2) {
      setError(t("admin.poi.need_name"));
      return;
    }
    setPending(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("marine_zones").insert({
      kind,
      name: name.trim().slice(0, 120),
      lat: latNum,
      lng: lngNum,
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
    toast.success(t("admin.poi.saved_toast"));
    reset();
    setOpen(false);
    onSaved();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/15 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-100 transition-colors hover:bg-cyan-400/25"
      >
        <Plus className="size-3.5" />
        {t("admin.poi.trigger")}
      </button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!pending) {
            setOpen(v);
            if (!v) reset();
          }
        }}
      >
        <DialogContent className="thalvo-dark border-cyan-500/30 bg-[#0a192f]/95 text-white backdrop-blur-xl sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-white">{t("admin.poi.title")}</DialogTitle>
            <DialogDescription className="text-white/60">
              {t("admin.poi.subtitle")}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={labelClass}>{t("admin.poi.category")}</span>
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
                <span className={labelClass}>{t("admin.poi.name")}</span>
                <input
                  className={fieldClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={labelClass}>{t("admin.poi.lat")}</span>
                <input
                  className={"font-mono " + fieldClass}
                  inputMode="decimal"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="36.7525"
                />
              </label>
              <label className="block">
                <span className={labelClass}>{t("admin.poi.lng")}</span>
                <input
                  className={"font-mono " + fieldClass}
                  inputMode="decimal"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="28.9428"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={labelClass}>{t("admin.poi.vhf")}</span>
                <input
                  className={fieldClass}
                  value={vhf}
                  onChange={(e) => setVhf(e.target.value)}
                  placeholder="73"
                />
              </label>
              <label className="block">
                <span className={labelClass}>{t("admin.poi.depth")}</span>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  value={depth}
                  onChange={(e) => setDepth(e.target.value)}
                  placeholder="6"
                />
              </label>
            </div>

            <label className="block">
              <span className={labelClass}>{t("admin.poi.description")}</span>
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
              onClick={() => setOpen(false)}
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
              {t("admin.poi.save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
