import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, BellOff, Pill, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language";
import { useAuth } from "@/hooks/useAuth";
import {
  useUserSupplements,
  useUpdateSupplements,
  getReminderEnabled,
  setReminderEnabled,
  syncSupplementSchedule,
} from "@/lib/supplements-service";
import { SUPPLEMENTS, type StoredSupplement } from "@/lib/supplements";
import SupplementSelector from "./SupplementSelector";

type Tab = "recordatorio" | "suplementos";

export default function SupplementsModal({ onClose }: { onClose: () => void }) {
  const { lang } = useLanguage();
  const isES = lang === "es";
  const { user } = useAuth();

  const { data: supplements = [], isLoading } = useUserSupplements();
  const updateSupplements = useUpdateSupplements();

  const hasSupplements = supplements.length > 0;
  const [tab, setTab] = useState<Tab>("recordatorio");
  // Lets a user with 0 supplements reveal the selector to add their first.
  const [adding, setAdding] = useState(false);
  const showSuppTab = hasSupplements || adding;

  const [reminderOn, setReminderOn] = useState(false);
  useEffect(() => {
    setReminderOn(getReminderEnabled(user?.id));
  }, [user?.id]);

  const nameOf = (id: string) => SUPPLEMENTS.find((s) => s.id === id)?.name ?? id;
  const emojiOf = (id: string) => SUPPLEMENTS.find((s) => s.id === id)?.emoji ?? "💊";

  const persist = (next: StoredSupplement[]) => {
    updateSupplements.mutate(next, {
      onSuccess: () => {
        if (reminderOn && user?.id) {
          // Phase 2 seam — currently a no-op until the OneSignal backend lands.
          void syncSupplementSchedule({ userId: user.id, enabled: true, supplements: next });
        }
      },
      // Visible failure: the mutation already rolls the optimistic cache back
      // (see useUpdateSupplements.onError); this makes sure the user is told.
      onError: (err) => {
        toast.error(
          isES ? "No se pudieron guardar los suplementos" : "Couldn't save supplements",
          { description: err instanceof Error ? err.message : undefined },
        );
      },
    });
  };

  const toggleReminder = (next: boolean) => {
    setReminderOn(next);
    setReminderEnabled(user?.id, next);
    if (user?.id) {
      void syncSupplementSchedule({ userId: user.id, enabled: next, supplements });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        key="sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className="absolute inset-x-0 bottom-0 z-40 flex max-h-[88%] flex-col rounded-t-3xl border-t border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] pb-safe"
        role="dialog"
        aria-modal="true"
      >
        {/* Grabber + header */}
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-brand-border)]" />
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold text-[var(--color-brand-text-lbl)]">
              <Pill className="h-5 w-5 text-[var(--color-brand-accent)]" />
              {isES ? "Suplementos" : "Supplements"}
            </h2>
            <button
              onClick={onClose}
              aria-label={isES ? "Cerrar" : "Close"}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-brand-border)] text-[var(--color-brand-grey)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 rounded-full bg-[var(--color-brand-card)] p-1">
            <TabButton active={tab === "recordatorio"} onClick={() => setTab("recordatorio")}>
              {isES ? "Recordatorio" : "Reminder"}
            </TabButton>
            {showSuppTab && (
              <TabButton active={tab === "suplementos"} onClick={() => setTab("suplementos")}>
                {isES ? "Mis suplementos" : "My supplements"}
              </TabButton>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-hide">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-[var(--color-brand-grey)]">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tab === "recordatorio" ? (
            <ReminderTab
              isES={isES}
              hasSupplements={hasSupplements}
              supplements={supplements}
              reminderOn={reminderOn}
              onToggle={toggleReminder}
              onAddFirst={() => {
                setAdding(true);
                setTab("suplementos");
              }}
              nameOf={nameOf}
              emojiOf={emojiOf}
            />
          ) : (
            <div>
              {updateSupplements.isPending && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-[var(--color-brand-grey)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {isES ? "Guardando…" : "Saving…"}
                </p>
              )}
              {updateSupplements.isError && !updateSupplements.isPending && (
                <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-red)]/10 px-2.5 py-1.5 text-xs font-medium text-[var(--color-brand-red)]">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {isES
                    ? "No se pudo guardar. Se han restaurado los cambios; inténtalo de nuevo."
                    : "Couldn't save. Your changes were reverted; please try again."}
                </p>
              )}
              <SupplementSelector value={supplements} onChange={persist} isES={isES} />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function TabButton({
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
      className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-[var(--color-brand-text-lbl)] text-white"
          : "text-[var(--color-brand-grey)]"
      }`}
    >
      {children}
    </button>
  );
}

function ReminderTab({
  isES,
  hasSupplements,
  supplements,
  reminderOn,
  onToggle,
  onAddFirst,
  nameOf,
  emojiOf,
}: {
  isES: boolean;
  hasSupplements: boolean;
  supplements: StoredSupplement[];
  reminderOn: boolean;
  onToggle: (next: boolean) => void;
  onAddFirst: () => void;
  nameOf: (id: string) => string;
  emojiOf: (id: string) => string;
}) {
  if (!hasSupplements) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-card)] text-[var(--color-brand-grey)]">
          <BellOff className="h-6 w-6" />
        </div>
        <div>
          <p className="font-semibold text-[var(--color-brand-text-lbl)]">
            {isES ? "Aún no has añadido suplementos" : "You haven't added any supplements yet"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-brand-grey)]">
            {isES
              ? "Añade alguno para activar los recordatorios."
              : "Add one to enable reminders."}
          </p>
        </div>

        {/* Disabled switch (OFF, disabled) */}
        <ReminderSwitch checked={false} disabled onChange={() => {}} />

        <button
          onClick={onAddFirst}
          className="mt-1 rounded-full bg-[var(--color-brand-accent)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          {isES ? "Añadir suplementos" : "Add supplements"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-accent)]/15 text-[var(--color-brand-accent)]">
            {reminderOn ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-brand-text-lbl)]">
              {isES ? "Recordatorios" : "Reminders"}
            </p>
            <p className="text-xs text-[var(--color-brand-grey)]">
              {reminderOn
                ? isES
                  ? "Activados — te avisaremos a tus horas"
                  : "On — we'll ping you at your times"
                : isES
                  ? "Desactivados"
                  : "Off"}
            </p>
          </div>
        </div>
        <ReminderSwitch checked={reminderOn} onChange={onToggle} />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-grey)]">
          {isES ? "Tus suplementos" : "Your supplements"}
        </p>
        <ul className="space-y-2">
          {supplements
            .slice()
            .sort((a, b) => a.notificationTime.localeCompare(b.notificationTime))
            .map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3"
              >
                <span className="text-xl leading-none">{emojiOf(s.id)}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-brand-text-lbl)]">
                  {nameOf(s.id)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    reminderOn
                      ? "bg-[var(--color-brand-accent)]/15 text-[var(--color-brand-accent)]"
                      : "bg-[var(--color-brand-bg)] text-[var(--color-brand-grey)]"
                  }`}
                >
                  {s.notificationTime}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

function ReminderSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-[var(--color-brand-accent)]" : "bg-[var(--color-brand-border)]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <motion.span
        layout
        transition={{ type: "spring", damping: 26, stiffness: 500 }}
        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow"
        style={{ left: checked ? "calc(100% - 1.5rem)" : "0.25rem" }}
      />
    </button>
  );
}
