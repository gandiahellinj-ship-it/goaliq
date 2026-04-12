import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Dumbbell, Utensils, TrendingUp } from "lucide-react";
import { useEffect } from "react";

function GoalIQLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "text-base", md: "text-xl", lg: "text-3xl" };
  return (
    <span className={`font-display font-black italic ${sizes[size]} leading-none`}>
      <span className="text-white">Goal</span><span className="text-[#AAFF45]">IQ</span>
    </span>
  );
}

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
    <div className="min-h-screen bg-[#0A0A0A] font-sans flex flex-col">

      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full border-b border-[#1A1A1A]">
        <GoalIQLogo size="md" />
        <div className="flex items-center gap-3">
          <Link href="/pricing" className="text-sm font-medium text-[#A0A0A0] hover:text-white transition-colors hidden sm:block">
            Precios
          </Link>
          <button
            onClick={login}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-white hover:border-[#AAFF45] transition-colors"
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#AAFF45] text-xs font-bold mb-8 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#AAFF45] animate-pulse" />
            Coaching con Inteligencia Artificial
          </div>

          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-black uppercase leading-[0.9] text-white mb-6 tracking-tight">
            Entrena más inteligente.<br />
            <span className="text-[#AAFF45]">Alcanza tus objetivos.</span>
          </h1>

          <p className="text-base text-[#A0A0A0] mb-10 leading-relaxed max-w-lg mx-auto">
            Obtén un plan de comidas y rutina de entrenamiento personalizados según tu cuerpo, objetivos y estilo de vida — generados por IA en segundos.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
            <button
              onClick={login}
              className="px-8 py-4 rounded-lg font-bold bg-[#AAFF45] text-[#0A0A0A] hover:bg-[#99EE34] transition-all duration-150 flex items-center justify-center gap-2 text-base"
            >
              Empezar prueba gratis
              <ArrowRight className="w-5 h-5" />
            </button>
            <Link
              href="/pricing"
              className="px-8 py-4 rounded-lg font-semibold bg-transparent text-white border border-[#2A2A2A] hover:border-[#AAFF45] transition-colors text-base text-center"
            >
              Ver qué incluye
            </Link>
          </div>

          <p className="text-sm text-[#555555] font-medium mb-12">
            3 días gratis · Sin cargo hoy · Cancela cuando quieras
          </p>

          {/* Trust features */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#A0A0A0] font-medium">
            {[
              "Personalizado a tus objetivos",
              "Planes de comida y entrenamientos incluidos",
              "Cancela antes de que termine la prueba",
            ].map(feat => (
              <div key={feat} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#AAFF45]" />
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
            { icon: Dumbbell, title: "Entrenamientos Personalizados", desc: "Fuerza, cardio o HIIT — tu plan de entrenamiento se adapta a tu nivel, horario y equipamiento." },
            { icon: TrendingUp, title: "Seguimiento del Progreso", desc: "Registra tu peso, sigue tus rachas de entrenamiento y observa cómo mejoran tus resultados semana a semana." },
          ].map((card, idx) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.08 }}
              className="bg-[#1A1A1A] rounded-lg p-6 border border-[#2A2A2A]"
            >
              <div className="w-10 h-10 rounded-lg bg-[#AAFF45]/10 flex items-center justify-center mb-4">
                <card.icon className="w-5 h-5 text-[#AAFF45]" />
              </div>
              <h3 className="font-display font-bold text-white text-lg uppercase mb-1">{card.title}</h3>
              <p className="text-[#A0A0A0] text-sm leading-relaxed">{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
}
