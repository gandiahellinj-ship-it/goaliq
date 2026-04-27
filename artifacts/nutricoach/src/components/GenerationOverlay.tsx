import { useIsMutating } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/language";

type StepStatus = "pending" | "loading" | "done";

export function GenerationOverlay() {
  const { lang } = useLanguage();
  const isES = lang !== "en";

  const isGeneratingMeal = useIsMutating({ mutationKey: ["generate-meal"] }) > 0;
  const isGeneratingWorkout = useIsMutating({ mutationKey: ["generate-workout"] }) > 0;

  const [visible, setVisible] = useState(false);
  const [mealDone, setMealDone] = useState(false);
  const [workoutDone, setWorkoutDone] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  // Track whether each mutation was ever observed as active
  const mealWasActive = useRef(false);
  const workoutWasActive = useRef(false);

  // Show overlay when any generation starts
  useEffect(() => {
    if (isGeneratingMeal || isGeneratingWorkout) {
      setVisible(true);
      setDismissing(false);
    }
  }, [isGeneratingMeal, isGeneratingWorkout]);

  // Edge detection: meal was running → now finished
  useEffect(() => {
    if (isGeneratingMeal) {
      mealWasActive.current = true;
    } else if (mealWasActive.current && !mealDone) {
      setMealDone(true);
    }
  }, [isGeneratingMeal]);

  // Edge detection: workout was running → now finished
  useEffect(() => {
    if (isGeneratingWorkout) {
      workoutWasActive.current = true;
    } else if (workoutWasActive.current && !workoutDone) {
      setWorkoutDone(true);
    }
  }, [isGeneratingWorkout]);

  // If meal is done but workout was never started, auto-complete workout after short delay
  useEffect(() => {
    if (visible && mealDone && !workoutWasActive.current && !workoutDone) {
      const t = setTimeout(() => setWorkoutDone(true), 800);
      return () => clearTimeout(t);
    }
  }, [visible, mealDone, workoutDone]);

  // Auto-dismiss when all tracked steps are done and nothing is generating
  useEffect(() => {
    const anyTracked = mealWasActive.current || workoutWasActive.current;
    const allFinished = !isGeneratingMeal && !isGeneratingWorkout;
    const allDone = (mealWasActive.current ? mealDone : true) && (workoutWasActive.current ? workoutDone : true);

    if (visible && anyTracked && allFinished && allDone) {
      setDismissing(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setMealDone(false);
        setWorkoutDone(false);
        setDismissing(false);
        mealWasActive.current = false;
        workoutWasActive.current = false;
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [visible, mealDone, workoutDone, isGeneratingMeal, isGeneratingWorkout]);

  if (!visible) return null;

  const allDone = mealDone && (workoutWasActive.current ? workoutDone : true);

  // Step statuses
  const mealStatus: StepStatus = mealDone ? "done" : isGeneratingMeal ? "loading" : mealWasActive.current ? "loading" : "pending";
  const shoppingStatus: StepStatus = mealDone ? "done" : isGeneratingMeal ? "loading" : mealWasActive.current ? "loading" : "pending";
  const workoutStatus: StepStatus = workoutDone ? "done" : isGeneratingWorkout ? "loading" : workoutWasActive.current ? "loading" : mealDone ? "loading" : "pending";

  const steps = [
    { id: "meal",     labelES: "Plan de comidas",    labelEN: "Meal plan",     status: mealStatus },
    { id: "shopping", labelES: "Lista de la compra", labelEN: "Shopping list", status: shoppingStatus },
    { id: "workout",  labelES: "Plan de entrenos",   labelEN: "Workout plan",  status: workoutStatus },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.80)",
        backdropFilter: "blur(6px)",
        opacity: dismissing ? 0 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      <div
        className="flex flex-col items-center gap-6 rounded-2xl px-8 py-8 w-full mx-4"
        style={{ background: "#141414", border: "1px solid #1f1f1f", maxWidth: 320 }}
      >
        {/* Header */}
        <div className="text-center">
          <p className="text-base font-bold text-white">
            {allDone
              ? (isES ? "¡Todo listo! 🎉" : "All done! 🎉")
              : (isES ? "Creando tu plan..." : "Building your plan...")}
          </p>
          <p className="text-xs mt-1.5" style={{ color: "#555" }}>
            {allDone
              ? (isES ? "Redirigiendo..." : "Redirecting...")
              : (isES ? "⏱ 1–2 minutos" : "⏱ 1–2 minutes")}
          </p>
        </div>

        {/* Steps */}
        <div className="w-full space-y-3">
          {steps.map((step) => {
            const label = isES ? step.labelES : step.labelEN;
            return (
              <div
                key={step.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: step.status === "done"
                    ? "rgba(136,238,34,0.08)"
                    : step.status === "loading"
                    ? "rgba(255,255,255,0.04)"
                    : "#111",
                  border: `1px solid ${
                    step.status === "done"
                      ? "rgba(136,238,34,0.25)"
                      : step.status === "loading"
                      ? "#2a2a2a"
                      : "#1a1a1a"
                  }`,
                  transition: "all 0.3s ease",
                }}
              >
                <div className="shrink-0 w-6 h-6 flex items-center justify-center">
                  {step.status === "done" ? (
                    <CheckCircle2 className="w-5 h-5" style={{ color: "var(--giq-accent)" }} />
                  ) : step.status === "loading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--giq-accent)" }} />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: "#2a2a2a" }} />
                  )}
                </div>
                <span
                  className="text-sm font-semibold flex-1"
                  style={{
                    color: step.status === "done" ? "var(--giq-accent)"
                      : step.status === "loading" ? "#e8e8e8"
                      : "#444",
                  }}
                >
                  {label}
                </span>
                {step.status === "done" && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(136,238,34,0.15)", color: "var(--giq-accent)" }}
                  >
                    {isES ? "Listo" : "Done"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {steps.map((step) => (
            <div
              key={step.id}
              className="rounded-full transition-all duration-500"
              style={{
                width: step.status === "loading" ? 16 : 6,
                height: 6,
                background: step.status === "done" || step.status === "loading"
                  ? "var(--giq-accent)"
                  : "#2a2a2a",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
