import { useEffect } from "react";
import HomeScene, { HOME_PROGRESS } from "@/components/mesa/HomeScene";

/**
 * /test-home — sandbox aislado para validar la escena HOME de "La Mesa Viva"
 * (Paso 2, §6.1 + §8). NO toca la app real ni el Home actual.
 *
 * Capa 3D: <HomeScene> (plano texturizado + aro de progreso 3D).
 * Capa overlay HTML (esta página): saludo + frase del día, con las
 * tipografías del documento (Space Grotesk titulares / Inter texto).
 */

const NAME = "José";
const PHRASE = "Cada entreno suma. Vas firme este mes — sigue así.";

const DONE = 12;
const GOAL = 17;

export default function TestHome() {
  // Cargamos Space Grotesk + Inter solo mientras esta página está montada,
  // sin modificar index.html ni la app real.
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap";
    link.dataset.testHomeFonts = "1";
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);

  const pct = Math.round(HOME_PROGRESS * 100);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-white">
      {/* Capa 3D */}
      <div className="absolute inset-0">
        <HomeScene />
      </div>

      {/* Capa overlay HTML (encima del Canvas), no intercepta gestos del 3D */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {/* Barra superior mínima */}
        <div className="flex items-center gap-2 px-6 pt-6">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0AF7EE] shadow-[0_0_8px_#0AF7EE]" />
          <span
            className="text-[11px] uppercase tracking-[0.22em] text-[#1C2226]/55"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            La mesa viva · Home
          </span>
        </div>

        {/* Saludo + frase del día */}
        <div className="px-7 pt-10">
          <h1
            className="text-[2rem] leading-tight text-[#1C2226]"
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}
          >
            Hola, {NAME}
          </h1>
          <p
            className="mt-2 max-w-[20rem] text-[15px] leading-relaxed text-[#1C2226]/60"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {PHRASE}
          </p>
        </div>

        {/* Etiqueta sutil del progreso del aro (validación del mock) */}
        <div className="mt-auto px-7 pb-9">
          <p
            className="text-[12px] tracking-wide text-[#1C2226]/45"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Progreso mensual de entrenos ·{" "}
            <span className="font-semibold text-[#1C2226]/70">
              {DONE} / {GOAL}
            </span>{" "}
            <span className="text-[#0AF7EE]">({pct}%)</span>
          </p>
        </div>
      </div>
    </div>
  );
}
