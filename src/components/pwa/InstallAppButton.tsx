import { useState } from "react";
import { Download, Info, Check } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { useInstallPrompt } from "@/lib/pwa";

/**
 * Install THALVO row for Profile > Settings.
 * - Chromium/Android: uses the captured beforeinstallprompt event.
 * - iOS Safari: renders a soft hint pointing to Share → Add to Home Screen.
 * - Already installed: shows an "installed" chip and hides the CTA.
 */
export function InstallAppButton() {
  const { canPrompt, installed, iosHint, promptInstall } = useInstallPrompt();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  if (installed) {
    return (
      <div className="w-full rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 flex items-center gap-3">
        <Check className="size-4 text-emerald-300" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{t("pwa.installed.title")}</p>
          <p className="text-[11px] text-white/60">{t("pwa.installed.hint")}</p>
        </div>
      </div>
    );
  }

  if (canPrompt) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await promptInstall();
          setBusy(false);
          if (res === "dismissed") setOutcome(t("pwa.install.dismissed"));
          if (res === "unavailable") setOutcome(t("pwa.install.unavailable"));
        }}
        className="w-full rounded-2xl border border-sky-400/40 bg-sky-500/10 hover:bg-sky-500/15 transition-colors px-4 py-3 flex items-center gap-3 text-left"
      >
        <Download className="size-4 text-sky-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{t("pwa.install.title")}</p>
          <p className="text-[11px] text-white/60">{outcome ?? t("pwa.install.hint")}</p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">{t("pwa.install.cta")}</span>
      </button>
    );
  }

  if (iosHint) {
    return (
      <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 flex items-start gap-3">
        <Info className="size-4 text-sky-300 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{t("pwa.ios.title")}</p>
          <p className="text-[11px] text-white/60 mt-0.5">
            <Trans
              i18nKey="pwa.ios.hint"
              components={{ strong: <span className="text-white/85" /> }}
            />
          </p>
        </div>
      </div>
    );
  }

  return null;
}
