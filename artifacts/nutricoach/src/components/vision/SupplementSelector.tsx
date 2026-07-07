import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Plus, Trash2, Clock } from "lucide-react";
import {
  SUPPLEMENTS,
  SUPPLEMENT_TIMING,
  getSupplementVariants,
  defaultNotificationTime,
  type StoredSupplement,
} from "@/lib/supplements";

/**
 * Replica of the Onboarding supplement selector (variant + timing + exact hour),
 * beige-styled for the Vision modal. Controlled: edits produce a new
 * StoredSupplement[] passed to onChange (the modal persists it).
 */
export default function SupplementSelector({
  value,
  onChange,
  isES,
}: {
  value: StoredSupplement[];
  onChange: (next: StoredSupplement[]) => void;
  isES: boolean;
}) {
  const variants = useMemo(() => getSupplementVariants(isES), [isES]);
  const byId = useMemo(() => {
    const m: Record<string, StoredSupplement> = {};
    value.forEach((s) => (m[s.id] = s));
    return m;
  }, [value]);

  const [expanded, setExpanded] = useState<string | null>(null);

  const upsert = (next: StoredSupplement) =>
    onChange([...value.filter((s) => s.id !== next.id), next]);

  const remove = (id: string) => onChange(value.filter((s) => s.id !== id));

  const add = (id: string) => {
    upsert({ id, timingIndex: 0, variantIndex: 0, notificationTime: defaultNotificationTime(id, 0) });
    setExpanded(id);
  };

  return (
    <div className="space-y-2">
      {SUPPLEMENTS.map((supp) => {
        const selected = byId[supp.id];
        const isOpen = expanded === supp.id && !!selected;
        const timing = SUPPLEMENT_TIMING[supp.id];
        const suppVariants = variants[supp.id] ?? [];

        return (
          <div
            key={supp.id}
            className={`overflow-hidden rounded-2xl border transition-colors ${
              selected
                ? "border-[var(--color-brand-cyan)] bg-[var(--color-brand-card)]"
                : "border-[var(--color-brand-border)] bg-[var(--color-brand-card)]"
            }`}
          >
            {/* Header row */}
            <button
              type="button"
              onClick={() => (selected ? setExpanded(isOpen ? null : supp.id) : add(supp.id))}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="text-2xl leading-none">{supp.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--color-brand-text-lbl)]">
                  {supp.name}
                </p>
                <p className="truncate text-xs text-[var(--color-brand-grey)]">{supp.shortDesc}</p>
              </div>
              {selected ? (
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[var(--color-brand-grey)] transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-cyan)]/15 text-[var(--color-brand-cyan)]">
                  <Plus className="h-4 w-4" />
                </span>
              )}
            </button>

            {/* Expanded editor */}
            <AnimatePresence initial={false}>
              {isOpen && selected && timing && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="border-t border-[var(--color-brand-border)]"
                >
                  <div className="space-y-4 px-4 py-4">
                    {/* Variants */}
                    {suppVariants.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-grey)]">
                          {isES ? "Tipo" : "Type"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {suppVariants.map((v, vi) => {
                            const active = selected.variantIndex === vi;
                            return (
                              <button
                                key={v.name}
                                type="button"
                                onClick={() => upsert({ ...selected, variantIndex: vi })}
                                title={v.info}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                  active
                                    ? "border-transparent bg-[var(--color-brand-cyan)] text-white"
                                    : "border-[var(--color-brand-border)] text-[var(--color-brand-text-lbl)]"
                                }`}
                              >
                                {v.name}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-1.5 text-xs text-[var(--color-brand-grey)]">
                          {suppVariants[selected.variantIndex]?.info}
                        </p>
                      </div>
                    )}

                    {/* Timing */}
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-grey)]">
                        {isES ? "Momento" : "Timing"}
                      </p>
                      <div className="space-y-2">
                        {timing.options.map((opt, oi) => {
                          const active = selected.timingIndex === oi;
                          return (
                            <button
                              key={opt.time}
                              type="button"
                              onClick={() =>
                                upsert({
                                  ...selected,
                                  timingIndex: oi,
                                  notificationTime: defaultNotificationTime(supp.id, oi),
                                })
                              }
                              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                                active
                                  ? "border-[var(--color-brand-cyan)] bg-[var(--color-brand-cyan)]/10"
                                  : "border-[var(--color-brand-border)]"
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                  active
                                    ? "border-[var(--color-brand-cyan)] bg-[var(--color-brand-cyan)]"
                                    : "border-[var(--color-brand-grey)]"
                                }`}
                              >
                                {active && <Check className="h-2.5 w-2.5 text-white" />}
                              </span>
                              <span>
                                <span className="block text-sm font-medium text-[var(--color-brand-text-lbl)]">
                                  {opt.time}
                                </span>
                                <span className="block text-xs text-[var(--color-brand-grey)]">
                                  {opt.desc}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Exact hour */}
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-grey)]">
                        {isES ? "Hora del recordatorio" : "Reminder time"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {(timing.options[selected.timingIndex]?.slots ?? []).map((slot) => {
                          const norm = slot.length === 4 ? `0${slot}` : slot; // "8:00" -> "08:00"
                          const active = selected.notificationTime === norm;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => upsert({ ...selected, notificationTime: norm })}
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                active
                                  ? "border-transparent bg-[var(--color-brand-text-lbl)] text-white"
                                  : "border-[var(--color-brand-border)] text-[var(--color-brand-text-lbl)]"
                              }`}
                            >
                              {norm}
                            </button>
                          );
                        })}
                        <label className="flex items-center gap-1.5 rounded-full border border-[var(--color-brand-border)] px-3 py-1 text-xs text-[var(--color-brand-grey)]">
                          <Clock className="h-3.5 w-3.5" />
                          <input
                            type="time"
                            value={selected.notificationTime}
                            onChange={(e) =>
                              upsert({ ...selected, notificationTime: e.target.value })
                            }
                            className="bg-transparent text-[var(--color-brand-text-lbl)] outline-none"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Notification preview + delete */}
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-brand-bg)] p-3">
                      <p className="text-xs text-[var(--color-brand-grey)]">
                        🔔 {isES ? "Te avisaremos a las" : "We'll remind you at"}{" "}
                        <span className="font-semibold text-[var(--color-brand-text-lbl)]">
                          {selected.notificationTime}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          remove(supp.id);
                          setExpanded(null);
                        }}
                        className="flex items-center gap-1 text-xs font-medium text-[var(--color-brand-grey)] hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {isES ? "Quitar" : "Remove"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
