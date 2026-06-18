import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Group, Mesh } from "three";

/**
 * HomeScene — Paso 2 (§6.1 + §8) de "La Mesa Viva": HOME.
 *
 * Enfoque del documento (§2): la imagen `home_mesa.png` se coloca como un
 * PLANO TEXTURIZADO en el espacio 3D. La cámara es frontal/contemplativa y
 * muestra la mesa entera con su aro central. Sobre el aro físico (antracita,
 * ya horneado en el render) se dibuja el ARO DE PROGRESO en 3D: pista en
 * antracita + arco cian (#0AF7EE) que se llena según el progreso mensual.
 *
 * Alineación: las constantes RING_* se midieron sobre los píxeles reales del
 * render (centro 49.8% / 57.4%, radio 11% del ancho, ratio elíptico 0.19),
 * así que el aro 3D cae exactamente sobre el aro horneado. Para reposicionar
 * basta tocar estas constantes.
 */

const TEXTURE_URL = "/mesa/home_mesa.png";
const IMG_ASPECT = 1536 / 2752; // ancho / alto del render (vertical 9:16)

// --- Geometría del aro, medida sobre el render (fracciones de la imagen) ---
const RING = {
  centerX: 0.498, // fracción del ANCHO desde la izquierda
  centerY: 0.574, // fracción del ALTO desde arriba
  outerRadiusX: 0.11, // radio exterior horizontal, fracción del ANCHO
  ellipseRatio: 0.19, // radio vertical / radio horizontal (perspectiva)
  innerFrac: 0.82, // radio interior como fracción del exterior (banda fina)
};

// --- Datos de ejemplo (mock). §6.1: meta_mes = 17, hechos = 12. ---
const WORKOUTS_DONE = 12;
const WORKOUTS_GOAL = 17;
export const HOME_PROGRESS = WORKOUTS_DONE / WORKOUTS_GOAL; // ≈ 0.706

const COLOR_CYAN = "#0AF7EE"; // cian energía/glow (§3)
const COLOR_ANTHRACITE = "#1C2226"; // antracita estructura (§3)

/** Plano texturizado con el render de la mesa (la "sala" + mesa + aro). */
function MesaPlane({ planeW, planeH }: { planeW: number; planeH: number }) {
  const texture = useTexture(TEXTURE_URL, (t) => {
    const tex = t as THREE.Texture;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  });

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[planeW, planeH]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/** Aro de progreso 3D: pista antracita + arco cian + respiración sutil. */
function ProgressRing({ planeW, planeH }: { planeW: number; planeH: number }) {
  const breatheRef = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);

  // Posición y tamaño del aro en coordenadas del mundo, derivados del render.
  const layout = useMemo(() => {
    const outerRx = RING.outerRadiusX * planeW;
    const outerRy = outerRx * RING.ellipseRatio;
    const x = (RING.centerX - 0.5) * planeW;
    const y = (0.5 - RING.centerY) * planeH;
    return { outerRx, outerRy, x, y };
  }, [planeW, planeH]);

  const progressAngle = HOME_PROGRESS * Math.PI * 2;

  // Respiración (§ "idle sutil: leve respiración/pulso") + shimmer del glow.
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (breatheRef.current) {
      const s = 1 + Math.sin(t * 1.1) * 0.015;
      breatheRef.current.scale.set(s, s, 1);
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.18 + Math.sin(t * 1.1) * 0.07;
    }
  });

  return (
    <group position={[layout.x, layout.y, 0.01]}>
      {/* Escala a la elipse del render; un grupo interior aplica la respiración */}
      <group scale={[layout.outerRx, layout.outerRy, 1]}>
        <group ref={breatheRef}>
          {/* Pista completa en antracita (estado base / vacío) */}
          <mesh renderOrder={1}>
            <ringGeometry args={[RING.innerFrac, 1, 128]} />
            <meshBasicMaterial
              color={COLOR_ANTHRACITE}
              side={THREE.DoubleSide}
              transparent
              opacity={0.9}
              depthTest={false}
            />
          </mesh>

          {/* Arco de progreso en cian, desde arriba (12h) en sentido horario */}
          <mesh renderOrder={3} scale={[-1, 1, 1]} position={[0, 0, 0.002]}>
            <ringGeometry
              args={[
                RING.innerFrac,
                1,
                128,
                1,
                Math.PI / 2,
                progressAngle,
              ]}
            />
            <meshBasicMaterial
              color={COLOR_CYAN}
              side={THREE.DoubleSide}
              toneMapped={false}
              depthTest={false}
            />
          </mesh>

          {/* Glow suave detrás del arco cian (shimmer animado) */}
          <mesh ref={glowRef} renderOrder={2} position={[0, 0, 0.001]}>
            <ringGeometry args={[RING.innerFrac * 0.96, 1.04, 128]} />
            <meshBasicMaterial
              color={COLOR_CYAN}
              side={THREE.DoubleSide}
              transparent
              opacity={0.18}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Calcula el tamaño del plano para que la mesa entera quepa (contain). */
function MesaWorld() {
  const viewport = useThree((s) => s.viewport);

  const { planeW, planeH } = useMemo(() => {
    let h = viewport.height;
    let w = h * IMG_ASPECT;
    if (w > viewport.width) {
      w = viewport.width;
      h = w / IMG_ASPECT;
    }
    return { planeW: w, planeH: h };
  }, [viewport.width, viewport.height]);

  return (
    <>
      <Suspense fallback={null}>
        <MesaPlane planeW={planeW} planeH={planeH} />
      </Suspense>
      <ProgressRing planeW={planeW} planeH={planeH} />
    </>
  );
}

export default function HomeScene() {
  return (
    <Canvas
      orthographic={false}
      dpr={[1, 2]}
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor("#ffffff", 1)}
    >
      <color attach="background" args={["#ffffff"]} />
      <MesaWorld />
    </Canvas>
  );
}
