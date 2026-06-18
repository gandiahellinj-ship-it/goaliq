import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Mesh } from "three";

/**
 * MesaTestScene — escena 3D mínima de validación (Paso 1, §8 del doc técnico).
 *
 * Objetivo: confirmar que React Three Fiber renderiza fluido sobre la
 * "sala blanca infinita" de GoalIQ, con un objeto de prueba que gira.
 * NO es Home todavía: solo el setup del mundo 3D (Canvas + sala + cámara +
 * objeto de prueba + un contador de FPS para validar rendimiento).
 *
 * Paleta bloqueada (§3): fondo blanco #FFFFFF, cian energía #0AF7EE,
 * cian reposo #50F0E4, antracita #1C2226.
 */

/** Objeto de prueba: un toro-nudo cian que respira y gira lentamente. */
function TestObject() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Giro suave; delta-based para que sea independiente del framerate.
    mesh.rotation.x += delta * 0.3;
    mesh.rotation.y += delta * 0.45;
  });

  return (
    <mesh ref={meshRef} castShadow position={[0, 0.6, 0]}>
      <torusKnotGeometry args={[0.7, 0.24, 160, 32]} />
      <meshStandardMaterial
        color="#0AF7EE"
        metalness={0.35}
        roughness={0.25}
        emissive="#0AF7EE"
        emissiveIntensity={0.12}
      />
    </mesh>
  );
}

/** Suelo de la sala: plano blanco que recibe la sombra del objeto. */
function RoomFloor() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.6, 0]}
      receiveShadow
    >
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
    </mesh>
  );
}

export default function MesaTestScene() {
  const [fps, setFps] = useState(0);

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 1.2, 4.5], fov: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#ffffff", 1);
        }}
      >
        {/* Sala blanca infinita: fondo + niebla suave para fundir el horizonte */}
        <color attach="background" args={["#ffffff"]} />
        <fog attach="fog" args={["#ffffff", 8, 22]} />

        {/* Luces — limitadas y suaves (§9 rendimiento) */}
        <ambientLight intensity={0.85} />
        <directionalLight
          position={[4, 6, 4]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        <RoomFloor />
        <TestObject />

        {/* Cámara controlable solo para validar la escena (no irá en Home) */}
        <OrbitControls
          enablePan={false}
          minDistance={2.5}
          maxDistance={8}
          target={[0, 0.5, 0]}
        />

        <FpsTracker onUpdate={setFps} />
      </Canvas>

      {/* Overlay HTML (capa 2D encima del Canvas) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0AF7EE] shadow-[0_0_8px_#0AF7EE]" />
          <span className="text-xs uppercase tracking-[0.2em] text-[#1C2226]/70">
            La mesa viva · setup 3D
          </span>
        </div>

        <div className="flex items-end justify-between">
          <p className="max-w-xs text-[11px] leading-relaxed text-[#1C2226]/50">
            Escena de prueba. Arrastra para orbitar la cámara. Si gira fluido,
            el mundo 3D está listo para construir Home.
          </p>
          <span className="rounded-md bg-[#1C2226] px-2.5 py-1 font-mono text-[11px] text-[#0AF7EE]">
            {fps} FPS
          </span>
        </div>
      </div>
    </div>
  );
}

/** Mide FPS dentro del Canvas y lo comunica al overlay HTML externo. */
function FpsTracker({ onUpdate }: { onUpdate: (fps: number) => void }) {
  const acc = useRef({ frames: 0, elapsed: 0 });

  useFrame((_, delta) => {
    const a = acc.current;
    a.frames += 1;
    a.elapsed += delta;
    if (a.elapsed >= 0.5) {
      onUpdate(Math.round(a.frames / a.elapsed));
      a.frames = 0;
      a.elapsed = 0;
    }
  });

  return null;
}
