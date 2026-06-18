import { useRef, useState, useEffect, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

// [gsap-react skill] Register useGSAP plugin once at module level. The hook
// pattern is the recommended way to integrate GSAP in React; cleanup of all
// tweens created inside the scope is automatic on unmount.
gsap.registerPlugin(useGSAP);

const CONCURRENCY = 6;

export interface FrameSequenceCanvasProps {
  /** Public path with trailing slash, e.g. "/frames/world-map-entry/". */
  framePath: string;
  /** Total number of frames (1-based naming). */
  frameCount: number;
  /** Filename prefix before the zero-padded index. */
  framePrefix?: string;
  /** Filename extension including the dot. */
  frameExt?: string;
  /** Width / height ratio for the container; preserved across resizes. */
  aspectRatio?: number;
  /** Trigger mode. "click" waits for user, "auto" starts on ready. */
  trigger?: "click" | "auto";
  /** Animation length in seconds. */
  duration?: number;
  /** GSAP ease string. */
  ease?: string;
  /** Dev-only: skip the CTA and play as soon as preload completes. */
  autoTriggerDebug?: boolean;
  /** Fired after the last frame is drawn. */
  onComplete?: () => void;
  /** Fired on every preload progress update. */
  onProgress?: (loaded: number, total: number) => void;
  /** Overlay rendered on top of the canvas while phase === "ready". */
  children?: ReactNode;
  /** Extra Tailwind classes applied to the outer container. */
  className?: string;
}

type Phase = "loading" | "ready" | "playing" | "done";

/**
 * FrameSequenceCanvas — single-canvas frame animation driven by a GSAP tween.
 *
 * Why canvas (not <img> rotation or CSS background swap):
 *  - One DOM node instead of N hidden images
 *  - drawImage() is a composite-only op (no layout/paint cascade)
 *  - GPU-accelerated everywhere
 *
 * Why a GSAP tween over a manual rAF loop:
 *  - GSAP already drives rAF, batches updates, and handles easing
 *  - Drives a single object property (the frame index) — minimal overhead
 *  - useGSAP gives automatic cleanup on unmount (no leaks)
 *
 * See README.md for usage examples.
 */
export function FrameSequenceCanvas({
  framePath,
  frameCount,
  framePrefix = "frame_",
  frameExt = ".webp",
  aspectRatio = 1.795,
  trigger = "click",
  duration = 3,
  ease = "power2.inOut",
  autoTriggerDebug = false,
  onComplete,
  onProgress,
  children,
  className = "",
}: FrameSequenceCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const currentFrameRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState({ loaded: 0, total: frameCount });

  // ── Preload frames with a small concurrency cap ─────────────────────────────
  // Eager preload all frames before exposing the CTA. Concurrency cap=6 hits
  // the HTTP/2 sweet spot without saturating slow connections.
  useEffect(() => {
    let cancelled = false;
    const loaded: HTMLImageElement[] = new Array(frameCount);
    let nextIndex = 0;
    let loadedCount = 0;

    const formatIndex = (i: number) => String(i + 1).padStart(3, "0");
    const buildSrc = (i: number) =>
      `${framePath}${framePrefix}${formatIndex(i)}${frameExt}`;

    const loadOne = (i: number): Promise<void> =>
      new Promise((resolve) => {
        const tryLoad = (isRetry: boolean) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {
            loaded[i] = img;
            loadedCount += 1;
            if (!cancelled) {
              setProgress({ loaded: loadedCount, total: frameCount });
              onProgress?.(loadedCount, frameCount);
            }
            resolve();
          };
          img.onerror = () => {
            // Single retry; if that fails too, resolve so we never deadlock the
            // worker pool. A missing frame will simply not redraw at that index.
            if (!isRetry) tryLoad(true);
            else resolve();
          };
          img.src = buildSrc(i);
        };
        tryLoad(false);
      });

    const worker = async () => {
      while (!cancelled) {
        const myIndex = nextIndex++;
        if (myIndex >= frameCount) return;
        await loadOne(myIndex);
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    Promise.all(workers).then(() => {
      if (cancelled) return;
      imagesRef.current = loaded;
      drawFrame(0);
      setPhase("ready");
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framePath, frameCount, framePrefix, frameExt]);

  // ── Canvas DPR scaling + responsive sizing ──────────────────────────────────
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    drawFrame(currentFrameRef.current);
  };

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draw a specific frame onto the canvas ───────────────────────────────────
  const drawFrame = (index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const i = Math.max(0, Math.min(frameCount - 1, Math.floor(index)));
    const img = imagesRef.current[i];
    currentFrameRef.current = i;
    if (!img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  // ── GSAP setup (cleanup via useGSAP scope) ──────────────────────────────────
  // [gsap-react skill] useGSAP() runs the callback once on mount and reverts
  // any GSAP tweens created inside its scope on unmount. We declare an empty
  // setup body and use contextSafe (returned from the hook) to wrap the click
  // handler — that way tweens created on click are still part of the scope.
  // [gsap-performance skill] We only ever create ONE tween (on click) that
  // updates a single number; no per-frame DOM mutations besides the canvas
  // drawImage call.
  const { contextSafe } = useGSAP(() => {}, { scope: containerRef });

  const start = contextSafe?.(() => {
    if (phase !== "ready") return;
    const state = { frame: 0 };
    setPhase("playing");
    tweenRef.current = gsap.to(state, {
      frame: frameCount - 1,
      duration,
      ease,
      onUpdate: () => drawFrame(state.frame),
      onComplete: () => {
        drawFrame(frameCount - 1);
        setPhase("done");
        onComplete?.();
      },
    });
  });

  // ── Auto-trigger debug or "auto" mode ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "ready") return;
    if (autoTriggerDebug || trigger === "auto") {
      start?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoTriggerDebug, trigger]);

  const progressPct = Math.round((progress.loaded / progress.total) * 100);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={{
        aspectRatio: `${aspectRatio}`,
        // [gsap-performance skill] Hint the compositor only on the element
        // that actually moves. Canvas itself is already on the GPU layer; the
        // container hosts the potential overlay transitions.
        willChange: "transform",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      />

      {/* Loading overlay (phase: loading) — thin linear progress, cyan accent */}
      {phase === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <p className="text-xs text-cyan-200/70 tracking-wide mb-3">
            Cargando experiencia...
          </p>
          <div className="w-64 h-px bg-cyan-500/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-200 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-cyan-200/40 mt-2 tabular-nums">
            {progress.loaded} / {progress.total}
          </p>
        </div>
      )}

      {/* CTA overlay (phase: ready) — children consume the click area */}
      {phase === "ready" && children && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={start}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              start?.();
            }
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
