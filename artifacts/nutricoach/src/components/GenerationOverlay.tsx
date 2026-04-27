import { useIsMutating } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/language";

export function GenerationOverlay() {
  const t = useT();
  const isGeneratingWorkout = useIsMutating({ mutationKey: ["generate-workout"] }) > 0;
  const isGeneratingMeal = useIsMutating({ mutationKey: ["generate-meal"] }) > 0;
  const isGenerating = isGeneratingWorkout || isGeneratingMeal;

  if (!isGenerating) return null;

  const label = isGeneratingWorkout
    ? (typeof t("generating_workout") === "string" && t("generating_workout") !== "generating_workout"
        ? t("generating_workout")
        : "Creando tu plan de entrenos...")
    : (typeof t("generating_meal") === "string" && t("generating_meal") !== "generating_meal"
        ? t("generating_meal")
        : "Creando tu plan de comidas...");

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="flex flex-col items-center gap-4 rounded-2xl px-8 py-6 max-w-xs w-full mx-4"
        style={{ background: "#141414", border: "1px solid #1f1f1f" }}
      >
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--giq-accent)" }} />
        <div className="text-center">
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="text-xs mt-1" style={{ color: "#555" }}>⏱ ~30 segundos</p>
        </div>
      </div>
    </div>
  );
}
