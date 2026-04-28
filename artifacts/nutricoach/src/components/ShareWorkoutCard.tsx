import { useState, useRef, useCallback } from "react";
import { useProfile, useProgressStats } from "@/lib/supabase-queries";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/language";

export type WorkoutData = {
  workout_type: string;
  exercises: Array<{ name: string; sets?: number; reps?: number; duration_seconds?: number }>;
  notes?: string;
  duration_minutes?: number | null;
  motivational_quote?: string;
};

const WORKOUT_TYPE_ES: Record<string, string> = {
  cardio: "CARDIO", hiit: "HIIT", circuit: "CIRCUITO",
  strength_upper: "TREN SUPERIOR", strength_lower: "TREN INFERIOR",
  full_body: "CUERPO COMPLETO", push_day: "DÍA DE EMPUJE",
  pull_day: "DÍA DE TRACCIÓN", leg_day: "DÍA DE PIERNAS",
  core_day: "CORE", cardio_day: "CARDIO",
};

const WORKOUT_TYPE_EN: Record<string, string> = {
  cardio: "CARDIO", hiit: "HIIT", circuit: "CIRCUIT",
  strength_upper: "UPPER BODY", strength_lower: "LOWER BODY",
  full_body: "FULL BODY", push_day: "PUSH DAY",
  pull_day: "PULL DAY", leg_day: "LEG DAY",
  core_day: "CORE", cardio_day: "CARDIO",
};

export function getWorkoutTypeLabel(type: string, lang?: string): string {
  const map = lang === "en" ? WORKOUT_TYPE_EN : WORKOUT_TYPE_ES;
  return map[type] ?? type.toUpperCase().replace(/_/g, " ");
}

function estimateDuration(exercises: WorkoutData["exercises"]): number {
  const sets = exercises.reduce((s, e) => s + (e.sets ?? 3), 0);
  return Math.round((sets * 2.5 + 10) / 5) * 5;
}

function formatDate(lang: string): string {
  const now = new Date();
  return now.toLocaleDateString(lang === "en" ? "en-US" : "es-ES", {
    day: "numeric", month: "short", year: "numeric"
  }).toUpperCase();
}

export function ShareWorkoutButton({ workout }: { workout: WorkoutData }) {
  const [open, setOpen] = useState(false);
  const { lang } = useLanguage();
  const isES = lang !== "en";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
        style={{
          background: "color-mix(in srgb, var(--giq-accent) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--giq-accent) 25%, transparent)",
          color: "var(--giq-accent)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        {isES ? "Compartir" : "Share"}
      </button>

      {open && (
        <ShareModal workout={workout} onClose={() => setOpen(false)} lang={lang} isES={isES} />
      )}
    </>
  );
}

function ShareModal({ workout, onClose, lang, isES }: {
  workout: WorkoutData;
  onClose: () => void;
  lang: string;
  isES: boolean;
}) {
  const { data: profile } = useProfile();
  const { data: stats } = useProgressStats();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [offsetY, setOffsetY] = useState(0);
  const [imgRenderedH, setImgRenderedH] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const stripHRef = useRef(0);

  const typeLabel = getWorkoutTypeLabel(workout.workout_type, lang);
  const duration = workout.duration_minutes ?? estimateDuration(workout.exercises);
  const streak = stats?.streak ?? 0;
  const dateStr = formatDate(lang);

  // Workout subtitle — muscle groups
  const subtitleMap: Record<string, string> = {
    push_day: isES ? "Pecho · Hombros · Tríceps" : "Chest · Shoulders · Triceps",
    pull_day: isES ? "Espalda · Bíceps" : "Back · Biceps",
    leg_day: isES ? "Cuádriceps · Femorales · Glúteos" : "Quads · Hamstrings · Glutes",
    strength_upper: isES ? "Tren Superior" : "Upper Body",
    strength_lower: isES ? "Tren Inferior" : "Lower Body",
    full_body: isES ? "Cuerpo Completo" : "Full Body",
  };
  const subtitle = subtitleMap[workout.workout_type] ?? typeLabel;

  const clamp = useCallback((v: number) => {
    const min = -(Math.max(imgRenderedH - stripHRef.current, 0));
    return Math.max(min, Math.min(0, v));
  }, [imgRenderedH]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const card = cardRef.current;
      if (!card) return;
      stripHRef.current = card.offsetHeight;
      const h = card.offsetWidth * (img.naturalHeight / img.naturalWidth);
      setImgRenderedH(h);
      setOffsetY(-(Math.max(h - stripHRef.current, 0)) / 2);
    };
    img.src = url;
    setPhotoUrl(url);
  };

  const removePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoUrl(null);
    setOffsetY(0);
    setImgRenderedH(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    if (!photoUrl || imgRenderedH <= stripHRef.current) return;
    setIsDragging(true);
    startYRef.current = e.clientY;
    startOffsetRef.current = offsetY;
    e.preventDefault();
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffsetY(clamp(startOffsetRef.current + (e.clientY - startYRef.current)));
  };
  const onMouseUp = () => setIsDragging(false);

  // Touch drag
  const onTouchStart = (e: React.TouchEvent) => {
    if (!photoUrl || imgRenderedH <= stripHRef.current) return;
    setIsDragging(true);
    startYRef.current = e.touches[0].clientY;
    startOffsetRef.current = offsetY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setOffsetY(clamp(startOffsetRef.current + (e.touches[0].clientY - startYRef.current)));
    e.preventDefault();
  };
  const onTouchEnd = () => setIsDragging(false);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: isES ? "Mi entrenamiento de hoy" : "My workout today",
          text: `${typeLabel} — ${workout.exercises.length} ${isES ? "ejercicios" : "exercises"} · ${duration} min`,
        });
      }
    } catch (err) {
      console.log("Share cancelled or not supported");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden"
        style={{ background: "#0a0a0a", border: "1px solid #1f1f1f" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#1a1a1a" }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#555", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {isES ? "Compartir entrenamiento" : "Share workout"}
          </span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: "#1a1a1a" }}>
            <X className="w-4 h-4" style={{ color: "#888" }} />
          </button>
        </div>

        <div className="p-4">
          {/* THE CARD */}
          <div
            ref={cardRef}
            style={{
              width: "100%",
              aspectRatio: "4/5",
              borderRadius: 16,
              overflow: "hidden",
              position: "relative",
              background: "#0d0d0d",
              marginBottom: 14,
              cursor: photoUrl ? (isDragging ? "grabbing" : "grab") : "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
            onClick={() => !photoUrl && fileInputRef.current?.click()}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Photo placeholder */}
            {!photoUrl && (
              <div style={{ position: "absolute", top: 20, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>📸</span>
                <span style={{ fontSize: 11, color: "#333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {isES ? "Añadir foto" : "Add photo"}
                </span>
              </div>
            )}

            {/* Photo */}
            {photoUrl && (
              <>
                <img
                  src={photoUrl}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "auto", transform: `translateY(${offsetY}px)`, pointerEvents: "none", userSelect: "none" }}
                  draggable={false}
                />
                {/* Gradient overlay */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.95) 100%)", pointerEvents: "none" }} />
                {/* Date */}
                <div style={{ position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 10px", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {dateStr}
                </div>
                {/* Action buttons */}
                <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 6, zIndex: 10 }}>
                  <button onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }} style={{ fontSize: 12, fontWeight: 700, color: "#fff", padding: "6px 12px", borderRadius: 8, border: "none", background: "#222", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                    ✏️ {isES ? "Cambiar foto" : "Change photo"}
                  </button>
                  <button onClick={removePhoto} style={{ fontSize: 12, fontWeight: 700, color: "#fff", padding: "6px 12px", borderRadius: 8, border: "none", background: "#7f1d1d", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                    ✕ {isES ? "Eliminar foto" : "Remove photo"}
                  </button>
                </div>
              </>
            )}

            {/* Bottom content — always visible */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 16px 16px", pointerEvents: "none" }}>
              {/* Workout type pill */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#88ee22", flexShrink: 0 }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: "#88ee22", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  {isES ? "Entreno completado" : "Workout completed"}
                </span>
              </div>

              {/* Workout name */}
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 3, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
                {typeLabel}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, marginBottom: 14, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {subtitle}
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-end" }}>
                {[
                  { val: workout.exercises.length, lbl: isES ? "Ejercicios" : "Exercises", accent: true },
                  { val: duration, lbl: isES ? "Minutos" : "Minutes" },
                  { val: streak > 0 ? `🔥${streak}` : "—", lbl: isES ? "Racha" : "Streak" },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: s.accent ? "#88ee22" : "#fff", lineHeight: 1 }}>{s.val}</span>
                    <span style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginTop: 2, fontWeight: 700, textTransform: "uppercase" }}>{s.lbl}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 10 }} />

              {/* Exercise list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {workout.exercises.slice(0, 6).map((ex, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: "rgba(136,238,34,0.08)", border: "1px solid rgba(136,238,34,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "#88ee22", flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.03em", textTransform: "uppercase" }}>
                      {ex.name}
                    </span>
                    {ex.sets && ex.reps && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", flexShrink: 0, letterSpacing: "0.03em" }}>
                        {ex.sets}×{ex.reps}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Share button */}
          <button
            onClick={handleShare}
            style={{
              width: "100%", background: "#111", border: "1px solid #1f1f1f",
              borderRadius: 14, padding: "15px 20px",
              fontSize: 13, fontWeight: 800, color: "#88ee22",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              letterSpacing: "0.08em", textTransform: "uppercase",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#88ee22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            {isES ? "Compartir" : "Share"}
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
    </div>
  );
}

export function ShareRestDayButton() {
  const [open, setOpen] = useState(false);
  const { lang } = useLanguage();
  const isES = lang !== "en";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
        style={{
          background: "color-mix(in srgb, #7B8CDE 12%, transparent)",
          border: "1px solid color-mix(in srgb, #7B8CDE 25%, transparent)",
          color: "#7B8CDE",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        {isES ? "Compartir" : "Share"}
      </button>

      {open && (
        <RestDayModal onClose={() => setOpen(false)} lang={lang} isES={isES} />
      )}
    </>
  );
}

function RestDayModal({ onClose, lang, isES }: { onClose: () => void; lang: string; isES: boolean }) {
  const { data: stats } = useProgressStats();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [offsetY, setOffsetY] = useState(0);
  const [imgRenderedH, setImgRenderedH] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const stripHRef = useRef(0);

  const streak = stats?.streak ?? 0;
  const totalWorkouts = stats?.totalWorkouts ?? 0;
  const dateStr = new Date().toLocaleDateString(lang === "en" ? "en-US" : "es-ES", {
    day: "numeric", month: "short", year: "numeric"
  }).toUpperCase();

  const clamp = useCallback((v: number) => {
    return Math.max(-(Math.max(imgRenderedH - stripHRef.current, 0)), Math.min(0, v));
  }, [imgRenderedH]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const card = cardRef.current;
      if (!card) return;
      stripHRef.current = card.offsetHeight;
      const h = card.offsetWidth * (img.naturalHeight / img.naturalWidth);
      setImgRenderedH(h);
      setOffsetY(-(Math.max(h - stripHRef.current, 0)) / 2);
    };
    img.src = url;
    setPhotoUrl(url);
  };

  const removePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoUrl(null);
    setOffsetY(0);
    setImgRenderedH(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!photoUrl || imgRenderedH <= stripHRef.current) return;
    setIsDragging(true);
    startYRef.current = e.clientY;
    startOffsetRef.current = offsetY;
    e.preventDefault();
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffsetY(clamp(startOffsetRef.current + (e.clientY - startYRef.current)));
  };
  const onMouseUp = () => setIsDragging(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!photoUrl || imgRenderedH <= stripHRef.current) return;
    setIsDragging(true);
    startYRef.current = e.touches[0].clientY;
    startOffsetRef.current = offsetY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setOffsetY(clamp(startOffsetRef.current + (e.touches[0].clientY - startYRef.current)));
    e.preventDefault();
  };
  const onTouchEnd = () => setIsDragging(false);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: isES ? "Mi día de descanso" : "My rest day",
          text: isES ? `Recuperación activa · Racha de ${streak} días 🔥` : `Active recovery · ${streak} day streak 🔥`,
        });
      }
    } catch (err) {
      console.log("Share cancelled");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden"
        style={{ background: "#0a0a0a", border: "1px solid #1f1f1f" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#1a1a1a" }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#555", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {isES ? "Compartir descanso" : "Share rest day"}
          </span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: "#1a1a1a" }}>
            <X className="w-4 h-4" style={{ color: "#888" }} />
          </button>
        </div>

        <div className="p-4">
          {/* Card */}
          <div
            ref={cardRef}
            style={{
              width: "100%", aspectRatio: "4/5",
              borderRadius: 16, overflow: "hidden",
              position: "relative", background: "#0d0d0d",
              marginBottom: 14,
              cursor: photoUrl ? (isDragging ? "grabbing" : "grab") : "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
            onClick={() => !photoUrl && fileInputRef.current?.click()}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Placeholder */}
            {!photoUrl && (
              <div style={{ position: "absolute", top: 20, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>📸</span>
                <span style={{ fontSize: 11, color: "#333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {isES ? "Añadir foto" : "Add photo"}
                </span>
              </div>
            )}

            {/* Photo */}
            {photoUrl && (
              <>
                <img src={photoUrl} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "auto", transform: `translateY(${offsetY}px)`, pointerEvents: "none", userSelect: "none" }} draggable={false} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.95) 100%)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 10px", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {dateStr}
                </div>
                <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 6, zIndex: 10 }}>
                  <button onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }} style={{ fontSize: 12, fontWeight: 700, color: "#fff", padding: "6px 12px", borderRadius: 8, border: "none", background: "#222", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                    ✏️ {isES ? "Cambiar foto" : "Change photo"}
                  </button>
                  <button onClick={removePhoto} style={{ fontSize: 12, fontWeight: 700, color: "#fff", padding: "6px 12px", borderRadius: 8, border: "none", background: "#7f1d1d", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                    ✕ {isES ? "Eliminar foto" : "Remove photo"}
                  </button>
                </div>
              </>
            )}

            {/* Bottom content */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 16px 16px", pointerEvents: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7B8CDE", flexShrink: 0 }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: "#7B8CDE", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  {isES ? "Día de descanso" : "Rest day"}
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 3, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
                {isES ? "Recuperación" : "Recovery"}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, marginBottom: 14, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {isES ? "Cuerpo · Mente · Energía" : "Body · Mind · Energy"}
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                {[
                  { val: "🧘", lbl: isES ? "Activo" : "Active", color: "#7B8CDE" },
                  { val: streak > 0 ? `🔥${streak}` : "—", lbl: isES ? "Racha" : "Streak", color: "#88ee22" },
                  { val: totalWorkouts, lbl: isES ? "Entrenos" : "Workouts", color: "#fff" },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</span>
                    <span style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginTop: 2, fontWeight: 700, textTransform: "uppercase" }}>{s.lbl}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Share button */}
          <button
            onClick={handleShare}
            style={{
              width: "100%", background: "#111", border: "1px solid #1f1f1f",
              borderRadius: 14, padding: "15px 20px",
              fontSize: 13, fontWeight: 800, color: "#88ee22",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              letterSpacing: "0.08em", textTransform: "uppercase",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#88ee22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            {isES ? "Compartir" : "Share"}
          </button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
    </div>
  );
}
