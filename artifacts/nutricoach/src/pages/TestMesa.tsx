import MesaTestScene from "@/components/mesa/MesaTestScene";

/**
 * /test-mesa — sandbox aislado para el setup del mundo 3D de "la mesa viva".
 *
 * Paso 1 del orden de construcción (§8): Canvas R3F + sala blanca + cámara +
 * objeto de prueba, para confirmar que renderiza fluido. NO es Home.
 * La ruta se registra en App.tsx sin tocar el resto de la app.
 */
export default function TestMesa() {
  return (
    <div className="h-screen w-full bg-white">
      <MesaTestScene />
    </div>
  );
}
