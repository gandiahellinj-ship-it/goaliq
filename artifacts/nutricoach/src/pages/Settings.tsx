import { useState } from "react";
import { useT, useLanguage, type Lang } from "@/lib/language";
import { type Theme, getStoredTheme, applyTheme } from "@/lib/theme";
import { Moon, Sun, Check } from "lucide-react";

export default function Settings() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  function handleTheme(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  function handleLang(next: Lang) {
    setLang(next);
  }

  return (
    <div className="p-5 sm:p-7 lg:p-10 max-w-2xl mx-auto space-y-8 pb-28">

      {/* Header */}
      <div>
        <h1
          className="text-2xl font-display font-black uppercase"
          style={{ color: "var(--giq-text-primary)" }}
        >
          {t("settings_title")}
        </h1>
      </div>

      {/* ── Appearance ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "var(--giq-text-muted)" }}
        >
          {t("appearance")}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {(["dark", "light"] as Theme[]).map((themeOption) => {
            const isActive = theme === themeOption;
            const label = themeOption === "dark" ? t("dark_mode") : t("light_mode");
            const Icon = themeOption === "dark" ? Moon : Sun;

            return (
              <button
                key={themeOption}
                onClick={() => handleTheme(themeOption)}
                className="relative flex flex-col items-center gap-3 p-5 rounded-xl transition-all text-center"
                style={{
                  backgroundColor: isActive
                    ? "color-mix(in srgb, var(--giq-accent) 8%, var(--giq-bg-card))"
                    : "var(--giq-bg-card)",
                  border: isActive
                    ? "2px solid var(--giq-accent)"
                    : "2px solid var(--giq-border)",
                }}
              >
                {isActive && (
                  <span
                    className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--giq-accent)" }}
                  >
                    <Check className="w-3 h-3" style={{ color: "var(--giq-accent-text)" }} />
                  </span>
                )}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: isActive
                      ? "color-mix(in srgb, var(--giq-accent) 15%, transparent)"
                      : "var(--giq-border)",
                  }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: isActive ? "var(--giq-accent)" : "var(--giq-text-muted)" }}
                  />
                </div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: isActive ? "var(--giq-accent)" : "var(--giq-text-primary)" }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Language ───────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "var(--giq-text-muted)" }}
        >
          Idioma · Language
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "es" as Lang, flag: "🇪🇸", name: "Español", subtitle: "España" },
              { value: "en" as Lang, flag: "🇬🇧", name: "English", subtitle: "United Kingdom" },
            ] as const
          ).map(({ value, flag, name, subtitle }) => {
            const isActive = lang === value;
            return (
              <button
                key={value}
                onClick={() => handleLang(value)}
                className="relative flex flex-col items-center gap-3 p-5 rounded-xl transition-all text-center"
                style={{
                  backgroundColor: isActive
                    ? "color-mix(in srgb, var(--giq-accent) 8%, var(--giq-bg-card))"
                    : "var(--giq-bg-card)",
                  border: isActive
                    ? "2px solid var(--giq-accent)"
                    : "2px solid var(--giq-border)",
                }}
              >
                {isActive && (
                  <span
                    className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--giq-accent)" }}
                  >
                    <Check className="w-3 h-3" style={{ color: "var(--giq-accent-text)" }} />
                  </span>
                )}
                <span className="text-3xl leading-none">{flag}</span>
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: isActive ? "var(--giq-accent)" : "var(--giq-text-primary)" }}
                  >
                    {name}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--giq-text-muted)" }}
                  >
                    {subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

    </div>
  );
}
