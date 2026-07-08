import { useState } from "react";
import { useLocation } from "wouter";
import { User, Globe, Sun, Moon, FileText, Shield, LogOut, ChevronRight, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage, type Lang } from "@/lib/language";
import { getStoredTheme, applyTheme, type Theme } from "@/lib/theme";

/**
 * AJUSTES (Phase 5) — top zone. Same REAL settings as before (auth, language,
 * theme, profile/privacy/terms nav, logout) restyled for the 3-zone layout.
 * Logout uses the tokenized red. The version + privacy note live in the
 * contextual zone (SettingsContext).
 */
export default function SettingsTab() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { lang, setLang } = useLanguage();
  const isES = lang === "es";
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  const handleTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  const initials =
    [user?.firstName, user?.lastName].filter(Boolean).map((n) => n![0]).join("").toUpperCase() ||
    user?.username?.[0]?.toUpperCase() ||
    "U";
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || (isES ? "Usuario" : "User");

  return (
    <div className="flex h-full flex-col">
      <div className="pr-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Ajustes</p>
        <h2 className="font-display text-2xl font-extrabold leading-none text-[var(--color-brand-text-lbl)]">
          {isES ? "Ajustes" : "Settings"}
        </h2>
      </div>

      {/* Profile */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "var(--color-brand-accent)" }}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--color-brand-text-lbl)]">{fullName}</p>
          <p className="truncate text-[11px] text-[var(--color-brand-grey)]">{user?.username ?? ""}</p>
        </div>
        <button
          onClick={() => setLocation("/profile/edit")}
          aria-label={isES ? "Editar perfil" : "Edit profile"}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-brand-border)] text-[var(--color-brand-grey)]"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {/* Language */}
      <p className="mt-3 mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-grey)]">
        <Globe className="h-3.5 w-3.5" /> {isES ? "Idioma" : "Language"}
      </p>
      <div className="flex gap-2">
        {(["es", "en"] as Lang[]).map((l) => (
          <Segment key={l} active={lang === l} onClick={() => setLang(l)}>
            {l === "es" ? "Español" : "English"}
          </Segment>
        ))}
      </div>

      {/* Theme */}
      <p className="mt-3 mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-grey)]">
        {theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />} {isES ? "Tema" : "Theme"}
      </p>
      <div className="flex gap-2">
        <Segment active={theme === "light"} onClick={() => handleTheme("light")}>
          <Sun className="h-4 w-4" /> {isES ? "Claro" : "Light"}
        </Segment>
        <Segment active={theme === "dark"} onClick={() => handleTheme("dark")}>
          <Moon className="h-4 w-4" /> {isES ? "Oscuro" : "Dark"}
        </Segment>
      </div>

      {/* Account rows */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col justify-end gap-2">
        <Row icon={<User className="h-4 w-4" />} label={isES ? "Mi perfil" : "My profile"} onClick={() => setLocation("/profile")} />
        <Row icon={<Shield className="h-4 w-4" />} label={isES ? "Privacidad" : "Privacy"} onClick={() => setLocation("/privacy")} />
        <Row icon={<FileText className="h-4 w-4" />} label={isES ? "Términos" : "Terms"} onClick={() => setLocation("/terms")} />
        <button
          onClick={async () => {
            await logout();
            setLocation("/");
          }}
          className="mt-1 flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold"
          style={{ borderColor: "var(--color-brand-border)", background: "var(--color-brand-card)", color: "var(--color-brand-red)" }}
        >
          <LogOut className="h-4 w-4" />
          {isES ? "Cerrar sesión" : "Log out"}
        </button>
      </div>
    </div>
  );
}

/** AJUSTES contextual — app version + short privacy note. */
export function SettingsContext() {
  const { lang } = useLanguage();
  const isES = lang === "es";
  return (
    <div className="text-[12px] leading-relaxed text-[var(--color-brand-grey)]">
      GoalIQ · v0.4 beta
      <br />
      {isES
        ? "Tus datos se guardan de forma privada. Puedes exportarlos o borrarlos desde Privacidad."
        : "Your data is stored privately. You can export or delete it from Privacy."}
    </div>
  );
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-[13px] font-medium transition-colors"
      style={
        active
          ? { background: "var(--color-brand-accent)", borderColor: "transparent", color: "#fff" }
          : { background: "var(--color-brand-card)", borderColor: "var(--color-brand-border)", color: "var(--color-brand-text-lbl)" }
      }
    >
      {children}
    </button>
  );
}

function Row({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-2.5 text-left"
    >
      <span className="text-[var(--color-brand-grey)]">{icon}</span>
      <span className="flex-1 text-sm font-medium text-[var(--color-brand-text-lbl)]">{label}</span>
      <ChevronRight className="h-4 w-4 text-[var(--color-brand-grey)]" />
    </button>
  );
}
