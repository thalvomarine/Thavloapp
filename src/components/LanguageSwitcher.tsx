import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage?.startsWith("en") ? "en" : "tr";
  const base =
    tone === "dark"
      ? "bg-white/10 text-white border-white/20 hover:bg-white/20"
      : "bg-white text-deep border-border hover:bg-muted";
  return (
    <label className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${base}`}>
      <Globe className="size-3.5 opacity-80" />
      <select
        aria-label="Language"
        value={current}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="bg-transparent focus:outline-none pr-1 cursor-pointer"
      >
        <option value="tr" className="text-deep">TR</option>
        <option value="en" className="text-deep">EN</option>
      </select>
    </label>
  );
}
