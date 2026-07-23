import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Dumbbell } from "lucide-react";
import type { WorkoutData, Exercise } from "@/types";

const clipUrl = (clip: string) => `${import.meta.env.BASE_URL.replace(/\/$/, "")}${clip}`;

/** Neutral animated placeholder — reads as a "clip" without being a broken box. */
function ClipPlaceholder({ muscle, small }: { muscle: string; small?: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
      <motion.div
        className="absolute inset-0"
        style={{ background: "linear-gradient(100deg, transparent 35%, rgba(185,156,111,0.16) 50%, transparent 65%)" }}
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
      />
      <div className="flex flex-col items-center gap-1.5 text-[var(--color-brand-grey)]">
        <Dumbbell className={small ? "h-4 w-4 text-[var(--color-brand-accent)]" : "h-8 w-8 text-[var(--color-brand-accent)]"} />
        {!small && <span className="text-[10px] uppercase tracking-wider">{muscle}</span>}
      </div>
    </div>
  );
}

/** Hero clip: tries the looping video, falls back to the placeholder on error. */
function ExerciseClip({ ex }: { ex: Exercise }) {
  const [failed, setFailed] = useState(false);
  if (ex.clip && !failed) {
    return (
      <video
        src={clipUrl(ex.clip)}
        autoPlay
        muted
        loop
        playsInline
        onError={() => setFailed(true)}
        className="h-full w-full rounded-2xl object-cover"
      />
    );
  }
  return <ClipPlaceholder muscle={ex.muscle} />;
}

/**
 * ENTRENOS 3b — top zone. Thin duration/kcal/done strip + the SELECTED exercise
 * as the hero (name over a large looping clip, sets×reps, technique tip, complete
 * button). The clip lives in a flex-1 slot so it shrinks before content is cut.
 */
export default function WorkoutTab({
  data,
  exercises,
  selected,
  onToggle,
}: {
  data: WorkoutData;
  exercises: Exercise[];
  selected: Exercise;
  onToggle: (id: string) => void;
}) {
  const pct = Math.round((exercises.filter((e) => e.done).length / exercises.length) * 100);

  return (
    <div className="flex h-full flex-col">
      <div className="pr-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-accent)]">Entrenos</p>
        <h2 className="font-display text-2xl font-extrabold leading-none text-[var(--color-brand-text-lbl)]">{data.title}</h2>
        <p className="text-[12px] text-[var(--color-brand-grey)]">{data.focus}</p>
      </div>

      {/* Thin stats strip — kcal solo si existe (los planes reales no la traen) */}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-brand-grey)]">
        <span className="font-bold text-[var(--color-brand-text-lbl)]">{data.durationMin}m</span> ·
        {data.totalKcal != null && (
          <>
            <span className="font-bold text-[var(--color-brand-text-lbl)]">{data.totalKcal} kcal</span> ·
          </>
        )}
        <span className="font-bold text-[var(--color-brand-accent)]">{pct}% hecho</span>
      </div>

      {/* Selected exercise: name + muscle above the clip */}
      <div className="mt-2 text-center">
        <div className="font-display text-xl font-bold leading-tight text-[var(--color-brand-text-lbl)]">{selected.name}</div>
        <div className="text-[11px] text-[var(--color-brand-grey)]">{selected.muscle}</div>
      </div>

      {/* Clip (shrinks first) */}
      <div className="mt-2 flex min-h-0 flex-1 items-center justify-center">
        <div className="h-full" style={{ aspectRatio: "1 / 1", maxHeight: "100%" }}>
          <ExerciseClip ex={selected} />
        </div>
      </div>

      {/* Sets × reps */}
      <div className="mt-2 text-center">
        <span className="font-display text-2xl font-bold text-[var(--color-brand-text-lbl)]">{selected.sets}</span>
        <span className="mx-1 text-[var(--color-brand-grey)]">×</span>
        <span className="font-display text-2xl font-bold text-[var(--color-brand-text-lbl)]">{selected.reps}</span>
        <span className="ml-2 text-[11px] uppercase tracking-wider text-[var(--color-brand-grey)]">series × reps</span>
      </div>

      {/* Tip */}
      {selected.tip && (
        <div
          className="mt-2 rounded-xl px-3 py-1.5 text-[11px] leading-snug"
          style={{ background: "var(--color-brand-accent-soft)", color: "#6B5B3E" }}
        >
          💡 {selected.tip}
        </div>
      )}

      {/* Complete this exercise */}
      <button
        onClick={() => onToggle(selected.id)}
        className="mt-2 w-full rounded-xl py-2.5 text-[13px] font-bold transition-colors"
        style={
          selected.done
            ? { background: "var(--color-brand-card)", border: "1px solid var(--color-brand-border)", color: "var(--color-brand-grey)" }
            : { background: "var(--color-brand-accent)", color: "#fff" }
        }
      >
        {selected.done ? "Ejercicio completado ✓" : "Marcar ejercicio ✓"}
      </button>
    </div>
  );
}

/**
 * Contextual carousel — one card per exercise (placeholder thumb + number +
 * sets×reps + check), selected slightly larger, prev/next partly visible.
 * "Entreno completado" below marks every exercise done.
 */
export function WorkoutCarousel({
  exercises,
  selectedId,
  onSelect,
  onCompleteAll,
  allDone,
}: {
  exercises: Exercise[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCompleteAll: () => void;
  allDone: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
        {exercises.map((e, i) => {
          const active = e.id === selectedId;
          return (
            <button
              key={e.id}
              onClick={() => onSelect(e.id)}
              className="flex shrink-0 flex-col items-center gap-0.5"
              style={{ scrollSnapAlign: "center", opacity: active ? 1 : 0.6, transition: "opacity 200ms" }}
            >
              <div
                className="relative overflow-hidden rounded-xl"
                style={{ width: active ? 62 : 54, height: active ? 46 : 40, transition: "all 200ms" }}
              >
                <ClipPlaceholder muscle={e.muscle} small />
                <span
                  className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    background: e.done ? "var(--color-brand-accent)" : "rgba(255,255,255,0.85)",
                    color: e.done ? "#fff" : "var(--color-brand-grey)",
                  }}
                >
                  {e.done ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
              </div>
              <span className="text-[9px] font-semibold" style={{ color: active ? "var(--color-brand-text-lbl)" : "var(--color-brand-grey)" }}>
                {e.sets}×{e.reps}
              </span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onCompleteAll}
        className="mt-2 w-full rounded-xl py-2 text-[13px] font-bold text-white"
        style={{ background: "var(--color-brand-accent)", opacity: allDone ? 0.6 : 1 }}
      >
        {allDone ? "Entreno completado ✓" : "Entreno completado"}
      </button>
    </div>
  );
}
