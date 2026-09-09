import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import tr from "./locales/tr.json";
import en from "./locales/en.json";

// Auto-detect from browser (navigator.language) and persist to localStorage.
// Fallback to Turkish per Aegean-first audience.
if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        tr: { translation: tr },
        en: { translation: en },
      },
      fallbackLng: "tr",
      supportedLngs: ["tr", "en"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        caches: ["localStorage"],
        lookupLocalStorage: "thalvo-lang",
      },
    });
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
