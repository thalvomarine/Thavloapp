import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { SectionHeader } from "@/components/core/SectionHeader";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useThalvoTheme, type ThalvoTheme } from "@/lib/theme";
import { useSessionUser } from "@/lib/session";
import { useNavigate } from "@tanstack/react-router";

const THEMES: ThalvoTheme[] = ["system", "day", "night"];

/** Shared account desk: language, appearance, signed-in email, sign out. */
export function AccountSettings() {
  const { t } = useTranslation();
  const { theme, choose } = useThalvoTheme();
  const { user } = useSessionUser();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <GlassPanel className="space-y-4">
      <SectionHeader label={t("profile.settings")} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-medium text-white/70">{t("profile.language")}</p>
        <LanguageSwitcher tone="dark" />
      </div>
      <div>
        <p className="text-[12px] font-medium text-white/70">{t("profile.appearance")}</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {THEMES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => choose(item)}
              className={
                "h-10 rounded-xl border text-[12px] font-semibold " +
                (theme === item
                  ? "border-cyan-300 bg-cyan-400/15 text-cyan-50"
                  : "border-white/10 bg-white/5 text-white/65")
              }
            >
              {t(`profile.theme_${item}`)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-white/45">{t(`profile.theme_${theme}_hint`)}</p>
      </div>
      {user?.email && (
        <p className="truncate text-[12px] text-white/55">
          <span className="text-white/35">{t("auth.email")} · </span>
          {user.email}
        </p>
      )}
      <button
        type="button"
        onClick={() => void signOut()}
        className="h-11 w-full rounded-xl border border-white/15 text-[13px] font-semibold text-white/80"
      >
        {t("profile.sign_out")}
      </button>
    </GlassPanel>
  );
}
