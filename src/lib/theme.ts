import { useEffect, useState } from "react";

/** night = black, day = white, system = the current Thalvo cockpit. */
export type ThalvoTheme = "night" | "day" | "system";

const KEY = "thalvo-theme";

export function readThalvoTheme(): ThalvoTheme {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "night" || raw === "day" || raw === "system") return raw;
  } catch {
    /* private mode */
  }
  return "system";
}

export function applyThalvoTheme(theme: ThalvoTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.thalvoTheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      "content",
      theme === "day" ? "#f4f7fb" : theme === "night" ? "#000000" : "#0A192F",
    );
  }
}

export function writeThalvoTheme(theme: ThalvoTheme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  applyThalvoTheme(theme);
}

export function useThalvoTheme() {
  const [theme, setTheme] = useState<ThalvoTheme>("system");
  useEffect(() => {
    const current = readThalvoTheme();
    setTheme(current);
    applyThalvoTheme(current);
  }, []);
  const choose = (next: ThalvoTheme) => {
    setTheme(next);
    writeThalvoTheme(next);
  };
  return { theme, choose };
}
