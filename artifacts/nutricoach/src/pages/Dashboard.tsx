import { useAuth } from "@/hooks/useAuth";
import { useMealPlan, useWorkoutPlan, useProgressStats, useProfile, useFlexDays } from "@/lib/supabase-queries";
import type { ProgressStats } from "@/lib/supabase-queries";
import { useSubscription } from "@/lib/subscription";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { useT, useLanguage, translateDay } from "@/lib/language";
import { useShoppingList } from "@/lib/shopping";

import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Flame, Zap, Star, Target, Sunrise, Sprout, Gift, Clock, Utensils, ShoppingCart, Play } from "lucide-react";
import { motion } from "framer-motion";
import { WeeklyCheckin } from "@/components/WeeklyCheckin";
import { ShareProgressButton } from "@/components/ShareProgressCard";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysLeft(trialEndsAt: number | null): number | null {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt * 1000 - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function getWeekMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function translateGoal(goal: string | null): string {
  if (!goal) return "Objetivo";
  const key = goal.toLowerCase().replace(/[\s-]/g, "_");
  const map: Record<string, string> = {
    lose_weight: "Perder peso",
    weight_loss: "Perder peso",
    gain_muscle: "Ganar músculo",
    muscle_gain: "Ganar músculo",
    maintenance: "Mantener peso",
    maintain: "Mantener peso",
    recomposition: "Recomposición",
    endurance: "Resistencia",
    high_protein: "Alta proteína",
    perder_peso: "Perder peso",
    ganar_musculo: "Ganar músculo",
    mantener_peso: "Mantener peso",
  };
  if (map[key]) return map[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function weightDeltaColor(delta: number, goal: string | null): string {
  const g = goal?.toLowerCase().replace(/[\s-]/g, "_") ?? "";
  const isGainGoal = g.includes("gain") || g.includes("muscle") || g.includes("ganar");
  const isMaintainGoal = g.includes("maintain") || g.includes("mantener") || g.includes("recomp");
  if (isGainGoal || isMaintainGoal) return "var(--giq-text-secondary)";
  if (delta < 0) return "var(--giq-accent)";
  if (delta > 0) return "var(--giq-error)";
  return "var(--giq-text-secondary)";
}

function translateDiet(diet: string | null): string {
  const map: Record<string, string> = {
    omnivore: "Omnívoro",
    omnívoro: "Omnívoro",
    vegetarian: "Vegetariano",
    vegetariano: "Vegetariano",
    vegan: "Vegano",
    vegano: "Vegano",
    pescatarian: "Pescetariano",
    "gluten-free": "Sin gluten",
    keto: "Keto",
    paleo: "Paleo",
  };
  return map[diet?.toLowerCase() ?? ""] ?? diet ?? "Omnívoro";
}

function translateMealType(mealType: string, t: (k: string) => string): string {
  const m = mealType?.toLowerCase() ?? "";
  if (m === "breakfast" || m === "desayuno") return t("breakfast");
  if (m === "lunch" || m === "comida" || m === "almuerzo") return t("lunch");
  if (m === "dinner" || m === "cena") return t("dinner");
  if (m === "snack" || m === "merienda") return t("snack");
  return mealType;
}

function mealTypeColor(mealType: string): string {
  const t = mealType?.toLowerCase() ?? "";
  if (t === "breakfast" || t === "desayuno") return "var(--giq-accent)";
  if (t === "lunch" || t === "comida" || t === "almuerzo") return "#FFB347";
  if (t === "dinner" || t === "cena") return "#7B8CDE";
  return "#888888";
}

function mealEmoji(mealType: string) {
  const t = mealType?.toLowerCase() || "";
  if (t.includes("breakfast") || t.includes("desayuno")) return "🍳";
  if (t.includes("lunch") || t.includes("comida") || t.includes("almuerzo")) return "🥙";
  if (t.includes("dinner") || t.includes("cena")) return "🍽️";
  if (t.includes("snack") || t.includes("merienda")) return "🍎";
  return "🥗";
}

// SVG arc path for a top-opening semicircle (0-100)
function semicircleArcPath(pct: number): string {
  const clamped = Math.min(Math.max(pct, 0), 99.9);
  const angle = Math.PI * (1 - clamped / 100);
  const ex = 24 + 20 * Math.cos(angle);
  const ey = 24 - 20 * Math.sin(angle);
  return `M 4 24 A 20 20 0 0 0 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

// ─── Workout type labels ──────────────────────────────────────────────────────

const WORKOUT_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  cardio:         { label: "Cardio",          emoji: "🏃" },
  hiit:           { label: "HIIT",            emoji: "⚡" },
  circuit:        { label: "Circuito",        emoji: "🔄" },
  strength_upper: { label: "Tren Superior",   emoji: "💪" },
  strength_lower: { label: "Tren Inferior",   emoji: "🦵" },
  full_body:      { label: "Cuerpo Completo", emoji: "🏋️" },
};

// ─── Feedback logic ────────────────────────────────────────────────────────────

type FeedbackLevel = "celebration" | "positive" | "neutral" | "motivate";

type Feedback = {
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  badge?: string;
  badgeBg: string;
  title: string;
  message: string;
  tip?: string;
  level: FeedbackLevel;
};

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function computeFeedback(stats: ProgressStats, isWorkoutDay: boolean, t: TFn, name?: string): Feedback {
  const { streak, todayWorkoutDone, completedWorkoutsThisWeek, totalWorkoutsThisWeek, weeklyAdherencePercent } = stats;

  if (streak >= 7) {
    return {
      icon: Flame, iconColor: "text-orange-400",
      bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20",
      badge: t("badge_streak_fire", { n: streak }), badgeBg: "bg-orange-500/20 text-orange-300",
      title: name ? t("fb_fire_title_name", { name }) : t("fb_fire_title"),
      message: t("fb_fire_msg", { n: streak }), tip: t("fb_fire_tip"), level: "celebration",
    };
  }
  if (streak >= 3) {
    return {
      icon: Zap, iconColor: "text-amber-400",
      bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20",
      badge: t("badge_streak_zap", { n: streak }), badgeBg: "bg-amber-500/20 text-amber-300",
      title: t("fb_streak_title"), message: t("fb_streak_msg", { n: streak }),
      tip: t("fb_streak_tip"), level: "positive",
    };
  }
  if (todayWorkoutDone && isWorkoutDay) {
    return {
      icon: CheckCircle2, iconColor: "text-[#AAFF45]",
      bgColor: "bg-[#AAFF45]/10", borderColor: "border-[#AAFF45]/20",
      badge: t("badge_done"), badgeBg: "bg-[#AAFF45]/20 text-[#AAFF45]",
      title: t("fb_done_title"), message: name ? t("fb_done_msg_name", { name }) : t("fb_done_msg"),
      tip: t("fb_done_tip"), level: "celebration",
    };
  }
  if (weeklyAdherencePercent === 100 && totalWorkoutsThisWeek > 0) {
    return {
      icon: Star, iconColor: "text-yellow-400",
      bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/20",
      badge: t("badge_perfect"), badgeBg: "bg-yellow-500/20 text-yellow-300",
      title: name ? t("fb_perfect_title_name", { name }) : t("fb_perfect_title"),
      message: t("fb_perfect_msg"), tip: t("fb_perfect_tip"), level: "celebration",
    };
  }
  if (weeklyAdherencePercent >= 75 && totalWorkoutsThisWeek > 0) {
    return {
      icon: CheckCircle2, iconColor: "text-[#AAFF45]",
      bgColor: "bg-[#AAFF45]/10", borderColor: "border-[#AAFF45]/20",
      title: t("fb_solid_title"), badgeBg: "bg-[#2A2A2A] text-[#A0A0A0]",
      message: t("fb_solid_msg", { done: completedWorkoutsThisWeek, total: totalWorkoutsThisWeek }),
      tip: totalWorkoutsThisWeek > completedWorkoutsThisWeek ? t("fb_solid_tip_more") : undefined,
      level: "positive",
    };
  }
  if (weeklyAdherencePercent >= 30 && totalWorkoutsThisWeek > 0) {
    return {
      icon: Target, iconColor: "text-blue-400",
      bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20",
      title: t("fb_keep_title"), badgeBg: "bg-[#2A2A2A] text-[#A0A0A0]",
      message: t("fb_keep_msg", { done: completedWorkoutsThisWeek, total: totalWorkoutsThisWeek }),
      tip: t("fb_keep_tip"), level: "neutral",
    };
  }
  if (completedWorkoutsThisWeek === 1) {
    return {
      icon: Sprout, iconColor: "text-[#AAFF45]",
      bgColor: "bg-[#AAFF45]/10", borderColor: "border-[#AAFF45]/20",
      title: t("fb_started_title"), badgeBg: "bg-[#2A2A2A] text-[#A0A0A0]",
      message: t("fb_started_msg"), tip: t("fb_started_tip"), level: "motivate",
    };
  }
  if (totalWorkoutsThisWeek > 0) {
    return {
      icon: Sunrise, iconColor: "text-orange-400",
      bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20",
      title: t("fb_fresh_title"), badgeBg: "bg-[#2A2A2A] text-[#A0A0A0]",
      message: t("fb_fresh_msg"), tip: t("fb_fresh_tip"), level: "motivate",
    };
  }
  return {
    icon: Sprout, iconColor: "text-[#555555]",
    bgColor: "bg-[#1A1A1A]", borderColor: "border-[#2A2A2A]",
    title: t("fb_rest_title"), badgeBg: "bg-[#2A2A2A] text-[#A0A0A0]",
    message: t("fb_rest_msg"), level: "neutral",
  };
}

// ─── TrialStatusCard ──────────────────────────────────────────────────────────

function TrialStatusCard({ trialEndsAt }: { trialEndsAt: number | null }) {
  const remaining = daysLeft(trialEndsAt);
  const urgent = remaining !== null && remaining <= 1;
  const endDate = trialEndsAt
    ? new Date(trialEndsAt * 1000).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
    : null;
  const t = useT();

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border px-4 py-3.5 flex items-center gap-3 ${
        urgent ? "bg-amber-500/10 border-amber-500/20" : "bg-[#AAFF45]/10 border-[#AAFF45]/20"
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${urgent ? "bg-amber-500/20" : "bg-[#AAFF45]/20"}`}>
        {urgent ? <Clock className="w-4 h-4 text-amber-400" /> : <Gift className="w-4 h-4 text-[#AAFF45]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${urgent ? "text-amber-300" : "text-[#AAFF45]"}`}>
          {remaining === 0 ? t("trial_ends_today") : remaining === 1 ? t("trial_1_day_left") : t("trial_active_days", { n: remaining ?? 0 })}
        </p>
        <p className={`text-xs mt-0.5 ${urgent ? "text-amber-400/70" : "text-[#AAFF45]/60"}`}>
          {urgent ? t("subscribe_now") : endDate ? t("free_until", { date: endDate }) : t("free_trial_no_charge")}
        </p>
      </div>
      <Link
        href="/billing"
        className={`text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 whitespace-nowrap transition-colors ${
          urgent ? "bg-amber-500 text-white hover:bg-amber-400" : "bg-[#AAFF45] text-[#0A0A0A] hover:bg-[#99EE34]"
        }`}
      >
        {urgent ? t("subscribe") : t("manage")}
      </Link>
    </motion.div>
  );
}

// ─── SmartInsightCard ─────────────────────────────────────────────────────────

function SmartInsightCard({ feedback, streak: _streak }: { feedback: Feedback; streak: number }) {
  const Icon = feedback.icon;
  return (
    <div
      className={`rounded-xl border p-4 ${feedback.bgColor} ${feedback.borderColor} flex items-start gap-3`}
      style={{ borderLeft: "3px solid var(--giq-accent)" }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: "color-mix(in srgb, var(--giq-bg-primary) 30%, transparent)" }}
      >
        <Icon className={`w-5 h-5 ${feedback.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="font-bold text-base" style={{ color: "var(--giq-text-primary)" }}>{feedback.title}</p>
          {feedback.badge && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${feedback.badgeBg}`}>
              {feedback.badge}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--giq-text-secondary)" }}>{feedback.message}</p>
      </div>
    </div>
  );
}

// ─── Stoic / motivational quotes (100 per language, rotate daily) ────────────

const STOIC_QUOTES_ES = [
  "Sufre ahora y vive el resto de tu vida como un campeón.",
  "No es lo que te pasa, sino cómo reaccionas lo que importa.",
  "El hombre que sufre antes de que sea necesario sufre más de lo necesario.",
  "Primero di qué tipo de persona quieres ser, luego haz lo que tengas que hacer.",
  "Si quieres mejorar, acepta que puedes parecer ignorante o estúpido.",
  "La riqueza consiste no en tener grandes posesiones, sino en tener pocas necesidades.",
  "Nunca te arrepientas de algo que te hizo sonreír.",
  "El obstáculo en el camino se convierte en el camino.",
  "Haz el trabajo. Hazlo ahora. El dolor es temporal.",
  "No desperdicies lo que te queda de vida pensando en los demás.",
  "Soporta y abstente.",
  "Si no está en tu poder, no te preocupes por ello.",
  "Actúa como si todo lo que ocurre fuera exactamente como debería ser.",
  "Pierde la esperanza de una vida mejor hacia atrás. Mira hacia adelante.",
  "No es que no tengamos tiempo, es que perdemos demasiado.",
  "La felicidad de tu vida depende de la calidad de tus pensamientos.",
  "Donde hay un hombre que no tiene miedo, hay un hombre que ejerce el poder.",
  "Si te duele algo, lo puedes aguantar. Si no lo puedes aguantar, te matará.",
  "No busques que lo que ocurre ocurra como tú quieres, sino quiere lo que ocurre.",
  "Que cada cosa que hagas la hagas como si fuera la última de tu vida.",
  "El alma que no tiene ningún objetivo fijo se pierde.",
  "Distingue entre lo que depende de ti y lo que no depende de ti.",
  "Los impedimentos para la acción hacen avanzar la acción. Lo que se interpone en el camino se convierte en el camino.",
  "No hay nada que sea malo en sí mismo, sino el juicio que hacemos de ello.",
  "La gente no está perturbada por los eventos, sino por la opinión sobre los eventos.",
  "El tiempo libre sin estudio es muerte y sepultura del hombre vivo.",
  "Empieza por lo necesario, luego lo posible, y de repente estarás haciendo lo imposible.",
  "Somos más a menudo asustados que heridos; sufrimos más en imaginación que en realidad.",
  "Si te cansas de empezar, nunca termines.",
  "Que ningún día pase sin hacer ejercicio.",
  "Todo obstáculo que superes te hace más fuerte.",
  "El cuerpo debe ser tratado con más rigor para que no desobedezca a la mente.",
  "La virtud es el único bien.",
  "Lo que no te mata te hace más fuerte.",
  "Cuida tu carácter, no tu reputación.",
  "Sé el tipo de persona que le gustarías conocer.",
  "Resiste el principio. Herba es más fácil de arrancar cuando está tierna.",
  "Cuanto más transpires en el entrenamiento, menos sangrarás en la batalla.",
  "No le digas a nadie cuánto has levantado. Demuéstralo.",
  "El dolor de la disciplina pesa onzas. El dolor del arrepentimiento pesa toneladas.",
  "Trabaja en silencio. Deja que tu éxito haga el ruido.",
  "Cada mañana que te levantas es otra oportunidad de mejorar.",
  "La adversidad revela el genio; la prosperidad lo oculta.",
  "No pidas que las cosas sean más fáciles. Pide ser más fuerte.",
  "Un hombre que sufre antes de que sea necesario sufre más de lo necesario.",
  "La disciplina es la madre de todas las virtudes.",
  "No lamentes lo que has perdido. Alégrate de lo que tienes.",
  "El esfuerzo de hoy es el éxito de mañana.",
  "La excelencia no es un acto sino un hábito.",
  "Haz hoy lo que otros no harán para mañana hacer lo que otros no pueden.",
  "El único límite es el que tú te pones.",
  "Cada rep es un voto por la persona que quieres ser.",
  "El entrenamiento duro hace la competición fácil.",
  "No te compares con otros. Compárate con quien eras ayer.",
  "La constancia vence al talento cuando el talento no es constante.",
  "Primero mueve el cuerpo, luego la mente seguirá.",
  "El sudor es la grasa llorando.",
  "La incomodidad es el precio del crecimiento.",
  "Nada grande se logra sin esfuerzo.",
  "Sé duro con tu cuerpo para que sea amable con tu mente.",
  "El entrenamiento es una metáfora de la vida. Empujas, te cansas, descansas, vuelves.",
  "Cada día sin progreso es un día perdido.",
  "La motivación te inicia. El hábito te mantiene.",
  "No necesitas estar enfermo para mejorar.",
  "El cuerpo logra lo que la mente cree.",
  "Un cuerpo fuerte construye una mente fuerte.",
  "La grandeza no cae del cielo. Se construye rep a rep.",
  "Sé más de lo que eres hoy que de lo que eras ayer.",
  "La disciplina supera a la motivación cada vez.",
  "Entrena como si tu vida dependiera de ello. Algún día lo hará.",
  "El camino hacia lo extraordinario pasa por lo ordinario hecho con excelencia.",
  "Haz el trabajo aunque no tengas ganas. Así se forjan los campeones.",
  "No esperes a sentirte listo. Nunca te sentirás completamente listo.",
  "La fuerza no viene de ganar. Viene de la lucha.",
  "Cada mañana tienes dos opciones: seguir durmiendo con tus sueños, o levantarte y perseguirlos.",
  "El éxito no es para los elegidos. Es para los que eligen no rendirse.",
  "El cansancio de hoy es la fortaleza de mañana.",
  "No te rindas cuando estés cansado. Rinde cuando hayas terminado.",
  "La voluntad es un músculo. Entrénala.",
  "Lo que haces cuando nadie te mira define quién eres.",
  "Sé el primero en llegar y el último en irse.",
  "El progreso, no la perfección.",
  "Un porcentaje es mejor que cero.",
  "Haz una cosa hoy que tu yo futuro te agradecerá.",
  "El sacrificio de hoy es el premio de mañana.",
  "La comodidad es el enemigo del crecimiento.",
  "Suda hoy para brillar mañana.",
  "La actitud determina la altitud.",
  "Hazlo aunque te dé miedo.",
  "El fracaso es solo otro paso hacia el éxito.",
  "Entrena la mente tanto como el cuerpo.",
  "No hay atajos hacia ningún lugar que valga la pena ir.",
  "El éxito es la suma de pequeños esfuerzos repetidos día tras día.",
  "Cuando sientas ganas de rendirte, recuerda por qué empezaste.",
  "Duele ahora o lamenta después.",
  "Sé tan bueno que no puedan ignorarte.",
  "El único entrenamiento malo es el que no hiciste.",
  "Levántate. Trabaja. Descansa. Repite.",
  "Mientras otros duermen, tú entrenas. Por eso ganarás.",
];

const STOIC_QUOTES_EN = [
  "Suffer now and live the rest of your life as a champion.",
  "It's not what happens to you, but how you react that matters.",
  "He who fears death will never do anything worthy of a living man.",
  "First say what kind of person you want to be, then do what you have to do.",
  "If you want to improve, be content to be seen as ignorant.",
  "Wealth consists not in having great possessions but in having few needs.",
  "Never regret anything that made you smile.",
  "The obstacle in the path becomes the path.",
  "Do the work. Do it now. The pain is temporary.",
  "Don't waste what remains of your life thinking about other people.",
  "Endure and abstain.",
  "If it is not in your power, don't worry about it.",
  "Act as though everything that happens is exactly as it should be.",
  "Abandon hope of a better past. Look forward.",
  "It's not that we have little time, it's that we waste too much.",
  "The happiness of your life depends on the quality of your thoughts.",
  "Where there is a man without fear, there is a man who exercises power.",
  "If something hurts you, you can bear it. If you can't bear it, it will kill you.",
  "Don't seek for things to happen as you wish. Wish for things to happen as they do.",
  "Let every thing you do be done as if it were your last act.",
  "A soul with no fixed aim loses itself.",
  "Distinguish between what depends on you and what does not.",
  "The impediment to action advances action. What stands in the way becomes the way.",
  "Nothing is bad in itself — only the judgment we make of it.",
  "People are disturbed not by events, but by their opinion about events.",
  "Leisure without study is death and burial of a living man.",
  "Start by doing what's necessary, then what's possible, and suddenly you're doing the impossible.",
  "We are more often frightened than hurt; we suffer more in imagination than reality.",
  "If you get tired of starting, you will never finish.",
  "Let no day pass without exercise.",
  "Every obstacle you overcome makes you stronger.",
  "The body must be treated more rigorously so it does not disobey the mind.",
  "Virtue is the only good.",
  "What doesn't kill you makes you stronger.",
  "Guard your character, not your reputation.",
  "Be the kind of person you would like to meet.",
  "Resist the beginning. It's easier to uproot a weed when it's young.",
  "The more you sweat in training, the less you bleed in battle.",
  "Don't tell anyone how much you lifted. Show them.",
  "The pain of discipline weighs ounces. The pain of regret weighs tons.",
  "Work in silence. Let your success make the noise.",
  "Every morning you wake up is another chance to improve.",
  "Adversity reveals genius; prosperity conceals it.",
  "Don't ask for things to be easier. Ask to be stronger.",
  "A man who suffers before it is necessary suffers more than necessary.",
  "Discipline is the mother of all virtues.",
  "Don't mourn what you've lost. Be grateful for what you have.",
  "Today's effort is tomorrow's success.",
  "Excellence is not an act but a habit.",
  "Do today what others won't so tomorrow you can do what others can't.",
  "The only limit is the one you set yourself.",
  "Every rep is a vote for the person you want to be.",
  "Hard training makes competition easy.",
  "Don't compare yourself to others. Compare yourself to who you were yesterday.",
  "Consistency beats talent when talent isn't consistent.",
  "Move the body first, the mind will follow.",
  "Sweat is fat crying.",
  "Discomfort is the price of growth.",
  "Nothing great is achieved without effort.",
  "Be hard on your body so it is kind to your mind.",
  "Training is a metaphor for life. You push, you tire, you rest, you return.",
  "Every day without progress is a day lost.",
  "Motivation gets you started. Habit keeps you going.",
  "You don't need to be sick to get better.",
  "The body achieves what the mind believes.",
  "A strong body builds a strong mind.",
  "Greatness doesn't fall from the sky. It's built rep by rep.",
  "Be more today than you were yesterday.",
  "Discipline beats motivation every single time.",
  "Train as if your life depends on it. One day it will.",
  "The path to the extraordinary passes through the ordinary done with excellence.",
  "Do the work even when you don't feel like it. That's how champions are forged.",
  "Don't wait until you feel ready. You'll never feel completely ready.",
  "Strength doesn't come from winning. It comes from the struggle.",
  "Every morning you have two options: keep sleeping with your dreams, or get up and chase them.",
  "Success is not for the chosen. It's for those who choose not to quit.",
  "Today's exhaustion is tomorrow's strength.",
  "Don't quit when you're tired. Quit when you're done.",
  "Willpower is a muscle. Train it.",
  "What you do when no one is watching defines who you are.",
  "Be the first to arrive and the last to leave.",
  "Progress, not perfection.",
  "One percent is better than zero.",
  "Do one thing today that your future self will thank you for.",
  "Today's sacrifice is tomorrow's reward.",
  "Comfort is the enemy of growth.",
  "Sweat today to shine tomorrow.",
  "Attitude determines altitude.",
  "Do it even if it scares you.",
  "Failure is just another step toward success.",
  "Train the mind as much as the body.",
  "There are no shortcuts to anywhere worth going.",
  "Success is the sum of small efforts repeated day after day.",
  "When you feel like quitting, remember why you started.",
  "Hurt now or regret later.",
  "Be so good they can't ignore you.",
  "The only bad workout is the one you didn't do.",
  "Rise. Work. Rest. Repeat.",
  "While others sleep, you train. That's why you'll win.",
];

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: mealPlan } = useMealPlan();
  const { data: workoutPlan } = useWorkoutPlan();
  const { data: stats } = useProgressStats();
  const { data: subData } = useSubscription();
  const t = useT();
  const { lang } = useLanguage();

  const now = new Date();
  const { data: flexDays } = useFlexDays(now.getFullYear(), now.getMonth() + 1);
  const { categories: shoppingCategories } = useShoppingList();

  const canViewInsights = subData?.hasAccess ?? false;

  const todayName = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const todayStr = now.toISOString().split("T")[0];

  const todaysMeals = mealPlan?.days.find(d => d.day === todayName)?.meals ?? [];
  const todaysDayPlan = workoutPlan?.days.find(d => d.day === todayName);
  const isWorkoutDay = !!(todaysDayPlan && !todaysDayPlan.isRestDay);

  const displayName = profile?.full_name?.split(" ")[0] || user?.firstName || user?.username?.split("@")[0] || "there";
  const firstName = profile?.full_name?.split(" ")[0] || undefined;
  const feedback = stats ? computeFeedback(stats, isWorkoutDay, t, firstName) : null;

  // Stats — cap at sensible maximums to avoid display bugs
  const currentWeight = stats?.currentWeightKg ?? null;
  const startWeight = stats?.startWeightKg ?? null;
  const weightDelta = currentWeight != null && startWeight != null ? currentWeight - startWeight : null;
  const totalWorkouts = stats?.totalWorkoutsThisWeek ?? 0;
  const completedWorkouts = Math.min(stats?.completedWorkoutsThisWeek ?? 0, totalWorkouts);
  const adherence = Math.min(stats?.weeklyAdherencePercent ?? 0, 100);
  const streak = stats?.streak ?? 0;

  // Weekly 7-day circles
  const WEEK_DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const mon = getWeekMonday();
  const weekDates = WEEK_DAY_KEYS.map((_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  // Workout info
  const todayExerciseCount = todaysDayPlan?.workout?.exercises.length ?? 0;
  const estimatedMin = todayExerciseCount > 0 ? todayExerciseCount * 4 + 10 : 0;
  const workoutTypeInfo = WORKOUT_TYPE_LABELS[todaysDayPlan?.workout?.workout_type ?? ""] ?? { label: "Entrenamiento", emoji: "💪" };
  const firstExercise = todaysDayPlan?.workout?.exercises[0] ?? null;
  const firstExerciseName = firstExercise?.name ?? null;
  const firstExerciseSets = (firstExercise as any)?.sets ?? null;
  const firstExerciseReps = (firstExercise as any)?.reps ?? null;

  // Shopping
  const totalShoppingItems = shoppingCategories.reduce((sum, c) => sum + c.items.length, 0);

  // Daily quote — cycles through 100 quotes, one per day of year
  const quotes = lang === "en" ? STOIC_QUOTES_EN : STOIC_QUOTES_ES;
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const todayQuote = quotes[dayOfYear % quotes.length];

  return (
    <div className="p-5 sm:p-7 lg:p-10 max-w-4xl mx-auto space-y-4">

      <WeeklyCheckin />

      {/* ── 1. Greeting header ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Time-of-day greeting — small muted uppercase */}
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--giq-text-muted)" }}>
          {t(`greeting_${getTimeOfDay()}`)}
        </p>

        {/* Name row with streak badge top-right */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-bold" style={{ fontSize: 34, lineHeight: "1.1", color: "var(--giq-text-primary)" }}>
            {displayName} 👋
          </h1>

          {/* Streak badge — card style */}
          {streak >= 2 && (
            <div
              className="flex flex-col items-center px-3 pt-2 pb-2.5 rounded-2xl shrink-0 min-w-[52px]"
              style={{
                backgroundColor: "color-mix(in srgb, #FF6B35 12%, var(--giq-bg-card))",
                border: "1px solid color-mix(in srgb, #FF6B35 28%, transparent)",
              }}
            >
              <Zap className="w-4 h-4 mb-0.5" style={{ color: "#FF8C57" }} />
              <p className="text-lg font-black leading-none" style={{ color: "#FF8C57" }}>{streak}</p>
              <p className="text-[9px] font-semibold text-center leading-tight mt-0.5" style={{ color: "color-mix(in srgb, #FF8C57 70%, transparent)" }}>
                {t("day_streak")}
              </p>
            </div>
          )}
        </div>

        {/* Goal / diet badge */}
        {(profile?.goal || profile?.diet_type) && (
          <div
            className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: "var(--giq-border)", color: "var(--giq-accent)" }}
          >
            <Target className="w-3 h-3" /> {translateGoal(profile.goal)} · {translateDiet(profile.diet_type)}
          </div>
        )}
      </motion.div>

      {/* ── Trial status ───────────────────────────────────────────────────── */}
      {subData?.status === "trialing" && (
        <TrialStatusCard trialEndsAt={subData.trialEndsAt ?? null} />
      )}

      {/* ── 2. Daily motivational quote — always visible ───────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
        <div
          className="rounded-xl px-4 py-3.5"
          style={{
            backgroundColor: "var(--giq-bg-secondary)",
            borderLeft: "3px solid var(--giq-accent)",
            border: "1px solid var(--giq-border)",
            borderLeftWidth: 3,
            borderLeftColor: "var(--giq-accent)",
          }}
        >
          <p className="text-sm italic leading-relaxed" style={{ color: "var(--giq-text-muted)" }}>
            "{todayQuote}"
          </p>
        </div>
      </motion.div>

      {/* ── Smart Insight (pro) ────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
        {canViewInsights && feedback && stats ? (
          <SmartInsightCard feedback={feedback} streak={stats.streak} />
        ) : (
          <UpgradeBanner feature="Smart Coaching Insights" requiredTier="premium" />
        )}
      </motion.div>

      {/* ── 3. Workout preview card ────────────────────────────────────────── */}
      {workoutPlan && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Link href="/workouts">
            {isWorkoutDay ? (
              <div
                className="relative overflow-hidden rounded-2xl cursor-pointer transition-opacity hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg, #1a2a0e 0%, #111 60%)",
                  border: "1px solid color-mix(in srgb, var(--giq-accent) 25%, transparent)",
                  padding: "18px 18px",
                }}
              >
                {/* Decorative glow */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at top left, color-mix(in srgb, var(--giq-accent) 8%, transparent) 0%, transparent 70%)" }}
                />

                {/* Top row: emoji + type name + counts */}
                <div className="relative flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ backgroundColor: "color-mix(in srgb, var(--giq-accent) 12%, transparent)" }}
                  >
                    {workoutTypeInfo.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--giq-accent)" }}>
                      {t("today").toUpperCase()}
                      {stats?.todayWorkoutDone && <span className="ml-2 normal-case">· {t("completed_check")}</span>}
                    </p>
                    <p className="font-bold text-base leading-tight" style={{ color: "var(--giq-text-primary)" }}>{workoutTypeInfo.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--giq-accent) 60%, transparent)" }}>
                      {t("exercises_n", { n: todayExerciseCount })} · ~{estimatedMin} min
                    </p>
                  </div>
                </div>

                {/* First exercise preview box */}
                {firstExerciseName && (
                  <div
                    className="relative rounded-xl flex items-center gap-3"
                    style={{
                      backgroundColor: "rgba(0,0,0,0.35)",
                      border: "1px solid color-mix(in srgb, var(--giq-accent) 12%, transparent)",
                      padding: "10px 12px",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--giq-text-muted)" }}>
                        {t("first_exercise")}
                      </p>
                      <p className="text-sm font-bold truncate" style={{ color: "var(--giq-text-primary)" }}>{firstExerciseName}</p>
                      {firstExerciseSets && firstExerciseReps && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--giq-text-muted)" }}>
                          {t("sets_x_reps", { sets: firstExerciseSets, reps: firstExerciseReps })}
                        </p>
                      )}
                    </div>
                    {!stats?.todayWorkoutDone ? (
                      <div
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl shrink-0 text-xs font-bold"
                        style={{ backgroundColor: "var(--giq-accent)", color: "#0a0a0a" }}
                      >
                        <Play className="w-3 h-3" />
                        {t("start")}
                      </div>
                    ) : (
                      <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--giq-accent)" }} />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="flex items-center gap-4 rounded-2xl p-5 cursor-pointer transition-colors"
                style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
              >
                <div className="text-3xl">🧘</div>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--giq-text-muted)" }}>{t("today")}</p>
                  <p className="font-bold text-base" style={{ color: "var(--giq-text-primary)" }}>{t("rest_today")}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--giq-text-muted)" }}>{t("light_stretching")}</p>
                </div>
                <ArrowRight className="w-5 h-5 shrink-0" style={{ color: "var(--giq-border)" }} />
              </div>
            )}
          </Link>
        </motion.div>
      )}

      {/* ── 4. Week strip ─────────────────────────────────────────────────── */}
      {workoutPlan && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13 }}
          className="rounded-2xl p-4"
          style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
        >
          {/* Header: Esta semana / X% completado */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--giq-text-muted)" }}>
              {t("this_week")}
            </p>
            {totalWorkouts > 0 && adherence > 0 && (
              <p className="text-xs font-bold" style={{ color: "var(--giq-accent)" }}>
                {t("completed_pct", { n: adherence })}
              </p>
            )}
          </div>

          {/* Day circles */}
          <div className="flex justify-between gap-1 mb-3">
            {WEEK_DAY_KEYS.map((dayKey, i) => {
              const dateStr = weekDates[i];
              const planDay = workoutPlan?.days.find(d => d.day === dayKey);
              const isTraining = planDay && !planDay.isRestDay;
              const isFlex = (flexDays ?? []).includes(dateStr);
              const isToday = dateStr === todayStr;
              const isDone = isToday && stats?.todayWorkoutDone;

              let circleStyle: React.CSSProperties;
              let label: React.ReactNode = translateDay(dayKey, t);
              let dotColor = "var(--giq-border)";

              if (isFlex) {
                circleStyle = { backgroundColor: "var(--giq-bg-secondary)", border: "1px solid var(--giq-border)" };
                label = "😋";
                dotColor = "var(--giq-text-muted)";
              } else if (isDone) {
                circleStyle = { backgroundColor: "var(--giq-accent)", border: "1px solid var(--giq-accent)" };
                dotColor = "var(--giq-accent)";
              } else if (isTraining) {
                circleStyle = { backgroundColor: "transparent", border: "1.5px solid var(--giq-accent)" };
                dotColor = "var(--giq-accent)";
              } else {
                circleStyle = { backgroundColor: "var(--giq-bg-secondary)", border: "1px solid var(--giq-border)" };
              }

              return (
                <div key={dayKey} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      ...circleStyle,
                      color: isDone ? "#0a0a0a" : isFlex ? "var(--giq-text-muted)" : isTraining ? "var(--giq-accent)" : "var(--giq-text-muted)",
                    }}
                  >
                    {label}
                  </div>
                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: isToday ? dotColor : "transparent" }} />
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          {totalWorkouts > 0 && (
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--giq-border)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${adherence}%`, backgroundColor: "var(--giq-accent)" }}
              />
            </div>
          )}
        </motion.div>
      )}

      {/* ── 5. Stats row — 2 columns ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="grid grid-cols-2 gap-3"
      >
        {/* Weight */}
        <div
          className="rounded-2xl p-4 flex flex-col"
          style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: "var(--giq-text-muted)" }}>{t("current_weight")}</p>
          <p className="text-2xl font-bold leading-none" style={{ color: "var(--giq-text-primary)" }}>
            {currentWeight != null ? currentWeight : "—"}
            {currentWeight != null && <span className="text-sm font-medium ml-0.5" style={{ color: "var(--giq-text-muted)" }}>kg</span>}
          </p>
          {weightDelta != null && (
            <p className="text-xs mt-1.5 font-semibold" style={{ color: weightDeltaColor(weightDelta, profile?.goal ?? null) }}>
              {weightDelta > 0 ? "+" : ""}{weightDelta.toFixed(1)}kg {t("from_start")}
            </p>
          )}
          {profile?.target_weight_kg && (
            <p className="text-xs mt-auto pt-2" style={{ color: "var(--giq-text-muted)" }}>
              {t("target_weight", { n: profile.target_weight_kg })}
            </p>
          )}
        </div>

        {/* Adherence */}
        <div
          className="rounded-2xl p-4 flex flex-col"
          style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: "var(--giq-text-muted)" }}>{t("weekly_adherence_label")}</p>
          <p className="text-2xl font-bold leading-none" style={{ color: "var(--giq-accent)" }}>{adherence}%</p>
          <p className="text-xs mt-1" style={{ color: "var(--giq-text-muted)" }}>
            {t("workouts_x_of_y", { done: completedWorkouts, total: totalWorkouts })}
          </p>
          <div className="mt-auto pt-3">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--giq-border)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${adherence}%`, backgroundColor: "var(--giq-accent)" }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── 6. Today's Meals ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.19 }}
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wide" style={{ color: "var(--giq-text-primary)" }}>
            <Utensils className="w-4 h-4" style={{ color: "var(--giq-accent)" }} /> {t("todays_meals")}
          </h2>
          <Link href="/meals" className="text-xs font-semibold hover:underline flex items-center gap-1" style={{ color: "var(--giq-accent)" }}>
            {t("view_full_plan")}
          </Link>
        </div>

        {todaysMeals.length > 0 ? (
          <div className="divide-y" style={{ borderColor: "var(--giq-border)" }}>
            {todaysMeals.map(meal => {
              const typeLabel = translateMealType(meal.meal_type, t);
              const typeColor = mealTypeColor(meal.meal_type);
              const kcal = (meal as any).estimated_kcal ?? null;
              return (
                <div key={meal.id} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: `${typeColor}18` }}
                  >
                    {mealEmoji(meal.meal_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: typeColor }}>{typeLabel}</p>
                    <p className="text-sm font-medium truncate" style={{ color: "var(--giq-text-primary)" }}>{meal.meal_name}</p>
                  </div>
                  {kcal != null && (
                    <span className="text-xs font-medium shrink-0" style={{ color: "var(--giq-text-muted)" }}>{kcal} kcal</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : mealPlan ? (
          <p className="px-5 pb-5 text-sm" style={{ color: "var(--giq-text-muted)" }}>{t("no_meals_today_plan")}</p>
        ) : (
          <div className="px-5 pb-5 pt-2">
            <p className="text-sm mb-3" style={{ color: "var(--giq-text-muted)" }}>{t("meal_plan_after_onboarding")}</p>
            <Link
              href="/meals"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
              style={{ backgroundColor: "var(--giq-accent)", color: "#0a0a0a" }}
            >
              {t("view_meals")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </motion.div>

      {/* ── 7. Shopping list card ──────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
        <Link href="/shopping">
          <div
            className="flex items-center gap-4 rounded-2xl p-5 cursor-pointer transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--giq-bg-card)", border: "1px solid var(--giq-border)" }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "color-mix(in srgb, var(--giq-accent) 12%, transparent)" }}
            >
              <ShoppingCart className="w-5 h-5" style={{ color: "var(--giq-accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: "var(--giq-text-primary)" }}>{t("shopping_this_week")}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--giq-text-muted)" }}>
                {totalShoppingItems > 0
                  ? t("shopping_pending", { n: totalShoppingItems })
                  : t("nav_shopping")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {totalShoppingItems > 0 && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "color-mix(in srgb, var(--giq-accent) 15%, transparent)", color: "var(--giq-accent)" }}
                >
                  {totalShoppingItems}
                </span>
              )}
              <ArrowRight className="w-4 h-4" style={{ color: "var(--giq-border)" }} />
            </div>
          </div>
        </Link>
      </motion.div>

      {/* ── Share progress ─────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
        <ShareProgressButton variant="outlined" />
      </motion.div>

    </div>
  );
}
