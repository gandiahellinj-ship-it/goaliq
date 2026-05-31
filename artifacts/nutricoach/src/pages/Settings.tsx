import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useT, useLanguage, type Lang } from "@/lib/language";
import { type Theme, getStoredTheme, applyTheme } from "@/lib/theme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Moon, Sun, Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [exporting, setExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Required confirmation word per language
  const requiredWord = lang === "es" ? "ELIMINAR" : "DELETE";
  const deleteCanProceed = deleteConfirmText === requiredWord;

  // GDPR Art. 20 — Export all user data as JSON
  const handleExportData = async () => {
    setExporting(true);
    const loadingToast = toast.loading(t("export_data_loading"));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No session");

      const res = await fetch("/api/export-data", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const contentDisposition = res.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `goaliq-export-${new Date().toISOString().slice(0, 10)}.json`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success(t("export_data_success"), { duration: 3000 });
    } catch (err) {
      console.error("Export error:", err);
      toast.dismiss(loadingToast);
      toast.error(t("export_data_error"));
    } finally {
      setExporting(false);
    }
  };

  // GDPR Art. 17 — Delete account (DB cascade) + logout
  const handleDeleteAccount = async () => {
    if (!deleteCanProceed) return;
    setDeleting(true);
    const loadingToast = toast.loading(t("delete_account_loading"));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No session");

      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmation: "DELETE_MY_ACCOUNT" }),
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);

      toast.dismiss(loadingToast);
      toast.success(t("delete_account_success"), { duration: 3000 });

      await logout();
      setLocation("/");
    } catch (err) {
      console.error("Delete error:", err);
      toast.dismiss(loadingToast);
      toast.error(t("delete_account_error"));
      setDeleting(false);
      // Do NOT close dialog so user can retry
    }
  };

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

      {/* ── 🛡️ Privacidad y datos (RGPD) ─────────────────────────────────── */}
      <section className="space-y-4 mt-8 pt-6" style={{ borderTop: "1px solid var(--giq-border)" }}>
        <div>
          <h2
            className="text-xs font-bold uppercase tracking-widest mb-1"
            style={{ color: "var(--giq-text-muted)" }}
          >
            {t("privacy_data_title")}
          </h2>
          <p className="text-sm" style={{ color: "var(--giq-text-muted)" }}>
            {t("privacy_data_subtitle")}
          </p>
        </div>

        {/* Links Privacy / Terms — read what you accepted */}
        <div className="space-y-2">
          <Link
            href="/privacy"
            className="block py-2 px-3 rounded-lg text-sm transition-opacity hover:opacity-80"
            style={{
              backgroundColor: "var(--giq-bg-card)",
              border: "1px solid var(--giq-border)",
              color: "var(--giq-text-primary)",
            }}
          >
            {t("view_privacy_policy")}
          </Link>
          <Link
            href="/terms"
            className="block py-2 px-3 rounded-lg text-sm transition-opacity hover:opacity-80"
            style={{
              backgroundColor: "var(--giq-bg-card)",
              border: "1px solid var(--giq-border)",
              color: "var(--giq-text-primary)",
            }}
          >
            {t("view_terms")}
          </Link>
        </div>

        {/* Export — GDPR Art. 20 */}
        <div
          className="p-4 rounded-lg"
          style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
        >
          <h3 className="font-semibold mb-1" style={{ color: "var(--giq-text-primary)" }}>
            📥 {t("export_data_title")}
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--giq-text-muted)" }}>
            {t("export_data_subtitle")}
          </p>
          <button
            onClick={handleExportData}
            disabled={exporting}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: "var(--giq-accent)",
              color: "var(--giq-accent-text)",
            }}
          >
            {exporting ? t("export_data_loading") : t("export_data_button")}
          </button>
        </div>

        {/* Delete — GDPR Art. 17 (destructive) */}
        <div
          className="p-4 rounded-lg"
          style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid #FF4444" }}
        >
          <h3 className="font-semibold mb-1" style={{ color: "#FF4444" }}>
            🗑️ {t("delete_account_title")}
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--giq-text-muted)" }}>
            {t("delete_account_subtitle")}
          </p>
          <button
            onClick={() => setDeleteDialogOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#FF4444", color: "white" }}
          >
            {t("delete_account_button")}
          </button>
        </div>
      </section>

      {/* Delete confirmation dialog with typed-word gate */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmText("");
          setDeleteDialogOpen(open);
        }}
      >
        <AlertDialogContent
          className="max-w-lg"
          style={{
            backgroundColor: "var(--giq-bg-card)",
            border: "2px solid #FF4444",
            color: "var(--giq-text-primary)",
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "#FF4444" }}>
              {t("delete_dialog_title")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 mt-3" style={{ color: "var(--giq-text-muted)" }}>
                <p className="font-medium" style={{ color: "var(--giq-text-primary)" }}>
                  {t("delete_dialog_intro")}
                </p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>{t("delete_dialog_item_profile")}</li>
                  <li>{t("delete_dialog_item_meals")}</li>
                  <li>{t("delete_dialog_item_progress")}</li>
                  <li>{t("delete_dialog_item_consents")}</li>
                  <li>{t("delete_dialog_item_beta")}</li>
                </ul>
                <div className="pt-3" style={{ borderTop: "1px solid var(--giq-border)" }}>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--giq-text-primary)" }}
                  >
                    {t("delete_dialog_confirm_label")}
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={t("delete_dialog_confirm_placeholder")}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: "var(--giq-bg-card-hover)",
                      border: deleteCanProceed ? "2px solid #FF4444" : "1px solid var(--giq-border)",
                      color: "var(--giq-text-primary)",
                    }}
                    autoComplete="off"
                    disabled={deleting}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel
              disabled={deleting}
              style={{
                backgroundColor: "var(--giq-bg-card-hover)",
                color: "var(--giq-text-primary)",
                border: "1px solid var(--giq-border)",
              }}
            >
              {t("delete_dialog_cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={!deleteCanProceed || deleting}
              style={{
                backgroundColor: deleteCanProceed && !deleting ? "#FF4444" : "#666",
                color: "white",
                cursor: deleteCanProceed && !deleting ? "pointer" : "not-allowed",
              }}
            >
              {deleting ? t("delete_account_loading") : t("delete_dialog_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
