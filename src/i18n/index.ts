import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import tr from "./locales/tr.json";
import en from "./locales/en.json";
import el from "./locales/el.json";

const STORAGE_KEY = "thalvo-lang";

export type AppLng = "tr" | "en" | "el";

/**
 * Bundled catalogs — imported as JSON so Capacitor's `capacitor://` /
 * `file://` WebView never has to fetch `/locales/*.json` at runtime.
 * `initAsync: false` keeps `t()` usable on the first render; the previous
 * `void i18n.init()` + LanguageDetector path left keys like
 * `public.hero_headline` on screen until a later tick.
 */
const resources = {
  tr: { translation: tr },
  en: { translation: en },
  el: { translation: el },
} as const;

export function normalizeAppLng(raw: string | null | undefined): AppLng {
  const lng = (raw ?? "").toLowerCase();
  if (lng.startsWith("el") || lng.startsWith("gr")) return "el";
  if (lng.startsWith("en")) return "en";
  return "tr";
}

function readStoredLng(): AppLng | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "tr" || stored === "el") return stored;
  } catch {
    /* private mode / WebView storage blocked */
  }
  try {
    const nav = (navigator.language || navigator.languages?.[0] || "").toLowerCase();
    if (nav.startsWith("el") || nav.startsWith("gr")) return "el";
    if (nav.startsWith("en")) return "en";
  } catch {
    /* navigator unavailable */
  }
  return null;
}

/** First paint is always TR so SSR HTML matches the client's hydrate pass. */
let persistLanguage = false;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: "tr",
    fallbackLng: ["tr", "en"],
    supportedLngs: ["tr", "en", "el"],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    ns: ["translation"],
    defaultNS: "translation",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    // Bundled resources: do not defer catalog application to setTimeout.
    initAsync: false,
  });
}

i18n.on("languageChanged", (lng) => {
  if (!persistLanguage) return;
  const next = normalizeAppLng(lng);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
});

/** Apply localStorage / navigator language after hydration. */
export function applyPreferredLanguage() {
  persistLanguage = true;
  const stored = readStoredLng();
  if (stored && stored !== normalizeAppLng(i18n.resolvedLanguage)) {
    void i18n.changeLanguage(stored);
  }
}

export default i18n;

/** Canonical problem-category keys — same key on both sides of the marketplace,
 *  so a TR diver and EN captain see the same job with locale-appropriate labels. */
export const PROBLEM_KEYS = {
  mechanic: ["engine_breakdown", "starter_failure", "cooling", "fuel", "electrical", "other_mech"] as const,
  diver: ["rope_propeller", "stuck_anchor", "hull_cleaning", "lost_item"] as const,
};

export type MechanicProblem = (typeof PROBLEM_KEYS.mechanic)[number];
export type DiverProblem = (typeof PROBLEM_KEYS.diver)[number];
