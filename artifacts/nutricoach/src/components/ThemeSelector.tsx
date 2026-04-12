import { useState, useEffect, useRef } from "react";
import { type Theme, getStoredTheme, applyTheme } from "@/lib/theme";
import { motion, AnimatePresence } from "framer-motion";

const THEMES: { value: Theme; icon: string; label: string }[] = [
  { value: "dark", icon: "🌑", label: "Oscuro" },
  { value: "light", icon: "☀️", label: "Claro" },
  { value: "melatonina", icon: "🌙", label: "Melatonina" },
];

function getPillStyle(theme: Theme): { background: string; border: string; color: string } {
  switch (theme) {
    case "light":
      return { background: "#FFFFFF", border: "1px solid #E0E0E0", color: "#111111" };
    case "melatonina":
      return { background: "#1A0800", border: "1px solid #FF6B2B", color: "#FF6B2B" };
    default:
      return { background: "#1A1A1A", border: "1px solid #2A2A2A", color: "#FFFFFF" };
  }
}

interface ThemeSelectorProps {
  variant?: "floating" | "sidebar";
}

export function ThemeSelector({ variant = "floating" }: ThemeSelectorProps) {
  const [current, setCurrent] = useState<Theme>(getStoredTheme);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentTheme = THEMES.find((t) => t.value === current) ?? THEMES[0];
  const pill = getPillStyle(current);

  function select(theme: Theme) {
    setCurrent(theme);
    applyTheme(theme);
    setOpen(false);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (variant === "floating") {
    return (
      <div ref={ref} style={{ position: "fixed", top: 12, right: 16, zIndex: 9999 }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: pill.background,
            border: pill.border,
            borderRadius: 20,
            padding: "6px 14px",
            fontSize: 13,
            color: pill.color,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>{currentTheme.icon}</span>
          <span>{currentTheme.label}</span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                background: "var(--giq-bg-card)",
                border: "1px solid var(--giq-border)",
                borderRadius: 12,
                padding: 4,
                minWidth: 160,
              }}
            >
              {THEMES.map((t) => (
                <ThemeOption key={t.value} theme={t} current={current} onSelect={select} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ padding: "0 12px 8px", position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          background: pill.background,
          border: pill.border,
          borderRadius: 20,
          padding: "6px 14px",
          fontSize: 13,
          color: pill.color,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>{currentTheme.icon}</span>
        <span style={{ flex: 1, textAlign: "left" }}>{currentTheme.label}</span>
        <span style={{ opacity: 0.5, fontSize: 10 }}>▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              position: "absolute",
              bottom: "calc(100% + 4px)",
              left: 12,
              right: 12,
              background: "var(--giq-bg-card)",
              border: "1px solid var(--giq-border)",
              borderRadius: 12,
              padding: 4,
              zIndex: 100,
            }}
          >
            {THEMES.map((t) => (
              <ThemeOption key={t.value} theme={t} current={current} onSelect={select} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemeOption({
  theme,
  current,
  onSelect,
}: {
  theme: (typeof THEMES)[number];
  current: Theme;
  onSelect: (t: Theme) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onSelect(theme.value)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        height: 36,
        padding: "0 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 8,
        background: hovered ? "var(--giq-border)" : "transparent",
        border: "none",
        cursor: "pointer",
        color: "var(--giq-text-primary)",
        fontSize: 13,
        textAlign: "left",
        transition: "background 0.1s",
      }}
    >
      <span>{theme.icon}</span>
      <span style={{ flex: 1 }}>{theme.label}</span>
      {theme.value === current && (
        <span style={{ color: "var(--giq-accent)", fontSize: 12, fontWeight: 700 }}>✓</span>
      )}
    </button>
  );
}
