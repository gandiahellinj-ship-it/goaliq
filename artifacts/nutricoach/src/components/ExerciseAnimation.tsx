// Pure SVG + SMIL animations — no external libraries

type AnimType = "squat" | "push" | "pull" | "hinge" | "core" | "cardio" | "default";

const S = "currentColor";
const W = "2.5";
const RC = "round" as const;

const BASE = {
  width: 80, height: 80, viewBox: "0 0 80 80",
  fill: "none", stroke: S, strokeWidth: W,
  strokeLinecap: RC, strokeLinejoin: RC,
  "aria-hidden": true,
  className: "text-[#AAFF45]",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function D(from: string, to: string, dur = "2s", delay = "0s") {
  return (
    <animate
      attributeName="d"
      values={`${from};${to};${from}`}
      dur={dur} begin={delay}
      repeatCount="indefinite"
      calcMode="spline"
      keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      keyTimes="0;0.5;1"
    />
  );
}

function CY(from: number, to: number, dur = "2s") {
  return (
    <animate
      attributeName="cy"
      values={`${from};${to};${from}`}
      dur={dur}
      repeatCount="indefinite"
      calcMode="spline"
      keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      keyTimes="0;0.5;1"
    />
  );
}

function CX(from: number, to: number, dur = "2s") {
  return (
    <animate
      attributeName="cx"
      values={`${from};${to};${from}`}
      dur={dur}
      repeatCount="indefinite"
      calcMode="spline"
      keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      keyTimes="0;0.5;1"
    />
  );
}

// ─── SQUAT ───────────────────────────────────────────────────────────────────
// Body dips down, knees splay outward, arms extend forward

function SquatAnim() {
  const dur = "2s";
  return (
    <svg {...BASE}>
      {/* Head */}
      <circle cx="40" r="5.5">
        <CY from={12} to={20} dur={dur} />
      </circle>
      {/* Torso */}
      <path>
        <D from="M 40,18 L 40,43" to="M 40,26 L 40,51" dur={dur} />
      </path>
      {/* L arm — extends forward during squat */}
      <path>
        <D from="M 40,24 L 29,37 L 25,49" to="M 38,31 L 24,36 L 18,46" dur={dur} />
      </path>
      {/* R arm */}
      <path>
        <D from="M 40,24 L 51,37 L 55,49" to="M 42,31 L 56,36 L 62,46" dur={dur} />
      </path>
      {/* L leg — knee splays outward, foot stays grounded */}
      <path>
        <D from="M 38,43 L 31,59 L 27,73" to="M 36,51 L 21,59 L 27,73" dur={dur} />
      </path>
      {/* R leg */}
      <path>
        <D from="M 42,43 L 49,59 L 53,73" to="M 44,51 L 59,59 L 53,73" dur={dur} />
      </path>
    </svg>
  );
}

// ─── PUSH ────────────────────────────────────────────────────────────────────
// Arms press outward and extend, then retract

function PushAnim() {
  const dur = "2s";
  return (
    <svg {...BASE}>
      {/* Head — stays still */}
      <circle cx="40" cy="11" r="5.5" />
      {/* Torso */}
      <path d="M 40,17 L 40,42" />
      {/* L arm — presses out */}
      <path>
        <D
          from="M 40,24 L 32,33 L 30,44"
          to="M 40,24 L 22,32 L 14,43"
          dur={dur}
        />
      </path>
      {/* R arm */}
      <path>
        <D
          from="M 40,24 L 48,33 L 50,44"
          to="M 40,24 L 58,32 L 66,43"
          dur={dur}
        />
      </path>
      {/* Legs — static */}
      <path d="M 38,42 L 31,58 L 27,72" />
      <path d="M 42,42 L 49,58 L 53,72" />
    </svg>
  );
}

// ─── PULL ────────────────────────────────────────────────────────────────────
// Arms start extended and pull inward (row motion)

function PullAnim() {
  const dur = "2s";
  return (
    <svg {...BASE}>
      {/* Head */}
      <circle cx="40" cy="11" r="5.5" />
      {/* Torso — slight lean back on pull */}
      <path>
        <D from="M 40,17 L 40,42" to="M 40,17 L 42,43" dur={dur} />
      </path>
      {/* L arm — pulls in from extended */}
      <path>
        <D
          from="M 40,24 L 22,32 L 14,43"
          to="M 40,24 L 32,33 L 30,43"
          dur={dur}
        />
      </path>
      {/* R arm */}
      <path>
        <D
          from="M 40,24 L 58,32 L 66,43"
          to="M 40,24 L 48,33 L 50,43"
          dur={dur}
        />
      </path>
      {/* Legs — static */}
      <path d="M 38,42 L 31,58 L 27,72" />
      <path d="M 42,42 L 49,58 L 53,72" />
    </svg>
  );
}

// ─── HINGE ───────────────────────────────────────────────────────────────────
// Hip hinge — torso folds forward from the waist, arms hang down

function HingeAnim() {
  const dur = "2.2s";
  return (
    <svg {...BASE}>
      {/* Head — follows torso forward */}
      <circle r="5.5">
        <CX from={40} to={56} dur={dur} />
        <CY from={11} to={21} dur={dur} />
      </circle>
      {/* Torso — pivots at hip (40,42): top goes from (40,17) to (60,31) */}
      <path>
        <D
          from="M 40,17 L 40,43"
          to="M 60,31 L 40,43"
          dur={dur}
        />
      </path>
      {/* L arm — hangs down from shoulder */}
      <path>
        <D
          from="M 40,23 L 29,36 L 25,48"
          to="M 55,34 L 50,48 L 49,61"
          dur={dur}
        />
      </path>
      {/* R arm */}
      <path>
        <D
          from="M 40,23 L 51,36 L 55,48"
          to="M 65,34 L 62,48 L 61,61"
          dur={dur}
        />
      </path>
      {/* Legs — slight knee bend */}
      <path>
        <D
          from="M 38,43 L 31,59 L 27,73"
          to="M 38,43 L 30,60 L 27,73"
          dur={dur}
        />
      </path>
      <path>
        <D
          from="M 42,43 L 49,59 L 53,73"
          to="M 42,43 L 50,60 L 53,73"
          dur={dur}
        />
      </path>
    </svg>
  );
}

// ─── CORE ────────────────────────────────────────────────────────────────────
// Crunch — upper body curls toward knees

function CoreAnim() {
  const dur = "2s";
  return (
    <svg {...BASE}>
      {/* Head — curls down */}
      <circle r="5.5">
        <CX from={40} to={40} dur={dur} />
        <CY from={12} to={24} dur={dur} />
      </circle>
      {/* Torso — upper half curls forward */}
      <path>
        <D
          from="M 40,18 L 40,43"
          to="M 40,30 L 40,43"
          dur={dur}
        />
      </path>
      {/* L arm — comes up during crunch */}
      <path>
        <D
          from="M 40,24 L 27,37 L 24,50"
          to="M 40,30 L 28,22 L 26,12"
          dur={dur}
        />
      </path>
      {/* R arm */}
      <path>
        <D
          from="M 40,24 L 53,37 L 56,50"
          to="M 40,30 L 52,22 L 54,12"
          dur={dur}
        />
      </path>
      {/* Legs — bent (sitting/lying position) */}
      <path d="M 38,43 L 29,55 L 24,67" />
      <path d="M 42,43 L 51,55 L 56,67" />
    </svg>
  );
}

// ─── CARDIO ──────────────────────────────────────────────────────────────────
// Running — arms and legs alternate in opposite phase

function CardioAnim() {
  const dur = "1.4s";
  const durR = dur;
  return (
    <svg {...BASE}>
      {/* Head — slight bounce */}
      <circle cx="40" r="5.5">
        <CY from={11} to={13} dur={dur} />
      </circle>
      {/* Torso — slight forward lean */}
      <path d="M 40,17 L 41,42" />
      {/* L arm — swings forward then back */}
      <path>
        <D
          from="M 40,24 L 30,35 L 27,48"
          to="M 40,24 L 50,33 L 53,44"
          dur={durR}
        />
      </path>
      {/* R arm — opposite phase */}
      <path>
        <D
          from="M 40,24 L 50,33 L 53,44"
          to="M 40,24 L 30,35 L 27,48"
          dur={durR}
        />
      </path>
      {/* L leg — strides forward then back */}
      <path>
        <D
          from="M 39,42 L 30,55 L 24,68"
          to="M 39,42 L 48,54 L 53,66"
          dur={durR}
        />
      </path>
      {/* R leg — opposite phase */}
      <path>
        <D
          from="M 41,42 L 50,54 L 55,66"
          to="M 41,42 L 32,55 L 27,68"
          dur={durR}
        />
      </path>
    </svg>
  );
}

// ─── DEFAULT ─────────────────────────────────────────────────────────────────
// Arms raise overhead then lower

function DefaultAnim() {
  const dur = "2.2s";
  return (
    <svg {...BASE}>
      {/* Head */}
      <circle cx="40" cy="11" r="5.5" />
      {/* Torso */}
      <path d="M 40,17 L 40,42" />
      {/* L arm — raises from side to overhead */}
      <path>
        <D
          from="M 40,24 L 28,37 L 24,50"
          to="M 40,24 L 28,12 L 28,2"
          dur={dur}
        />
      </path>
      {/* R arm */}
      <path>
        <D
          from="M 40,24 L 52,37 L 56,50"
          to="M 40,24 L 52,12 L 52,2"
          dur={dur}
        />
      </path>
      {/* Legs */}
      <path d="M 38,42 L 31,58 L 27,72" />
      <path d="M 42,42 L 49,58 L 53,72" />
    </svg>
  );
}

// ─── Matcher ─────────────────────────────────────────────────────────────────

function getAnimType(name: string): AnimType {
  const n = name.toLowerCase();
  if (/squat|lunge|leg press|step.?up/.test(n))                                         return "squat";
  if (/push.?up|chest press|shoulder press|overhead press|dip|bench/.test(n))           return "push";
  if (/row|pull.?up|lat pull|curl|face pull|chin.?up/.test(n))                          return "pull";
  if (/deadlift|hip thrust|good morning|romanian|rdl|hinge/.test(n))                    return "hinge";
  if (/plank|crunch|sit.?up|\bab\b|core|twist|hollow/.test(n))                         return "core";
  if (/run|jump|burpee|sprint|cycl|bike|skip|jog|cardio|jump.?jack|mountain/.test(n))  return "cardio";
  return "default";
}

// ─── Public export ────────────────────────────────────────────────────────────

export function ExerciseAnimation({ name }: { name: string }) {
  const type = getAnimType(name);
  switch (type) {
    case "squat":   return <SquatAnim />;
    case "push":    return <PushAnim />;
    case "pull":    return <PullAnim />;
    case "hinge":   return <HingeAnim />;
    case "core":    return <CoreAnim />;
    case "cardio":  return <CardioAnim />;
    default:        return <DefaultAnim />;
  }
}
