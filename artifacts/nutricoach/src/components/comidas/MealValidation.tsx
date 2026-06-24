import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";
import { getAccessToken } from "@/lib/supabase-queries";

gsap.registerPlugin(useGSAP);

// ── BALANZ palette ───────────────────────────────────────────────────────────
const CYAN = "#50F0E4";

type ValidationStatus = "match" | "partial" | "mismatch";

interface ValidateResponse {
  match_percentage: number;
  status: ValidationStatus;
  detected_ingredients: string[];
  feedback: string;
}

type Phase = "idle" | "capturing" | "analyzing" | "result" | "error";

export interface MealValidationProps {
  /** Nombre de la comida esperada (viene de /api/diets/visualize). */
  meal_name: string;
  /** Ingredientes esperados de esa comida. */
  expected_ingredients: string[];
  /** Imagen generada del plato (data URL o URL), formato 9:16. */
  image_url: string;
  /** Se llama cuando el usuario registra una comida validada como "match". */
  onMealRegistered?: (result: ValidateResponse) => void;
}

/** Convierte un File a data URL base64 ("data:image/...;base64,..."). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Estilo visual por estado del resultado.
const RESULT_STYLES: Record<
  ValidationStatus,
  { color: string; title: string }
> = {
  match: { color: "#22C55E", title: "¡Excelente!" },
  partial: { color: "#FACC15", title: "Parcial" },
  mismatch: { color: "#EF4444", title: "No coincide" },
};

export default function MealValidation({
  meal_name,
  expected_ingredients,
  image_url,
  onMealRegistered,
}: MealValidationProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [result, setResult] = useState<ValidateResponse | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);

  // Spinner GSAP: gira de forma infinita mientras phase === "analyzing".
  // useGSAP limpia el tween automáticamente al desmontar / cambiar de fase.
  useGSAP(
    () => {
      if (phase !== "analyzing" || !spinnerRef.current) return;
      gsap.to(spinnerRef.current, {
        rotation: 360,
        repeat: -1,
        duration: 0.9,
        ease: "none",
      });
    },
    { dependencies: [phase], scope: containerRef },
  );

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Permite volver a elegir el mismo archivo más tarde.
    e.target.value = "";
    if (!file) return;
    const base64 = await fileToBase64(file);
    setPhotoBase64(base64);
    setResult(null);
    setPhase("capturing");
  };

  const handleAnalyze = async () => {
    if (!photoBase64) return;
    setPhase("analyzing");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/meals/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          photo_base64: photoBase64,
          expected_meal: meal_name,
          expected_ingredients,
        }),
      });
      if (!res.ok) throw new Error(`validate ${res.status}`);
      const data: ValidateResponse = await res.json();
      setResult(data);
      setPhase("result");
    } catch {
      setPhase("error");
    }
  };

  const handleRetry = () => {
    setResult(null);
    setPhotoBase64(null);
    setPhase("idle");
    // Reabre directamente el selector para "reintentar foto".
    requestAnimationFrame(openFilePicker);
  };

  const handleRegister = () => {
    if (result) onMealRegistered?.(result);
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full flex-col items-center justify-center gap-5 overflow-hidden bg-white p-5 text-black"
    >
      {/* Input file oculto: cámara trasera en móvil. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* ── IDLE: imagen del plato + CTA ────────────────────────────────── */}
      {phase === "idle" && (
        <>
          <h2 className="text-center text-lg font-semibold tracking-tight">
            {meal_name}
          </h2>
          <div className="relative aspect-[9/16] max-h-[58vh] overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            <img
              src={image_url}
              alt={meal_name}
              className="h-full w-full object-contain"
            />
          </div>
          <button
            onClick={openFilePicker}
            className="flex items-center gap-2 rounded-full px-7 py-3 text-base font-semibold text-black transition active:scale-95"
            style={{ backgroundColor: CYAN }}
          >
            <span className="text-xl">📷</span>
            Mi comida real
          </button>
        </>
      )}

      {/* ── CAPTURING: preview + analizar ───────────────────────────────── */}
      {phase === "capturing" && photoBase64 && (
        <>
          <h2 className="text-center text-lg font-semibold tracking-tight">
            Tu foto
          </h2>
          <div className="relative aspect-[9/16] max-h-[58vh] overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            <img
              src={photoBase64}
              alt="Foto de tu comida"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openFilePicker}
              className="rounded-full border border-black/15 px-5 py-3 text-sm font-medium text-black/70 transition active:scale-95"
            >
              Cambiar
            </button>
            <button
              onClick={handleAnalyze}
              className="rounded-full px-7 py-3 text-base font-semibold text-black transition active:scale-95"
              style={{ backgroundColor: CYAN }}
            >
              Analizar comida
            </button>
          </div>
        </>
      )}

      {/* ── ANALYZING: spinner ──────────────────────────────────────────── */}
      {phase === "analyzing" && (
        <div className="flex flex-col items-center gap-5">
          <div
            ref={spinnerRef}
            className="h-14 w-14 rounded-full border-4 border-black/10"
            style={{ borderTopColor: CYAN }}
          />
          <p className="text-base font-medium text-black/70">Analizando...</p>
        </div>
      )}

      {/* ── RESULT ──────────────────────────────────────────────────────── */}
      {phase === "result" && result && (
        <ResultView
          result={result}
          onRegister={handleRegister}
          onRetry={handleRetry}
        />
      )}

      {/* ── ERROR ───────────────────────────────────────────────────────── */}
      {phase === "error" && (
        <div className="flex flex-col items-center gap-5">
          <p className="text-center text-base font-medium text-black/70">
            No se pudo analizar la foto.
          </p>
          <button
            onClick={handleRetry}
            className="rounded-full bg-black/10 px-7 py-3 text-base font-semibold text-black/70 transition active:scale-95"
          >
            Reintentar foto
          </button>
        </div>
      )}
    </div>
  );
}

function ResultView({
  result,
  onRegister,
  onRetry,
}: {
  result: ValidateResponse;
  onRegister: () => void;
  onRetry: () => void;
}) {
  const { color, title } = RESULT_STYLES[result.status];
  const isMatch = result.status === "match";

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      {/* Porcentaje + título */}
      <div
        className="flex h-24 w-24 items-center justify-center rounded-full border-4 text-2xl font-bold"
        style={{ borderColor: color, color }}
      >
        {result.match_percentage}%
      </div>
      <h2 className="text-xl font-bold" style={{ color }}>
        {title}
      </h2>

      {isMatch ? (
        // VERDE: lista de coincidencias con ✓
        <div className="w-full">
          <p className="mb-2 text-center text-sm font-medium text-black/60">
            Coincidencias
          </p>
          <ul className="flex flex-col gap-1.5">
            {result.detected_ingredients.map((ing, i) => (
              <li
                key={`${ing}-${i}`}
                className="flex items-center gap-2 text-sm text-black/80"
              >
                <span style={{ color }}>✓</span>
                {ing}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        // AMARILLO / ROJO: detectado + feedback
        <div className="w-full text-center">
          <p className="text-sm text-black/80">
            <span className="font-medium text-black/60">Ha detectado: </span>
            {result.detected_ingredients.join(", ") || "—"}
          </p>
          <p className="mt-2 text-sm italic text-black/70">
            “{result.feedback}”
          </p>
        </div>
      )}

      {isMatch ? (
        <button
          onClick={onRegister}
          className="mt-1 rounded-full px-8 py-3 text-base font-semibold text-white transition active:scale-95"
          style={{ backgroundColor: color }}
        >
          Registrar comida
        </button>
      ) : (
        <button
          onClick={onRetry}
          className={cn(
            "mt-1 rounded-full bg-black/10 px-8 py-3 text-base font-semibold",
            "text-black/70 transition active:scale-95",
          )}
        >
          Reintentar foto
        </button>
      )}
    </div>
  );
}
