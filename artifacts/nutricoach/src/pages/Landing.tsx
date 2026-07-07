import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { isBetaMode } from "@/lib/beta";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Dumbbell, Utensils, TrendingUp } from "lucide-react";
import { useEffect } from "react";
import GoalIQLogo from "@/components/GoalIQLogo";

export default function Landing() {
  const { isAuthenticated, login, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) return null;

  return (
    <div className="goaliq-vision min-h-screen bg-[var(--color-brand-bg)] font-sans flex flex-col">

      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full border-b border-[var(--color-brand-border)]">
        <>
          <GoalIQLogo size="sm" className="sm:hidden" />
          <GoalIQLogo size="md" className="hidden sm:block" />
        </>
        <div className="flex items-center gap-3">
          {!isBetaMode() && (
            <Link href="/pricing" className="text-sm font-medium text-[var(--color-brand-grey)] hover:text-[var(--color-brand-text-lbl)] transition-colors hidden sm:block">
              Precios
            </Link>
          )}
          <button
            onClick={login}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-lbl)] hover:border-[var(--color-brand-cyan)] transition-colors"
          >
            Iniciar sesión
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] text-[var(--color-brand-cyan)] text-xs font-bold mb-8 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-cyan)] animate-pulse" />
            Coaching con Inteligencia Artificial
          </div>

          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-black uppercase leading-[0.9] text-[var(--color-brand-text-lbl)] mb-6 tracking-tight">
            Entrena más inteligente.<br />
            <span className="text-[var(--color-brand-cyan)]">Alcanza tus objetivos.</span>
          </h1>

          <p className="text-base text-[var(--color-brand-grey)] mb-10 leading-relaxed max-w-lg mx-auto">
            Obtén un plan de comidas y rutina de entrenamiento orientativos según tu cuerpo, objetivos y estilo de vida — generados por IA en segundos.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
            <button
              onClick={login}
              className="px-8 py-4 rounded-lg font-bold bg-[var(--color-brand-cyan)] text-white hover:opacity-90 transition-all duration-150 flex items-center justify-center gap-2 text-base"
            >
              Empezar prueba gratis
              <ArrowRight className="w-5 h-5" />
            </button>
            {!isBetaMode() && (
              <Link
                href="/pricing"
                className="px-8 py-4 rounded-lg font-semibold bg-transparent text-[var(--color-brand-text-lbl)] border border-[var(--color-brand-border)] hover:border-[var(--color-brand-cyan)] transition-colors text-base text-center"
              >
                Ver qué incluye
              </Link>
            )}
          </div>

          <p className="text-sm text-[var(--color-brand-grey)] font-medium mb-12">
            3 días gratis · Sin cargo hoy · Cancela cuando quieras
          </p>

          {/* Trust features */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[var(--color-brand-grey)] font-medium">
            {[
              "Adaptado a tus preferencias",
              "Planes de comida y entrenamientos incluidos",
              "Cancela antes de que termine la prueba",
            ].map(feat => (
              <div key={feat} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--color-brand-cyan)]" />
                {feat}
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Feature cards */}
      <section className="px-6 pb-20 max-w-5xl mx-auto w-full">
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Utensils, title: "Planes de Comida 7 Días", desc: "Una semana completa de comidas adaptadas a tu dieta, objetivos y preferencias — regenera cuando quieras." },
            { icon: Dumbbell, title: "Entrenamientos Orientativos", desc: "Fuerza, cardio o HIIT — tu plan de entrenamiento se adapta a tu nivel, horario y equipamiento." },
            { icon: TrendingUp, title: "Seguimiento del Progreso", desc: "Registra tu peso, sigue tus rachas de entrenamiento y observa cómo mejoran tus resultados semana a semana." },
          ].map((card, idx) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.08 }}
              className="bg-[var(--color-brand-card)] rounded-lg p-6 border border-[var(--color-brand-border)]"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-cyan)]/10 flex items-center justify-center mb-4">
                <card.icon className="w-5 h-5 text-[var(--color-brand-cyan)]" />
              </div>
              <h3 className="font-display font-bold text-[var(--color-brand-text-lbl)] text-lg uppercase mb-1">{card.title}</h3>
              <p className="text-[var(--color-brand-grey)] text-sm leading-relaxed">{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
}
