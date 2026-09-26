import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileText, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";

const BUCKET = "vessel-documents";
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const SLOTS = [
  { key: "registration", labelKey: "passport.doc_registration", hintKey: "passport.doc_registration_hint" },
  { key: "insurance", labelKey: "passport.doc_insurance", hintKey: "passport.doc_insurance_hint" },
  { key: "transit_log", labelKey: "passport.doc_transit_log", hintKey: "passport.doc_transit_log_hint" },
  { key: "survey", labelKey: "passport.doc_survey", hintKey: "passport.doc_survey_hint" },
] as const;

type SlotKey = (typeof SLOTS)[number]["key"];

interface VaultRow {
  id: string;
  slot: SlotKey;
  storage_path: string;
  file_name: string;
  mime: string;
}

function extensionFor(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function DocumentVaultPanel({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<VaultRow[]>([]);
  const [busySlot, setBusySlot] = useState<SlotKey | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<SlotKey | null>(null);

  const load = () => {
    void supabase
      .from("vessel_documents")
      .select("id, slot, storage_path, file_name, mime")
      .eq("owner_id", userId)
      .then(({ data, error }) => {
        if (error) {
          console.warn("[vault] vessel_documents unavailable", error.message);
          return;
        }
        setRows((data as VaultRow[] | null) ?? []);
      });
  };

  useEffect(() => {
    load();
    // owner scope
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const bySlot = new Map(rows.map((row) => [row.slot, row]));

  const upload = async (slot: SlotKey, file: File) => {
    const mime = file.type === "image/jpg" ? "image/jpeg" : file.type;
    if (!ACCEPT.includes(mime)) {
      toast.error(t("passport.doc_type"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("passport.doc_size"));
      return;
    }
    setBusySlot(slot);
    const path = `${userId}/${slot}/${crypto.randomUUID()}.${extensionFor(mime)}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: mime,
      upsert: false,
    });
    if (uploadError) {
      setBusySlot(null);
      toast.error(t("passport.doc_failed"));
      return;
    }
    const previous = bySlot.get(slot);
    const { error: rowError } = await supabase.from("vessel_documents").upsert(
      {
        owner_id: userId,
        slot,
        storage_path: path,
        file_name: file.name.slice(0, 180),
        mime,
        byte_size: file.size,
      },
      { onConflict: "owner_id,slot" },
    );
    if (rowError) {
      await supabase.storage.from(BUCKET).remove([path]);
      setBusySlot(null);
      toast.error(t("passport.doc_failed"));
      return;
    }
    if (previous && previous.storage_path !== path) {
      await supabase.storage.from(BUCKET).remove([previous.storage_path]);
    }
    setBusySlot(null);
    toast.success(t("passport.doc_saved"));
    load();
  };

  const openFile = async (row: VaultRow) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error(t("passport.doc_failed"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const remove = async (row: VaultRow) => {
    setBusySlot(row.slot);
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
    const { error } = await supabase.from("vessel_documents").delete().eq("id", row.id).eq("owner_id", userId);
    setBusySlot(null);
    if (error) {
      toast.error(t("passport.doc_failed"));
      return;
    }
    toast.success(t("passport.doc_removed"));
    load();
  };

  return (
    <GlassPanel padded={false}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 p-4">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-sky-300/80" />
          <p className="text-sm font-medium text-white/90">{t("passport.document_vault")}</p>
        </div>
        <StatusChip tone="info" icon={<ShieldCheck className="size-3" />}>{t("passport.doc_private")}</StatusChip>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const slot = pendingSlot.current;
          event.target.value = "";
          if (file && slot) void upload(slot, file);
        }}
      />
      <ul className="p-2">
        {SLOTS.map((slot) => {
          const row = bySlot.get(slot.key);
          const busy = busySlot === slot.key;
          return (
            <li key={slot.key} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-white/85">{t(slot.labelKey)}</p>
                <p className="truncate text-[11px] text-white/45">
                  {row ? row.file_name : t(slot.hintKey)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {busy ? (
                  <Loader2 className="size-4 animate-spin text-cyan-200" />
                ) : row ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void openFile(row)}
                      className="h-8 rounded-lg border border-white/15 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/80"
                    >
                      {t("passport.doc_open")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pendingSlot.current = slot.key;
                        inputRef.current?.click();
                      }}
                      className="h-8 rounded-lg border border-white/15 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/80"
                    >
                      {t("passport.doc_replace")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(row)}
                      className="h-8 rounded-lg px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-200"
                    >
                      {t("passport.doc_remove")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      pendingSlot.current = slot.key;
                      inputRef.current?.click();
                    }}
                    className="h-8 rounded-lg bg-amber-200 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-950"
                  >
                    {t("passport.doc_upload")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
