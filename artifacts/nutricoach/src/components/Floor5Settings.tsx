import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { User, Globe, Sun, Moon, FileText, Shield, LogOut, ChevronRight, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage, type Lang } from "@/lib/language";
import { getStoredTheme, applyTheme, type Theme } from "@/lib/theme";

export default function Floor5Settings() {
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
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((n) => n![0])
      .join("")
      .toUpperCase() ||
    user?.username?.[0]?.toUpperCase() ||
    "U";
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    (isES ? "Usuario" : "User");

  return (
    <section className="flex h-full flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-grey)]">
          Piso 5 · Ajustes
        </p>
        <h2 className="font-display text-4xl font-extrabold text-[var(--color-brand-text-lbl)]">
          {isES ? "Ajustes" : "Settings"}
        </h2>
      </header>

      {/* Profile card */}
      <div className="flex items-center gap-4 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
          style={{ backgroundColor: "#BA9D79" }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--color-brand-text-lbl)]">{fullName}</p>
          <p className="truncate text-xs text-[var(--color-brand-grey)]">{user?.username ?? ""}</p>
        </div>
        <button
          onClick={() => setLocation("/profile/edit")}
          aria-label={isES ? "Editar perfil" : "Edit profile"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-brand-border)] text-[var(--color-brand-grey)]"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {/* Idioma */}
      <Group icon={<Globe className="h-4 w-4" />} title={isES ? "Idioma" : "Language"}>
        <div className="flex gap-2">
          {(["es", "en"] as Lang[]).map((l) => (
            <Segment key={l} active={lang === l} onClick={() => setLang(l)}>
              {l === "es" ? "Español" : "English"}
            </Segment>
          ))}
        </div>
      </Group>

      {/* Tema */}
      <Group icon={theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} title={isES ? "Tema de la app" : "App theme"}>
        <div className="flex gap-2">
          <Segment active={theme === "light"} onClick={() => handleTheme("light")}>
            <Sun className="h-4 w-4" /> {isES ? "Claro" : "Light"}
          </Segment>
          <Segment active={theme === "dark"} onClick={() => handleTheme("dark")}>
            <Moon className="h-4 w-4" /> {isES ? "Oscuro" : "Dark"}
          </Segment>
        </div>
      </Group>

      {/* Cuenta */}
      <div className="space-y-2">
        <Row icon={<User className="h-4 w-4" />} label={isES ? "Mi perfil" : "My profile"} onClick={() => setLocation("/profile")} />
        <Row icon={<Shield className="h-4 w-4" />} label={isES ? "Privacidad" : "Privacy"} onClick={() => setLocation("/privacy")} />
        <Row icon={<FileText className="h-4 w-4" />} label={isES ? "Términos" : "Terms"} onClick={() => setLocation("/terms")} />
      </div>

      {/* Logout */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={async () => {
          await logout();
          setLocation("/");
        }}
        className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] py-3.5 text-sm font-semibold text-red-500"
      >
        <LogOut className="h-4 w-4" />
        {isES ? "Cerrar sesión" : "Log out"}
      </motion.button>
    </section>
  );
}

function Group({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-grey)]">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-transparent bg-[var(--color-brand-cyan)] text-white"
          : "border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-lbl)]"
      }`}
    >
      {children}
    </button>
  );
}

function Row({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3 text-left"
    >
      <span className="text-[var(--color-brand-grey)]">{icon}</span>
      <span className="flex-1 text-sm font-medium text-[var(--color-brand-text-lbl)]">{label}</span>
      <ChevronRight className="h-4 w-4 text-[var(--color-brand-grey)]" />
    </button>
  );
}
