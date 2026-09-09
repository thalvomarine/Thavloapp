import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

const BUCKET = "part-images";
// Mirrors the server-side bucket limits (file_size_limit / allowed_mime_types).
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  value: string;
  onChange: (url: string) => void;
  userId: string;
};

export function ImageUploader({ value, onChange, userId }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pathFromUrl = (url: string): string | null => {
    const marker = `/${BUCKET}/`;
    const i = url.indexOf(marker);
    if (i === -1) return null;
    return url.substring(i + marker.length);
  };

  const upload = async (file: File) => {
    if (!ACCEPT.includes(file.type)) {
      toast.error(t("uploader.invalid_type", "Unsupported image format"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("uploader.too_large", "Image is larger than 5 MB"));
      return;
    }
    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    setBusy(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("mime") || msg.includes("content type")) {
        toast.error(
          t(
            "uploader.server_rejected_type",
            "Server rejected this file: only JPG, PNG or WEBP images are allowed.",
          ),
        );
      } else if (msg.includes("size") || msg.includes("large") || msg.includes("exceeded")) {
        toast.error(
          t(
            "uploader.server_rejected_size",
            "Server rejected this file: images must be 5 MB or smaller.",
          ),
        );
      } else {
        toast.error(error.message);
      }
      return;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
    toast.success(t("uploader.uploaded", "Image uploaded"));
  };

  const remove = async () => {
    const path = value ? pathFromUrl(value) : null;
    onChange("");
    if (path && path.startsWith(`${userId}/`)) {
      await supabase.storage.from(BUCKET).remove([path]);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-white/5">
          <img src={value} alt="" className="w-full h-40 object-cover" />
          <button
            type="button"
            onClick={remove}
            className="absolute top-2 right-2 size-8 grid place-items-center rounded-full bg-black/70 text-white hover:bg-black/90"
            aria-label={t("uploader.remove", "Remove image")}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full h-32 rounded-xl border-2 border-dashed border-white/15 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-2 text-white/60 text-xs font-medium disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          <span>
            {busy
              ? t("uploader.uploading", "Uploading…")
              : t("uploader.click_to_upload", "Click to upload image")}
          </span>
          <span className="text-[10px] text-white/40">
            {t("uploader.hint", "JPG, PNG or WEBP · max 5 MB")}
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
