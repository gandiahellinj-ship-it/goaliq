# Cinematic components

## `FrameSequenceCanvas`

Single-canvas frame animation driven by a paused GSAP tween. Used for the
landing cinematic scenes (Mejora 11). Click-triggered or auto-playing.

### Why canvas + GSAP tween (vs. `<img>` rotation or CSS bg-image)

- One DOM node instead of N hidden images
- `drawImage()` is a composite-only operation — no layout/paint cascade
- GSAP already drives requestAnimationFrame and provides easing
- We animate a single object property (the frame index) — minimal per-frame work
- `useGSAP` (from `@gsap/react`) cleans up tweens on unmount automatically

### Skills applied

- **gsap-react** — `useGSAP` hook with `scope` ref, `contextSafe` wrapper for the click handler
- **gsap-performance** — single tween + `onUpdate`, `will-change: transform` on the animating container, GPU-friendly canvas
- **gsap-core** — `power2.inOut` ease for the cinematic in-out feel

### Usage

```tsx
import { FrameSequenceCanvas } from "@/components/cinematic/FrameSequenceCanvas";

<FrameSequenceCanvas
  framePath="/frames/world-map-entry/"
  frameCount={76}
  aspectRatio={1.795}
  trigger="click"
  duration={3}
  onComplete={() => console.log("done")}
>
  <button className="...glassmorphism">Entrar</button>
</FrameSequenceCanvas>
```

### Props

| Prop                 | Type                     | Default          | Notes                                    |
|----------------------|--------------------------|------------------|------------------------------------------|
| `framePath`          | `string`                 | required         | Public path with trailing slash          |
| `frameCount`         | `number`                 | required         | Total frames (1-based naming)            |
| `framePrefix`        | `string`                 | `"frame_"`       | Filename prefix before the index         |
| `frameExt`           | `string`                 | `".webp"`        | Filename extension including the dot     |
| `aspectRatio`        | `number`                 | `1.795`          | Width / height, preserved on resize      |
| `trigger`            | `"click" \| "auto"`      | `"click"`        | `"auto"` starts on ready                 |
| `duration`           | `number`                 | `3`              | Seconds                                  |
| `ease`               | `string`                 | `"power2.inOut"` | Any valid GSAP ease string               |
| `autoTriggerDebug`   | `boolean`                | `false`          | Dev-only: skip CTA, play on ready        |
| `onComplete`         | `() => void`             | —                | Fires after the final frame is drawn     |
| `onProgress`         | `(loaded, total) => void`| —                | Fires on every preload progress update   |
| `children`           | `ReactNode`              | —                | Overlay shown during `ready` phase       |
| `className`          | `string`                 | `""`             | Extra Tailwind classes on the container  |

### Lifecycle / phases

The component is a small state machine with four phases:

```
loading  →  ready  →  playing  →  done
```

- **loading**: preloading frames at concurrency 6, progress bar overlay visible
- **ready**: all frames decoded, first frame drawn, CTA (`children`) visible
- **playing**: tween active, `onUpdate` drives `drawImage` each frame
- **done**: last frame drawn, `onComplete` fired

### Naming convention assumed by the preloader

Files at `framePath` must follow `{framePrefix}{NNN}{frameExt}`, with `NNN`
being a 1-based zero-padded 3-digit index:

```
frame_001.webp
frame_002.webp
...
frame_076.webp
```

If you generate your frames differently, override `framePrefix` and `frameExt`
to match.
