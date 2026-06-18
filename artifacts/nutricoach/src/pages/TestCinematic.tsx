import { useState } from "react";
import { FrameSequenceCanvas } from "@/components/cinematic/FrameSequenceCanvas";

/**
 * /test-cinematic — standalone sandbox for the World Map Entry scene.
 *
 * Does NOT touch the landing route. The route is registered separately in
 * App.tsx so the rest of the app is unaffected. Reset works by bumping a key
 * to force a fresh component instance (simpler than threading an imperative
 * reset handle through the component API).
 */
export default function TestCinematic() {
  const [resetKey, setResetKey] = useState(0);
  const [done, setDone] = useState(false);

  const handleComplete = () => {
    setDone(true);
  };

  const handleReset = () => {
    setDone(false);
    setResetKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 to-black flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between text-cyan-100/60">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]" />
          <span className="text-xs uppercase tracking-[0.2em]">
            Test · World Map Entry
          </span>
        </div>
        <span className="text-[10px] text-cyan-100/30">Mejora 11 · scene 1</span>
      </header>

      {/* Stage */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-screen-lg">
          <FrameSequenceCanvas
            key={resetKey}
            framePath="/frames/world-map-entry/"
            frameCount={76}
            aspectRatio={1080 / 602}
            trigger="click"
            duration={3}
            ease="power2.inOut"
            onComplete={handleComplete}
            className="rounded-xl border border-cyan-500/10 shadow-[0_0_60px_-20px_rgba(34,211,238,0.25)]"
          >
            <CinematicCTA />
          </FrameSequenceCanvas>

          {/* Done state */}
          {done && (
            <div className="mt-6 flex flex-col items-center gap-3 text-center">
              <p className="text-cyan-200 text-sm tracking-wide">
                ✓ Animation complete
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-cyan-100 bg-cyan-500/10 border border-cyan-400/30 hover:bg-cyan-500/20 transition-colors"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="w-full px-6 py-4 text-[10px] text-cyan-100/30 text-center">
        Click "Entrar" para iniciar la secuencia · 76 frames · 1080×602 ·
        WebP · ~2 MB
      </footer>
    </div>
  );
}

/**
 * Glassmorphism CTA — the "Entrar" button shown during the ready phase.
 * Click anywhere inside the canvas overlay (handled by the parent) triggers
 * the animation; the button itself is purely visual.
 */
function CinematicCTA() {
  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <p
        className="text-cyan-100 text-2xl sm:text-3xl font-light tracking-wide text-center"
        style={{ textShadow: "0 2px 30px rgba(34,211,238,0.35)" }}
      >
        Tu objetivo empieza aquí
      </p>
      <div
        className="px-8 py-3 rounded-full text-cyan-50 text-sm font-semibold tracking-[0.15em] uppercase backdrop-blur-md transition-transform hover:scale-105"
        style={{
          background:
            "linear-gradient(135deg, rgba(34,211,238,0.18), rgba(6,182,212,0.10))",
          border: "1px solid rgba(34,211,238,0.4)",
          boxShadow:
            "0 0 30px -5px rgba(34,211,238,0.45), inset 0 0 12px rgba(34,211,238,0.10)",
        }}
      >
        Entrar
      </div>
    </div>
  );
}
