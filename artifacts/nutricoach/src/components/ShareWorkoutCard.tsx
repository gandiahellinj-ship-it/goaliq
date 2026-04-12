import { useState, useRef, useCallback } from "react";
import { useProfile, useProgressStats } from "@/lib/supabase-queries";
import type { Exercise } from "@/lib/supabase-queries";
import { X, Download } from "lucide-react";
import { getThemeAccent, getThemeAccentText } from "@/lib/theme";

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkoutData = {
  workout_type: string;
  exercises: Exercise[];
  notes?: string;
  duration_minutes?: number | null;
  motivational_quote?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PREVIEW_W = 340;
const PREVIEW_H = 220;

const WORKOUT_TYPE_ES: Record<string, string> = {
  cardio: "CARDIO",
  hiit: "HIIT",
  circuit: "CIRCUITO",
  strength_upper: "TREN SUPERIOR",
  strength_lower: "TREN INFERIOR",
  full_body: "CUERPO COMPLETO",
  push_day: "DÍA DE EMPUJE",
  pull_day: "DÍA DE TRACCIÓN",
  leg_day: "DÍA DE PIERNAS",
  core_day: "CORE",
  cardio_day: "CARDIO",
};

export function getWorkoutTypeLabel(type: string): string {
  return WORKOUT_TYPE_ES[type] ?? type.replace(/_/g, " ").toUpperCase();
}

function getMotivationalPhrase(streak: number): string {
  if (streak >= 14) return "🏆 Nivel élite. Puro compromiso.";
  if (streak >= 7) return "💪 Una semana seguida. Imparable.";
  if (streak >= 3) return "🔥 La racha crece. No pares.";
  return "⚡ Cada rep cuenta. Sigue así.";
}

function estimateDuration(exercises: Exercise[]): number {
  if (!exercises?.length) return 30;
  let totalSec = 0;
  for (const ex of exercises) {
    const sets = ex.sets ?? 3;
    const restSec = (ex as any).rest_seconds ?? ex.rest_sec ?? 60;
    totalSec += sets * 45 + sets * restSec;
  }
  return Math.max(Math.round((totalSec / 60 + 10) / 5) * 5, 20);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ─── Font loading ─────────────────────────────────────────────────────────────

function ensureGoogleFonts(): Promise<FontFaceSet> {
  if (!document.getElementById("goaliq-canvas-fonts")) {
    const link = document.createElement("link");
    link.id = "goaliq-canvas-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,800;1,700;1,800&family=Inter:wght@400;600;700&display=swap";
    document.head.appendChild(link);
  }
  return document.fonts.ready;
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hline(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function drawCoveredPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rx: number, ry: number, rw: number, rh: number,
  normX: number, normY: number
) {
  const imgA = img.naturalWidth / img.naturalHeight;
  const boxA = rw / rh;
  let dw: number, dh: number;
  if (imgA > boxA) { dh = rh; dw = rh * imgA; }
  else { dw = rw; dh = rw / imgA; }
  const maxOX = Math.max((dw - rw) / 2, 0);
  const maxOY = Math.max((dh - rh) / 2, 0);
  const dx = rx + (rw - dw) / 2 - normX * maxOX;
  const dy = ry + (rh - dh) / 2 - normY * maxOY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// ─── Card generator ───────────────────────────────────────────────────────────

function bc(size: number, style = ""): string {
  return `${style} ${size}px 'Barlow Condensed', 'Arial Black', sans-serif`.trim();
}
function inter(size: number, weight: 400 | 600 | 700 = 400): string {
  return `${weight} ${size}px 'Inter', Arial, sans-serif`;
}

function generateWorkoutCard(
  canvas: HTMLCanvasElement,
  workout: WorkoutData,
  userName: string,
  streak: number,
  bgPhoto: HTMLImageElement | null,
  photoNormX: number,
  photoNormY: number,
) {
  const ctx = canvas.getContext("2d")!;
  const W = 1080, H = 1080, PAD = 68, IW = W - PAD * 2;

  // ── Full background ──────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#0A0A0A");
  bgGrad.addColorStop(1, "#111111");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle lime glow top-right
  const accent = getThemeAccent();
  const accentText = getThemeAccentText();

  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 420);
  glow.addColorStop(0, hexToRgba(accent, 0.06));
  glow.addColorStop(1, hexToRgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Photo background (Y=252 to Y=872) ───────────────────────────────────────
  const photoRegY = 252, photoRegH = 620;

  if (bgPhoto) {
    drawCoveredPhoto(ctx, bgPhoto, 0, photoRegY, W, photoRegH, photoNormX, photoNormY);
    // Darker overlay for readability
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, photoRegY, W, photoRegH);
    // Edge vignette
    const vig = ctx.createRadialGradient(W / 2, photoRegY + photoRegH / 2, photoRegH * 0.1, W / 2, photoRegY + photoRegH / 2, photoRegH * 0.75);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, photoRegY, W, photoRegH);
    // Bottom gradient — last 300px → solid dark
    const btmGrad = ctx.createLinearGradient(0, photoRegY + photoRegH - 300, 0, photoRegY + photoRegH);
    btmGrad.addColorStop(0, "rgba(0,0,0,0)");
    btmGrad.addColorStop(1, "rgba(0,0,0,0.9)");
    ctx.fillStyle = btmGrad;
    ctx.fillRect(0, photoRegY + photoRegH - 300, W, 300);
  }

  // ── Logo top-left ────────────────────────────────────────────────────────────
  ctx.font = bc(54, "bold italic");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("Goal", PAD, 88);
  const gw = ctx.measureText("Goal").width;
  ctx.fillStyle = accent;
  ctx.fillText("IQ", PAD + gw, 88);

  // ── "MI ENTRENAMIENTO" badge top-right ───────────────────────────────────────
  ctx.font = bc(20, "bold");
  const badgeTxt = "MI ENTRENAMIENTO";
  const btw = ctx.measureText(badgeTxt).width;
  const bPX = 20, bH = 36, bW = btw + bPX * 2;
  const bX = W - PAD - bW, bY = 88 - bH + 4;
  rrect(ctx, bX, bY, bW, bH, bH / 2);
  ctx.fillStyle = accent; ctx.fill();
  ctx.fillStyle = accentText; ctx.textAlign = "center";
  ctx.fillText(badgeTxt, bX + bW / 2, bY + Math.round(bH * 0.7));
  ctx.textAlign = "left";

  // ── Thin separator + date ────────────────────────────────────────────────────
  hline(ctx, PAD, 110, W - PAD, "#1E1E1E");

  ctx.font = inter(22);
  ctx.fillStyle = "#555555";
  const dateLabel = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  ctx.fillText(dateLabel, PAD, 148);

  // ── User name ────────────────────────────────────────────────────────────────
  let nameFontSize = 72;
  ctx.font = bc(nameFontSize, "800");
  while (ctx.measureText(userName).width > IW - 20 && nameFontSize > 36) {
    nameFontSize -= 2;
    ctx.font = bc(nameFontSize, "800");
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(userName, PAD, 236);

  // ── Stat pills ───────────────────────────────────────────────────────────────
  const durationMin = workout.duration_minutes ?? estimateDuration(workout.exercises);
  const pillItems = [
    `🔥 ${streak} días de racha`,
    `⏱ ${durationMin} min`,
    `💪 ${workout.exercises.length} ejercicios`,
  ];
  ctx.font = inter(18, 700);
  const pillH = 44, pillR = 22, pillPX = 18, pillGap = 12;
  let pillX = PAD;
  const pillTop = 258;
  for (const label of pillItems) {
    const tw = ctx.measureText(label).width;
    const pw = tw + pillPX * 2;
    rrect(ctx, pillX, pillTop, pw, pillH, pillR);
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fill();
    rrect(ctx, pillX, pillTop, pw, pillH, pillR);
    ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(label, pillX + pillPX, pillTop + Math.round(pillH * 0.64));
    pillX += pw + pillGap;
  }

  // ── Lime separator between stats and workout section ─────────────────────────
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, 328);
  ctx.lineTo(W - PAD, 328);
  ctx.stroke();
  ctx.restore();

  // ── Workout type title ───────────────────────────────────────────────────────
  ctx.font = bc(42, "bold");
  ctx.fillStyle = accent;
  ctx.fillText(getWorkoutTypeLabel(workout.workout_type).toUpperCase(), PAD, 388);

  // ── Exercise list ────────────────────────────────────────────────────────────
  const exStartY = 432;
  const exEndY = 848;
  const maxShow = 8;
  const shown = workout.exercises.slice(0, maxShow);
  const overflow = workout.exercises.length - maxShow;
  const totalRows = shown.length + (overflow > 0 ? 1 : 0);
  const ROW_H = Math.min(68, Math.max(46, Math.floor((exEndY - exStartY) / Math.max(totalRows, 1))));

  for (let i = 0; i < shown.length; i++) {
    const ex = shown[i];
    const ey = exStartY + i * ROW_H;

    if (i > 0) {
      hline(ctx, PAD, ey, W - PAD, "#222222");
    }

    // Exercise name — Barlow Condensed bold 32px white
    ctx.font = bc(32, "bold");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(ex.name, PAD, ey + Math.round(ROW_H * 0.44));

    // Sets × reps — Inter bold 26px lime
    const sets = ex.sets ?? 3;
    const reps = ex.reps ?? 12;
    const restSec = (ex as any).rest_sec ?? (ex as any).rest_seconds ?? null;
    const setsReps = `${sets} × ${reps}`;

    ctx.font = inter(26, 700);
    ctx.fillStyle = accent;
    ctx.fillText(setsReps, PAD, ey + Math.round(ROW_H * 0.82));

    if (restSec) {
      const srW = ctx.measureText(setsReps).width;
      ctx.font = inter(22);
      ctx.fillStyle = "#666666";
      ctx.fillText(` · ${restSec}s descanso`, PAD + srW, ey + Math.round(ROW_H * 0.82));
    }
  }

  // Overflow row
  if (overflow > 0) {
    const ey = exStartY + shown.length * ROW_H;
    if (shown.length > 0) hline(ctx, PAD, ey, W - PAD, "#222222");
    ctx.font = inter(22);
    ctx.fillStyle = "#555555";
    ctx.fillText(`y ${overflow} ejercicio${overflow > 1 ? "s" : ""} más...`, PAD, ey + Math.round(ROW_H * 0.6));
  }

  // ── Bottom section ───────────────────────────────────────────────────────────
  const bottomY = photoRegY + photoRegH; // 872

  // Full-width #222222 separator
  ctx.save();
  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, bottomY);
  ctx.lineTo(W, bottomY);
  ctx.stroke();
  ctx.restore();

  // Motivational phrase — Barlow Condensed bold 48px white
  ctx.font = bc(48, "bold");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(getMotivationalPhrase(streak), PAD, bottomY + 68);

  // Footer separator
  ctx.save();
  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, bottomY + 112);
  ctx.lineTo(W, bottomY + 112);
  ctx.stroke();
  ctx.restore();

  // Footer — three columns
  const footerY = bottomY + 158;

  // Left: GoalIQ logo
  ctx.font = bc(22, "bold italic");
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("Goal", PAD, footerY);
  const sgw = ctx.measureText("Goal").width;
  ctx.fillStyle = accent;
  ctx.fillText("IQ", PAD + sgw, footerY);

  // Center: goaliq.app
  ctx.font = inter(18);
  ctx.fillStyle = "#444444";
  ctx.textAlign = "center";
  ctx.fillText("goaliq.app", W / 2, footerY);

  // Right: Únete gratis →
  ctx.font = inter(18, 600);
  ctx.fillStyle = accent;
  ctx.textAlign = "right";
  ctx.fillText("Únete gratis →", W - PAD, footerY);

  // Tagline at very bottom
  ctx.font = inter(20);
  ctx.fillStyle = "#444444";
  ctx.textAlign = "center";
  ctx.fillText("Entrena más inteligente. Alcanza tus objetivos.", W / 2, bottomY + 204);

  ctx.textAlign = "left";
}

// ─── Photo preview positioning helpers ────────────────────────────────────────

function computeImageStyle(
  img: HTMLImageElement | null,
  normX: number,
  normY: number,
): React.CSSProperties {
  if (!img || img.naturalWidth === 0) return { display: "none" };
  const imgA = img.naturalWidth / img.naturalHeight;
  const boxA = PREVIEW_W / PREVIEW_H;
  let drawW: number, drawH: number;
  if (imgA > boxA) { drawH = PREVIEW_H; drawW = PREVIEW_H * imgA; }
  else { drawW = PREVIEW_W; drawH = PREVIEW_W / imgA; }
  const maxOX = Math.max((drawW - PREVIEW_W) / 2, 0);
  const maxOY = Math.max((drawH - PREVIEW_H) / 2, 0);
  const left = (PREVIEW_W - drawW) / 2 - normX * maxOX;
  const top = (PREVIEW_H - drawH) / 2 - normY * maxOY;
  return { position: "absolute", width: drawW, height: drawH, left, top, userSelect: "none", pointerEvents: "none" };
}

function computeMaxOffset(img: HTMLImageElement | null): { x: number; y: number } {
  if (!img || img.naturalWidth === 0) return { x: 1, y: 1 };
  const imgA = img.naturalWidth / img.naturalHeight;
  const boxA = PREVIEW_W / PREVIEW_H;
  let drawW: number, drawH: number;
  if (imgA > boxA) { drawH = PREVIEW_H; drawW = PREVIEW_H * imgA; }
  else { drawW = PREVIEW_W; drawH = PREVIEW_W / imgA; }
  return { x: Math.max((drawW - PREVIEW_W) / 2, 1), y: Math.max((drawH - PREVIEW_H) / 2, 1) };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ShareWorkoutButton({ workout }: { workout: WorkoutData }) {
  const [modalStep, setModalStep] = useState<"closed" | "upload" | "preview">("closed");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [photoNorm, setPhotoNorm] = useState({ x: 0, y: 0 });

  const dragRef = useRef<{ sx: number; sy: number; nx: number; ny: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stats } = useProgressStats();
  const { data: profile } = useProfile();

  const userName = (profile?.full_name ?? "").trim() || "Usuario";
  const streak = stats?.streak ?? 0;

  // ── File handling ──────────────────────────────────────────────────────────

  function handleFileSelect(file: File) {
    if (!file || file.size > 10 * 1024 * 1024) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPhotoPreviewUrl(dataUrl);
      setPhotoNorm({ x: 0, y: 0 });
      const img = new window.Image();
      img.onload = () => setLoadedImage(img);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  // ── Drag-to-reposition ────────────────────────────────────────────────────

  const startDrag = useCallback((clientX: number, clientY: number) => {
    if (!loadedImage) return;
    setIsDragging(true);
    dragRef.current = { sx: clientX, sy: clientY, nx: photoNorm.x, ny: photoNorm.y };
  }, [loadedImage, photoNorm]);

  const moveDrag = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !dragRef.current || !loadedImage) return;
    const max = computeMaxOffset(loadedImage);
    const dx = clientX - dragRef.current.sx;
    const dy = clientY - dragRef.current.sy;
    setPhotoNorm({
      x: clamp(dragRef.current.nx - dx / max.x, -1, 1),
      y: clamp(dragRef.current.ny - dy / max.y, -1, 1),
    });
  }, [isDragging, loadedImage]);

  const endDrag = useCallback(() => {
    setIsDragging(false);
    dragRef.current = null;
  }, []);

  // ── Card generation ───────────────────────────────────────────────────────

  async function buildCard(photo: HTMLImageElement | null) {
    await ensureGoogleFonts();
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    generateWorkoutCard(canvas, workout, userName, streak, photo, photoNorm.x, photoNorm.y);
    setCardDataUrl(canvas.toDataURL("image/png"));
    setModalStep("preview");
  }

  function handleClose() {
    setModalStep("closed");
    setPhotoPreviewUrl(null);
    setLoadedImage(null);
    setCardDataUrl(null);
    setPhotoNorm({ x: 0, y: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDownload() {
    if (!cardDataUrl) return;
    const a = document.createElement("a");
    a.href = cardDataUrl;
    a.download = "goaliq-mi-entrenamiento.png";
    a.click();
  }

  const imageStyle = computeImageStyle(loadedImage, photoNorm.x, photoNorm.y);

  return (
    <>
      <button
        onClick={() => setModalStep("upload")}
        className="w-full flex items-center justify-center gap-2 border border-[#AAFF45]/40 hover:border-[#AAFF45] text-[#AAFF45] hover:bg-[#AAFF45]/5 font-semibold text-sm px-5 py-3.5 rounded-xl transition-all"
      >
        <span>📤</span> Compartir entrenamiento
      </button>

      {/* ── Upload modal ──────────────────────────────────────────────────── */}
      {modalStep === "upload" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.88)" }}
          onClick={handleClose}
        >
          <div
            className="rounded-2xl border border-[#2A2A2A] p-6 w-full"
            style={{ backgroundColor: "var(--giq-bg-card)", maxWidth: PREVIEW_W + 40 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-white text-base">Añade una foto de tu sesión</h3>
              <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2A2A2A] hover:bg-[#3A3A3A] transition-colors">
                <X className="w-4 h-4 text-[#A0A0A0]" />
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: "var(--giq-text-secondary)" }}>
              Opcional — hace tu tarjeta única
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleInputChange}
            />

            {photoPreviewUrl && loadedImage ? (
              /* ── Drag-to-reposition preview ────────────────────────────── */
              <div className="mb-4">
                <div
                  className="relative overflow-hidden rounded-xl select-none"
                  style={{
                    width: PREVIEW_W,
                    height: PREVIEW_H,
                    cursor: isDragging ? "grabbing" : "grab",
                    border: "1px solid var(--giq-accent)",
                    touchAction: "none",
                  }}
                  onMouseDown={e => startDrag(e.clientX, e.clientY)}
                  onMouseMove={e => moveDrag(e.clientX, e.clientY)}
                  onMouseUp={endDrag}
                  onMouseLeave={endDrag}
                  onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchMove={e => { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); }}
                  onTouchEnd={endDrag}
                >
                  <img src={photoPreviewUrl} alt="preview" style={imageStyle} draggable={false} />

                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-black/30 pointer-events-none" />

                  {/* Corner crop handles */}
                  {(["tl", "tr", "bl", "br"] as const).map(c => (
                    <div
                      key={c}
                      className="absolute w-5 h-5 pointer-events-none"
                      style={{
                        top: c[0] === "t" ? 8 : undefined,
                        bottom: c[0] === "b" ? 8 : undefined,
                        left: c[1] === "l" ? 8 : undefined,
                        right: c[1] === "r" ? 8 : undefined,
                        borderTop: c[0] === "t" ? "2px solid var(--giq-accent)" : undefined,
                        borderBottom: c[0] === "b" ? "2px solid var(--giq-accent)" : undefined,
                        borderLeft: c[1] === "l" ? "2px solid var(--giq-accent)" : undefined,
                        borderRight: c[1] === "r" ? "2px solid var(--giq-accent)" : undefined,
                      }}
                    />
                  ))}

                  <p className="absolute bottom-2 left-0 right-0 text-center text-xs pointer-events-none" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Arrastra para ajustar la imagen
                  </p>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-xs text-center w-full transition-colors hover:text-[#A0A0A0]"
                  style={{ color: "var(--giq-text-muted)" }}
                >
                  Cambiar foto
                </button>
              </div>
            ) : (
              /* ── Upload area ─────────────────────────────────────────────── */
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className="cursor-pointer rounded-xl mb-4 flex flex-col items-center justify-center gap-2 transition-all"
                style={{
                  height: 120,
                  border: `2px dashed ${isDragOver ? "var(--giq-accent)" : "var(--giq-border)"}`,
                  borderRadius: 12,
                }}
              >
                <span className="text-2xl">📸</span>
                <span className="text-sm font-medium" style={{ color: "var(--giq-text-secondary)" }}>Toca para subir una foto</span>
                <span className="text-xs" style={{ color: "var(--giq-text-muted)" }}>JPG, PNG, WEBP · Máx 10MB</span>
              </div>
            )}

            {/* Continue with photo */}
            <button
              onClick={() => buildCard(loadedImage)}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{ backgroundColor: "var(--giq-accent)", color: "var(--giq-accent-text)" }}
            >
              Continuar →
            </button>

            {/* Skip */}
            <button
              onClick={() => buildCard(null)}
              className="w-full mt-2 py-2 text-sm text-center transition-colors hover:text-[#A0A0A0]"
              style={{ color: "var(--giq-text-muted)" }}
            >
              Continuar sin foto
            </button>
          </div>
        </div>
      )}

      {/* ── Preview modal ─────────────────────────────────────────────────── */}
      {modalStep === "preview" && cardDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.88)" }}
          onClick={handleClose}
        >
          <div
            className="bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] p-5 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalStep("upload")}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2A2A2A] hover:bg-[#3A3A3A] transition-colors text-[#A0A0A0] text-xs font-bold"
                >←</button>
                <h3 className="font-bold text-white text-base">Tu tarjeta de entrenamiento</h3>
              </div>
              <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2A2A2A] hover:bg-[#3A3A3A] transition-colors">
                <X className="w-4 h-4 text-[#A0A0A0]" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden mb-4 border border-[#2A2A2A]">
              <img src={cardDataUrl} alt="Tarjeta de entrenamiento" className="w-full block" />
            </div>

            <p className="text-xs text-[#555555] text-center mb-4">
              Comparte en Instagram, WhatsApp o donde quieras 🚀
            </p>

            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 bg-[#AAFF45] hover:bg-[#99EE34] text-[#0A0A0A] font-bold text-sm py-3 rounded-lg transition-all mb-2"
            >
              <Download className="w-4 h-4" /> Descargar imagen
            </button>
            <button
              onClick={handleClose}
              className="w-full text-[#A0A0A0] hover:text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
