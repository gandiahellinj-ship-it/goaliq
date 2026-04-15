import { useState, useEffect } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "goaliq-theme";
const DEFAULT_THEME: Theme = "dark";

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme;
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  return DEFAULT_THEME;
}

export function applyTheme(theme: Theme) {
  const html = document.documentElement;
  html.classList.remove("theme-dark", "theme-light");
  html.classList.add(`theme-${theme}`);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
}

export function getThemeAccent(): string {
  try {
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue("--giq-accent")
        .trim() || "#AAFF45"
    );
  } catch {
    return "#AAFF45";
  }
}

export function getThemeAccentText(): string {
  try {
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue("--giq-accent-text")
        .trim() || "#0A0A0A"
    );
  } catch {
    return "#0A0A0A";
  }
}

export function useThemeAccent(): string {
  const [accent, setAccent] = useState<string>(getThemeAccent);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setAccent(getThemeAccent());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return accent;
}
