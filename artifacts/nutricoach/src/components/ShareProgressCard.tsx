import { useState, useRef } from "react";
import { useProfile, useProgressStats, useFlexDays } from "@/lib/supabase-queries";
import { X, Download, Share2, Image } from "lucide-react";
import { getThemeAccent, getThemeAccentText } from "@/lib/theme";
import { useT } from "@/lib/language";

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { mon, sun };
}

function formatDateRange(mon: Date, sun: Date) {
  const dayMon = mon.getDate();
  const daySun = sun.getDate();
  const monthSun = sun.toLocaleDateString("es-ES", { month: "long" });
  const year = sun.getFullYear();
  if (mon.getMonth() === sun.getMonth()) {
    return `Semana del ${dayMon} — ${daySun} de ${monthSun}, ${year}`;
  }
  const monthMon = mon.toLocaleDateString("es-ES", { month: "long" });
  return `Semana del ${dayMon} de ${monthMon} — ${daySun} de ${monthSun}, ${year}`;
}

function getMotivationalPhrase(streak: number, adherence: number): string {
  if (streak >= 7 && adherence >= 80) return "🔥 Consistencia de élite. Imparable.";
  if (streak >= 3 || adherence >= 60) return "💪 Progresando cada día. Sigue así.";
  return "⚡ Cada semana es una nueva oportunidad.";
}

function getWeekOfMonth(mon: Date): number {
  return Math.ceil(mon.getDate() / 7);
}

function getTotalWeeksInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.ceil(daysInMonth / 7);
}

function rrect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
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

function generateCard(
  canvas: HTMLCanvasElement,
  name: string,
  streak: number,
  workoutsCompleted: number,
  totalWorkouts: number,
  adherence: number,
  flexDaysThisWeek: number,
  dateRange: string,
  weekOfMonth: number,
  totalWeeksInMonth: number,
  bgPhoto: HTMLImageElement | null
) {
  const ctx = canvas.getContext("2d")!;
  const W = 1080;
  const H = 1080;
  const PAD = 64;
  const INNER_W = W - PAD * 2;
  const accent = getThemeAccent();
  const accentText = getThemeAccentText();

  // ── Background ───────────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#0A0A0A");
  bgGrad.addColorStop(1, "#0A0A0A");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const glow1 = ctx.createRadialGradient(W, 0, 0, W, 0, 400);
  glow1.addColorStop(0, hexToRgba(accent, 0.08));
  glow1.addColorStop(1, hexToRgba(accent, 0));
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(0, H, 0, 0, H, 200);
  glow2.addColorStop(0, hexToRgba(accent, 0.04));
  glow2.addColorStop(1, hexToRgba(accent, 0));
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // ── Logo top-left ────────────────────────────────────────────────────────────
  const logoY = 80;
  ctx.font = "bold italic 56px Arial, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("Goal", PAD, logoY);
  const goalW = ctx.measureText("Goal").width;
  ctx.fillStyle = accent;
  ctx.fillText("IQ", PAD + goalW, logoY);

  // ── Pill badge top-right ─────────────────────────────────────────────────────
  ctx.font = "bold 18px Arial, sans-serif";
  const badgeText = "MI PROGRESO";
  const badgeTW = ctx.measureText(badgeText).width;
  const bPadX = 20;
  const bH = 36;
  const bW = badgeTW + bPadX * 2;
  const bX = W - PAD - bW;
  const bY = logoY - bH + 4;
  rrect(ctx, bX, bY, bW, bH, bH / 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.fillStyle = accentText;
  ctx.textAlign = "center";
  ctx.fillText(badgeText, bX + bW / 2, bY + 24);
  ctx.textAlign = "left";

  // ── Logo separator ───────────────────────────────────────────────────────────
  hline(ctx, PAD, 104, W - PAD, "#1E1E1E");

  // ── Date label ───────────────────────────────────────────────────────────────
  ctx.font = "22px Arial, sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText(dateRange, PAD, 144);

  // ── User full name ────────────────────────────────────────────────────────────
  const maxNameW = INNER_W - 20;
  let nameFontSize = 64;
  ctx.font = `bold ${nameFontSize}px Arial, sans-serif`;
  while (ctx.measureText(name).width > maxNameW && nameFontSize > 36) {
    nameFontSize -= 2;
    ctx.font = `bold ${nameFontSize}px Arial, sans-serif`;
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(name, PAD, 222);

  // ── Name separator ────────────────────────────────────────────────────────────
  hline(ctx, PAD, 248, W - PAD, "#1E1E1E");

  // ── Stat cards region ────────────────────────────────────────────────────────
  const cardW = 296;
  const cardH = 310;
  const cardY = 274;
  const gap = 30;
  const totalCardsW = 3 * cardW + 2 * gap;
  const cardStartX = (W - totalCardsW) / 2;

  // Photo region: spans the full card section + small padding
  const photoRegionY = 248;
  const photoRegionH = cardH + (cardY - 248) + 30; // 248 to cardY+cardH+6

  if (bgPhoto) {
    // Cover-fit photo into the photo region
    const regionW = W;
    const regionH = photoRegionH;
    const imgAspect = bgPhoto.naturalWidth / bgPhoto.naturalHeight;
    const regionAspect = regionW / regionH;

    let drawW: number, drawH: number, drawX: number, drawY: number;
    if (imgAspect > regionAspect) {
      drawH = regionH;
      drawW = regionH * imgAspect;
      drawX = (regionW - drawW) / 2;
      drawY = photoRegionY;
    } else {
      drawW = regionW;
      drawH = regionW / imgAspect;
      drawX = 0;
      drawY = photoRegionY + (regionH - drawH) / 2;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, photoRegionY, W, photoRegionH);
    ctx.clip();
    ctx.drawImage(bgPhoto, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Dark overlay for readability
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, photoRegionY, W, photoRegionH);

    // Vignette: radial gradient darkening the edges
    const vigCx = W / 2;
    const vigCy = photoRegionY + photoRegionH / 2;
    const vigR = Math.max(W, photoRegionH) * 0.75;
    const vig = ctx.createRadialGradient(vigCx, vigCy, vigR * 0.3, vigCx, vigCy, vigR);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, photoRegionY, W, photoRegionH);
  }

  // Helper for card bg depending on whether photo is used
  const cardBg = bgPhoto ? "rgba(0,0,0,0.5)" : "#141414";
  const cardBorder = bgPhoto ? "rgba(255,255,255,0.1)" : "#222222";

  function drawCardBg(cx: number) {
    rrect(ctx, cx, cardY, cardW, cardH, 16);
    ctx.fillStyle = cardBg;
    ctx.fill();
    rrect(ctx, cx, cardY, cardW, cardH, 16);
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── Card 1: Racha ─────────────────────────────────────────────────────────────
  const c1x = cardStartX;
  drawCardBg(c1x);

  ctx.font = "40px Arial, sans-serif";
  ctx.fillText("🔥", c1x + 24, cardY + 54);
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText("RACHA", c1x + 24, cardY + 82);
  ctx.font = "bold 78px Arial, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(String(streak), c1x + 24, cardY + 180);
  ctx.font = "18px Arial, sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText("días seguidos", c1x + 24, cardY + 210);

  {
    const totalSlots = 7;
    const barW = Math.floor((cardW - 48 - (totalSlots - 1) * 6) / totalSlots);
    let bx = c1x + 24;
    const by = cardY + 265;
    for (let b = 0; b < totalSlots; b++) {
      const filled = b < Math.min(streak, totalSlots);
      const intensity = filled ? (b + 1) / Math.min(streak, totalSlots) : 0;
      const alpha = filled ? 0.25 + intensity * 0.75 : 0.06;
      rrect(ctx, bx, by, barW, 10, 4);
      ctx.fillStyle = hexToRgba(accent, parseFloat(alpha.toFixed(2)));
      ctx.fill();
      bx += barW + 6;
    }
  }

  // ── Card 2: Entrenamientos ────────────────────────────────────────────────────
  const c2x = cardStartX + cardW + gap;
  drawCardBg(c2x);

  ctx.font = "40px Arial, sans-serif";
  ctx.fillText("💪", c2x + 24, cardY + 54);
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText("ENTRENAMIENTOS", c2x + 24, cardY + 82);
  ctx.font = "bold 78px Arial, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText(String(workoutsCompleted), c2x + 24, cardY + 180);
  ctx.font = "18px Arial, sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText("esta semana", c2x + 24, cardY + 210);

  {
    const dotR = 7;
    const dotGap = Math.floor((cardW - 48 - 14 * dotR) / 6);
    let dx = c2x + 24;
    const dy = cardY + 268;
    for (let d = 0; d < 7; d++) {
      ctx.beginPath();
      ctx.arc(dx + dotR, dy + dotR, dotR, 0, Math.PI * 2);
      if (d < workoutsCompleted) {
        ctx.fillStyle = accent;
        ctx.fill();
      } else if (d < totalWorkouts) {
        ctx.fillStyle = "#222222";
        ctx.fill();
        ctx.strokeStyle = "#2A2A2A"; ctx.lineWidth = 1; ctx.stroke();
      } else {
        ctx.fillStyle = "#141414";
        ctx.fill();
        ctx.strokeStyle = "#1E1E1E"; ctx.lineWidth = 1; ctx.stroke();
      }
      dx += dotR * 2 + dotGap;
    }
  }

  // ── Card 3: Adherencia ────────────────────────────────────────────────────────
  const c3x = cardStartX + (cardW + gap) * 2;
  drawCardBg(c3x);

  ctx.font = "40px Arial, sans-serif";
  ctx.fillText("📊", c3x + 24, cardY + 54);
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText("ADHERENCIA", c3x + 24, cardY + 82);
  ctx.font = "bold 78px Arial, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`${adherence}%`, c3x + 24, cardY + 180);
  ctx.font = "18px Arial, sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText("plan seguido", c3x + 24, cardY + 210);

  {
    const arcCx = c3x + 24 + (cardW - 48) / 2;
    const arcCy = cardY + 265;
    const arcR = 28;
    const strokeW = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(arcCx, arcCy, arcR, Math.PI, 0, true);
    ctx.strokeStyle = "#222222";
    ctx.lineWidth = strokeW;
    ctx.stroke();
    if (adherence > 0) {
      const fillEnd = Math.PI - (adherence / 100) * Math.PI;
      ctx.beginPath();
      ctx.arc(arcCx, arcCy, arcR, Math.PI, fillEnd, true);
      ctx.strokeStyle = accent;
      ctx.lineWidth = strokeW;
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  // ── Separator after cards ─────────────────────────────────────────────────────
  const sep1Y = cardY + cardH + 24;
  hline(ctx, PAD, sep1Y, W - PAD, "#1E1E1E");

  // ── Flex Day status ───────────────────────────────────────────────────────────
  const flexY = sep1Y + 44;
  ctx.textAlign = "center";
  ctx.font = "bold 22px Arial, sans-serif";
  if (flexDaysThisWeek === 0) {
    ctx.fillStyle = accent;
    ctx.fillText("⚡ SEMANA PERFECTA · SIN FLEX DAYS", W / 2, flexY);
  } else {
    ctx.fillStyle = "#555555";
    ctx.fillText(
      `⚡ ${flexDaysThisWeek} FLEX DAY${flexDaysThisWeek > 1 ? "S" : ""} USADO${flexDaysThisWeek > 1 ? "S" : ""}`,
      W / 2,
      flexY
    );
  }
  ctx.textAlign = "left";

  // ── Motivational phrase with lime left accent bar ─────────────────────────────
  const phraseY = flexY + 48;
  ctx.fillStyle = accent;
  ctx.fillRect(PAD, phraseY - 28, 4, 48);
  const phrase = getMotivationalPhrase(streak, adherence);
  ctx.font = "bold 30px Arial, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(phrase, PAD + 22, phraseY);

  // ── Monthly progress section ──────────────────────────────────────────────────
  const monthSepY = phraseY + 52;
  hline(ctx, PAD, monthSepY, W - PAD, "#1E1E1E");

  const monthLabelY = monthSepY + 40;
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillStyle = "#555555";
  ctx.letterSpacing = "2px";
  ctx.fillText("PROGRESO DEL MES", PAD, monthLabelY);
  ctx.letterSpacing = "0px";

  const barY = monthLabelY + 22;
  const barH = 12;
  const barR = 6;
  const fillPct = Math.min(weekOfMonth / totalWeeksInMonth, 1);

  rrect(ctx, PAD, barY, INNER_W, barH, barR);
  ctx.fillStyle = "#1A1A1A";
  ctx.fill();

  if (fillPct > 0) {
    const fillW = Math.max(INNER_W * fillPct, barH);
    const fillGrad = ctx.createLinearGradient(PAD, 0, PAD + fillW, 0);
    fillGrad.addColorStop(0, accent);
    fillGrad.addColorStop(1, accent);
    rrect(ctx, PAD, barY, fillW, barH, barR);
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }

  const barLabelY = barY + barH + 26;
  ctx.font = "20px Arial, sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText(`Semana ${weekOfMonth} de ${totalWeeksInMonth}`, PAD, barLabelY);

  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillStyle = accent;
  ctx.textAlign = "right";
  ctx.fillText(`${Math.round(fillPct * 100)}%`, W - PAD, barLabelY);
  ctx.textAlign = "left";

  // ── Footer divider ────────────────────────────────────────────────────────────
  hline(ctx, PAD, H - 116, W - PAD, "#1E1E1E");

  // ── Footer ────────────────────────────────────────────────────────────────────
  const footerY = H - 116 + 44;

  ctx.font = "bold italic 20px Arial, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("Goal", PAD, footerY);
  const smallGoalW = ctx.measureText("Goal").width;
  ctx.fillStyle = accent;
  ctx.fillText("IQ", PAD + smallGoalW, footerY);

  ctx.font = "18px Arial, sans-serif";
  ctx.fillStyle = "#333333";
  ctx.textAlign = "center";
  ctx.fillText("goaliq.app", W / 2, footerY);

  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillStyle = accent;
  ctx.textAlign = "right";
  ctx.fillText("Únete gratis →", W - PAD, footerY);

  ctx.font = "16px Arial, sans-serif";
  ctx.fillStyle = "#2A2A2A";
  ctx.textAlign = "center";
  ctx.fillText("Entrena más inteligente. Alcanza tus objetivos.", W / 2, H - 28);

  ctx.textAlign = "left";
}

export function ShareProgressButton({ variant = "default" }: { variant?: "default" | "compact" | "outlined" }) {
  const [modalStep, setModalStep] = useState<"closed" | "upload" | "preview">("closed");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = useT();
  const { data: stats } = useProgressStats();
  const { data: profile } = useProfile();

  const now = new Date();
  const { data: flexDays } = useFlexDays(now.getFullYear(), now.getMonth() + 1);

  const { mon, sun } = getWeekRange();
  const monStr = mon.toISOString().split("T")[0];
  const sunStr = sun.toISOString().split("T")[0];
  const flexDaysThisWeek = (flexDays ?? []).filter((d) => d >= monStr && d <= sunStr).length;

  function buildCard(photo: HTMLImageElement | null) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;

    const displayName = (profile?.full_name ?? "").trim() || "Usuario";
    const streak = stats?.streak ?? 0;
    const workoutsCompleted = stats?.completedWorkoutsThisWeek ?? 0;
    const totalWorkouts = stats?.totalWorkoutsThisWeek ?? 0;
    const adherence = stats?.weeklyAdherencePercent ?? 0;
    const dateRange = formatDateRange(mon, sun);
    const weekOfMonth = getWeekOfMonth(mon);
    const totalWeeksInMonth = getTotalWeeksInMonth(mon.getFullYear(), mon.getMonth() + 1);

    generateCard(
      canvas, displayName, streak, workoutsCompleted, totalWorkouts,
      adherence, flexDaysThisWeek, dateRange, weekOfMonth, totalWeeksInMonth,
      photo
    );

    setCardDataUrl(canvas.toDataURL("image/png"));
    setModalStep("preview");
  }

  function handleFileSelect(file: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB max
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPhotoPreviewUrl(dataUrl);

      const img = new window.Image();
      img.onload = () => setSelectedImage(img);
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

  function handleClose() {
    setModalStep("closed");
    setPhotoPreviewUrl(null);
    setSelectedImage(null);
    setCardDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDownload() {
    if (!cardDataUrl) return;
    const a = document.createElement("a");
    a.href = cardDataUrl;
    a.download = "goaliq-mi-progreso.png";
    a.click();
  }

  return (
    <>
      <button
        onClick={() => setModalStep("upload")}
        className={
          variant === "compact"
            ? "flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#AAFF45]/40 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-all"
            : variant === "outlined"
            ? "w-full flex items-center justify-center gap-2 border border-[#AAFF45] text-[#AAFF45] hover:bg-[#AAFF45]/10 font-semibold text-sm px-5 py-3 rounded-xl transition-all"
            : "w-full flex items-center justify-center gap-2 bg-[#AAFF45] hover:bg-[#99EE34] text-[#0A0A0A] font-bold text-sm px-5 py-3.5 rounded-lg transition-all hover:-translate-y-0.5 shadow-md"
        }
      >
        <Share2 className="w-4 h-4" />
        {t("share_progress")}
      </button>

      {/* ── Upload step modal ─────────────────────────────────────────────── */}
      {modalStep === "upload" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.88)" }}
          onClick={handleClose}
        >
          <div
            className="rounded-2xl border border-[#2A2A2A] p-6 max-w-sm w-full"
            style={{ backgroundColor: "var(--giq-bg-card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-white text-base">Añade una foto de tu sesión</h3>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2A2A2A] hover:bg-[#3A3A3A] transition-colors"
              >
                <X className="w-4 h-4 text-[#A0A0A0]" />
              </button>
            </div>
            <p className="text-sm mb-5" style={{ color: "var(--giq-text-secondary)" }}>Haz tu tarjeta única</p>

            {/* Upload area */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleInputChange}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className="relative rounded-xl cursor-pointer overflow-hidden transition-all"
              style={{
                height: 120,
                border: `2px dashed ${isDragOver || photoPreviewUrl ? "var(--giq-accent)" : "var(--giq-border)"}`,
                borderRadius: 12,
              }}
            >
              {photoPreviewUrl ? (
                /* Thumbnail preview */
                <>
                  <img
                    src={photoPreviewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold bg-black/60 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5" /> Cambiar foto
                    </span>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-1.5">
                  <span className="text-2xl">📸</span>
                  <span className="text-sm font-medium text-[#A0A0A0]">Toca para subir una foto</span>
                  <span className="text-xs text-[#444444]">JPG, PNG, WEBP · Máx 10MB</span>
                </div>
              )}
            </div>

            {/* Continue button */}
            <button
              onClick={() => buildCard(selectedImage)}
              className="w-full mt-4 py-3 rounded-xl font-bold text-sm transition-all"
              style={{
                backgroundColor: selectedImage ? "var(--giq-accent)" : "var(--giq-bg-card)",
                color: selectedImage ? "var(--giq-accent-text)" : "var(--giq-text-secondary)",
                border: selectedImage ? "none" : `1px solid var(--giq-border)`,
              }}
            >
              {selectedImage ? "Continuar con esta foto →" : "Continuar"}
            </button>

            {/* Skip link */}
            <button
              onClick={() => buildCard(null)}
              className="w-full mt-2 py-2 text-sm text-center transition-colors hover:text-[#A0A0A0]"
              style={{ color: "var(--giq-text-muted)" }}
            >
              Continuar sin foto →
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
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalStep("upload")}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2A2A2A] hover:bg-[#3A3A3A] transition-colors text-[#A0A0A0] text-xs font-bold"
                >
                  ←
                </button>
                <h3 className="font-bold text-white text-base">Tu tarjeta de progreso</h3>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2A2A2A] hover:bg-[#3A3A3A] transition-colors"
              >
                <X className="w-4 h-4 text-[#A0A0A0]" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden mb-4 border border-[#2A2A2A]">
              <img src={cardDataUrl} alt="Tarjeta de progreso" className="w-full block" />
            </div>

            <p className="text-xs text-[#555555] text-center mb-4">
              Comparte tu progreso en Instagram, WhatsApp o donde quieras 🚀
            </p>

            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 bg-[#AAFF45] hover:bg-[#99EE34] text-[#0A0A0A] font-bold text-sm py-3 rounded-lg transition-all mb-2"
            >
              <Download className="w-4 h-4" />
              Descargar imagen
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
