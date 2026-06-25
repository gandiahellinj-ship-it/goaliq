import { useCallback } from "react";
import ComidasTab from "@/components/tabs/ComidasTab";
import { useLogMeal } from "@/lib/supabase-queries";

type RegisteredPayload = {
  mealPlanId: string | null;
  mealType: string;
  date: string;
  calories: number | null;
  result: {
    match_percentage: number;
    status: "match" | "partial" | "mismatch";
    detected_ingredients: string[];
    feedback: string;
  };
};

/**
 * Ruta /comidas — vista BALANZ de la comida del día con validación por foto.
 * Persiste el registro en meal_logs (Supabase) vía useLogMeal; invalidar
 * ["daily_macros"] actualiza el aro de consumo real (useDailyMacros).
 */
export default function Comidas() {
  const logMeal = useLogMeal();

  const handleMealRegistered = useCallback(
    (payload: RegisteredPayload) => {
      logMeal.mutate({
        meal_plan_id: payload.mealPlanId,
        meal_type: payload.mealType,
        date: payload.date,
        calories: payload.calories,
        // El plan JSONB no trae macros por comida todavía → null por ahora.
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        match_percentage: payload.result.match_percentage,
        status: payload.result.status,
        detected_ingredients: payload.result.detected_ingredients,
        feedback: payload.result.feedback,
      });
    },
    [logMeal],
  );

  // Altura: viewport menos la barra superior móvil (~56px); deja hueco (pb-16)
  // para la nav inferior fija en móvil. En desktop la sidebar va al lado, así
  // que se usa la pantalla completa sin padding inferior.
  return (
    <div className="h-[calc(100dvh-56px)] pb-16 md:h-screen md:pb-0">
      <ComidasTab onMealRegistered={handleMealRegistered} />
    </div>
  );
}
