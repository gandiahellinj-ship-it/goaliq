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
const IMG_W = 1536;
const IMG_H = 2752;
const IMG_ASPECT = IMG_W / IMG_H; // ancho / alto del render (vertical 9:16)

// --- Geometría del aro, RE-MEDIDA pixel a pixel sobre home_mesa.png (Pillow) ---
// Scanlines por el centro del aro antracita horneado (imagen 1536×2752):
//   centro (768, 1579.5)
//   elipse EXTERIOR  rx=174  ry=32.5
//   elipse INTERIOR  rx=121  ry=19.5
// El aro cian se construye con ESTAS MISMAS elipses (exterior e interior
// independientes), por lo que se superpone exactamente sobre el aro de la mesa
// sin dejar asomar antracita ni desbordarse. Para reposicionar, edita estos px.
const RING = {
  cx: 768,
  cy: 1579.5,
  rxOuter: 174,
  ryOuter: 32.5,
  rxInner: 121,
  ryInner: 19.5,
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

/**
 * Construye una banda anular ELÍPTICA (sector) entre dos elipses concéntricas
 * con radios independientes, barriendo de `a0` a `a1`. Con un barrido completo
 * (2π) genera el anillo entero; con un barrido parcial, el arco de progreso.
 * Ángulo medido como en cos/sin: π/2 = arriba (12h); decrecer = sentido horario.
 */
function ellipseBand(
  rxO: number,
  ryO: number,
  rxI: number,
  ryI: number,
  a0: number,
  a1: number,
  segments: number,
): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const t = a0 + ((a1 - a0) * i) / segments;
    const x = rxO * Math.cos(t);
    const y = ryO * Math.sin(t);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = 0; i <= segments; i++) {
    const t = a1 + ((a0 - a1) * i) / segments;
    shape.lineTo(rxI * Math.cos(t), ryI * Math.sin(t));
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** Aro de progreso 3D: pista antracita + arco cian + respiración sutil. */
function ProgressRing({ planeW, planeH }: { planeW: number; planeH: number }) {
  const breatheRef = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);

  const { x, y, geomTrack, geomProgress, geomGlow } = useMemo(() => {
    const s = planeW / IMG_W; // unidades de mundo por píxel de imagen (isótropo)
    const rxO = RING.rxOuter * s;
    const ryO = RING.ryOuter * s;
    const rxI = RING.rxInner * s;
    const ryI = RING.ryInner * s;
    const top = Math.PI / 2; // 12 en punto
    const end = top - HOME_PROGRESS * Math.PI * 2; // sentido horario
    return {
      x: (RING.cx / IMG_W - 0.5) * planeW,
      y: (0.5 - RING.cy / IMG_H) * planeH,
      geomTrack: ellipseBand(rxO, ryO, rxI, ryI, top, top - Math.PI * 2, 192),
      geomProgress: ellipseBand(rxO, ryO, rxI, ryI, top, end, 192),
      geomGlow: ellipseBand(
        rxO * 1.05,
        ryO * 1.05,
        rxI * 0.95,
        ryI * 0.95,
        top,
        end,
        192,
      ),
    };
  }, [planeW, planeH]);

  // Respiración (§ "idle sutil: leve respiración/pulso") + shimmer del glow.
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (breatheRef.current) {
      const sc = 1 + Math.sin(t * 1.1) * 0.015;
      breatheRef.current.scale.set(sc, sc, 1);
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.16 + Math.sin(t * 1.1) * 0.06;
    }
  });

  return (
    <group position={[x, y, 0.01]}>
      <group ref={breatheRef}>
        {/* Pista completa en antracita (29% restante / estado base) */}
        <mesh geometry={geomTrack} renderOrder={1}>
          <meshBasicMaterial
            color={COLOR_ANTHRACITE}
            side={THREE.DoubleSide}
            transparent
            opacity={0.92}
            depthTest={false}
          />
        </mesh>

        {/* Glow cian suave alrededor del arco (shimmer animado) */}
        <mesh ref={glowRef} geometry={geomGlow} renderOrder={2} position={[0, 0, 0.001]}>
          <meshBasicMaterial
            color={COLOR_CYAN}
            side={THREE.DoubleSide}
            transparent
            opacity={0.16}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>

        {/* Arco de progreso en cian (12 h → horario, 71%) */}
        <mesh geometry={geomProgress} renderOrder={3} position={[0, 0, 0.002]}>
          <meshBasicMaterial
            color={COLOR_CYAN}
            side={THREE.DoubleSide}
            toneMapped={false}
            depthTest={false}
          />
        </mesh>
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
