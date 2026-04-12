/*
 * Weekly Monday Check-in Modal
 *
 * Requires this table in Supabase (run once):
 *
 *   CREATE TABLE weekly_checkins (
 *     id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id    uuid REFERENCES auth.users(id),
 *     week_start date NOT NULL,
 *     meals_adherence   text,
 *     workouts_adherence text,
 *     energy_level      text,
 *     created_at timestamptz DEFAULT now()
 *   );
 *   ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "insert own" ON weekly_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
 *   CREATE POLICY "select own" ON weekly_checkins FOR SELECT USING (auth.uid() = user_id);
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "lastCheckinDate";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isMondayToday(): boolean {
  return new Date().getDay() === 1;
}

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

const MEALS_OPTIONS = [
  { value: "always", label: "✅ Siempre" },
  { value: "almost", label: "👍 Casi siempre" },
  { value: "sometimes", label: "😐 A veces" },
  { value: "rarely", label: "❌ Poco" },
];

const WORKOUTS_OPTIONS = [
  { value: "all", label: "💪 Todos" },
  { value: "most", label: "👍 La mayoría" },
  { value: "some", label: "😐 Algunos" },
  { value: "none", label: "❌ Ninguno" },
];

const ENERGY_OPTIONS = [
  { value: "exhausted", emoji: "😴", label: "Agotado/a" },
  { value: "poor", emoji: "😕", label: "Regular" },
  { value: "neutral", emoji: "😐", label: "Normal" },
  { value: "good", emoji: "😊", label: "Bien" },
  { value: "great", emoji: "🔥", label: "Con energía" },
];

function getMotivation(
  meals: string | null,
  workouts: string | null,
  energy: string | null,
): string {
  const positive = ["always", "almost", "all", "most", "great", "good"];
  const negative = ["rarely", "none", "exhausted", "poor"];

  const vals = [meals, workouts, energy].filter(Boolean) as string[];
  if (vals.length === 0) return "¡Buen comienzo de semana! 💪";

  const posCount = vals.filter(v => positive.includes(v)).length;
  const negCount = vals.filter(v => negative.includes(v)).length;

  if (posCount >= vals.length - 1 && negCount === 0)
    return "¡Semana increíble! Sigue así 🔥";
  if (negCount >= Math.ceil(vals.length / 2))
    return "Todos los lunes son una nueva oportunidad. ¡Vamos! ⚡";
  return "Buen trabajo. Esta semana lo clavamos 💪";
}

export function WeeklyCheckin() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [meals, setMeals] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<string | null>(null);
  const [energy, setEnergy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isMondayToday()) return;
    const last = localStorage.getItem(STORAGE_KEY);
    if (last === todayISO()) return;
    const timer = setTimeout(() => setOpen(true), 500);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setOpen(false);
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const userId = session?.user?.id;
      if (userId) {
        await supabase.from("weekly_checkins").insert({
          user_id: userId,
          week_start: getWeekStart(),
          meals_adherence: meals,
          workouts_adherence: workouts,
          energy_level: energy,
        });
      }
    } catch {
      /* fail silently */
    } finally {
      localStorage.setItem(STORAGE_KEY, todayISO());
      setSaving(false);
      setOpen(false);
    }
  }

  const motivation = getMotivation(meals, workouts, energy);
  const anyAnswered = meals !== null || workouts !== null || energy !== null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="w-full font-sans"
            style={{
              maxWidth: 480,
              background: "#1A1A1A",
              border: "1px solid #2A2A2A",
              borderRadius: 16,
              padding: 32,
              position: "relative",
            }}
          >
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-[#555] hover:text-white hover:bg-[#2A2A2A] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-[#AAFF45]/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-[#AAFF45]" />
              </div>
              <h2 className="text-2xl font-display font-black uppercase text-white mb-1">
                Check-in semanal
              </h2>
              <p className="text-sm text-[#A0A0A0]">¿Cómo fue tu semana?</p>
            </div>

            <div className="space-y-6">
              {/* Q1 */}
              <div>
                <p className="text-sm font-semibold text-white mb-3">
                  ¿Seguiste tu plan de comidas?
                </p>
                <div className="flex flex-wrap gap-2">
                  {MEALS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setMeals(opt.value)}
                      className="px-4 py-2 rounded-full text-sm transition-all"
                      style={{
                        background: meals === opt.value ? "var(--giq-accent)" : "var(--giq-border)",
                        color: meals === opt.value ? "var(--giq-accent-text)" : "var(--giq-text-primary)",
                        fontWeight: meals === opt.value ? 700 : 400,
                        border: `1px solid ${meals === opt.value ? "var(--giq-accent)" : "var(--giq-bg-card-hover)"}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Q2 */}
              <div>
                <p className="text-sm font-semibold text-white mb-3">
                  ¿Completaste tus entrenamientos?
                </p>
                <div className="flex flex-wrap gap-2">
                  {WORKOUTS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setWorkouts(opt.value)}
                      className="px-4 py-2 rounded-full text-sm transition-all"
                      style={{
                        background: workouts === opt.value ? "var(--giq-accent)" : "var(--giq-border)",
                        color: workouts === opt.value ? "var(--giq-accent-text)" : "var(--giq-text-primary)",
                        fontWeight: workouts === opt.value ? 700 : 400,
                        border: `1px solid ${workouts === opt.value ? "var(--giq-accent)" : "var(--giq-bg-card-hover)"}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Q3 */}
              <div>
                <p className="text-sm font-semibold text-white mb-3">
                  ¿Cómo te sientes esta semana?
                </p>
                <div className="flex gap-2 justify-between">
                  {ENERGY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setEnergy(opt.value)}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                      style={{
                        background: energy === opt.value ? "var(--giq-accent)" : "var(--giq-border)",
                        border: `1px solid ${energy === opt.value ? "var(--giq-accent)" : "var(--giq-bg-card-hover)"}`,
                      }}
                    >
                      <span className="text-2xl leading-none">{opt.emoji}</span>
                      <span
                        className="text-[10px] font-medium leading-tight text-center"
                        style={{ color: energy === opt.value ? "var(--giq-accent-text)" : "var(--giq-text-secondary)" }}
                      >
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Motivational message */}
              <AnimatePresence mode="wait">
                {anyAnswered && (
                  <motion.div
                    key={motivation}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="text-center py-3 px-4 rounded-xl"
                    style={{ background: "color-mix(in srgb, var(--giq-accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--giq-accent) 15%, transparent)" }}
                  >
                    <p className="text-sm font-semibold text-[#AAFF45]">{motivation}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-[#AAFF45] text-[#0A0A0A] hover:bg-[#99EE34] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <span className="inline-block w-4 h-4 border-2 border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Empezar la semana"
                  )}
                </button>
                <button
                  onClick={dismiss}
                  className="text-sm text-[#555555] hover:text-[#A0A0A0] transition-colors py-1 text-center"
                >
                  Ahora no
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
