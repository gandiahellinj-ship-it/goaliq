import { Link } from "wouter";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 prose prose-sm prose-invert max-w-none">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidad</h1>
        <p className="text-sm text-[#A0A0A0] mb-6">
          GoalIQ Beta · Última actualización: 30 de mayo de 2026 · Versión 1.0
        </p>

        <div className="bg-blue-950/30 border-l-4 border-blue-500 p-4 mb-6 rounded not-prose">
          <p className="text-sm m-0">
            <strong>Esta es una versión preliminar.</strong> GoalIQ se encuentra actualmente en fase BETA PRIVADA.
            Esta política se actualizará con la versión definitiva antes del lanzamiento público.
          </p>
        </div>

        <h2>1. Responsable del tratamiento</h2>
        <p>
          <strong>Nombre:</strong> Jose Antonio Gandia Hellin<br />
          <strong>Localidad:</strong> Palma de Mallorca, Illes Balears, España<br />
          <strong>Email de contacto:</strong> <a href="mailto:blckbtz96@gmail.com">blckbtz96@gmail.com</a><br />
          <strong>Estado:</strong> Persona física (proyecto BETA privada)
        </p>

        <h2>2. Datos que procesamos</h2>
        <p>
          Para ofrecerte el servicio personalizado de GoalIQ, procesamos los siguientes datos:
        </p>
        <ul>
          <li><strong>Datos de cuenta:</strong> email, nombre</li>
          <li><strong>Datos físicos:</strong> edad, sexo, peso, altura</li>
          <li><strong>Datos médicos (categoría especial, Art. 9 RGPD):</strong> alergias, condiciones médicas, medicamentos</li>
          <li><strong>Preferencias:</strong> alimentos, intolerancias, objetivos</li>
          <li><strong>Progreso:</strong> registros de peso, planes de entrenamiento, comidas</li>
        </ul>

        <h2>3. Base legal del tratamiento</h2>
        <p>
          Procesamos tus datos basándonos en tu <strong>consentimiento explícito</strong>, que otorgas al registrarte
          y aceptar esta política. Para los datos médicos (categoría especial), aplicamos el Art. 9.2.a del RGPD
          (consentimiento explícito).
        </p>

        <h2>4. Transferencias internacionales y uso de IA</h2>
        <p>
          Para generar tus planes personalizados, utilizamos <strong>Claude (Anthropic, Inc.)</strong>, un modelo
          de IA con servidores en Estados Unidos. Anthropic ofrece garantías contractuales bajo las Cláusulas
          Contractuales Tipo de la UE (SCC).
        </p>
        <p>
          <strong>Tus datos médicos se envían a Anthropic</strong> para generar los planes. Esto se te informará
          explícitamente y requerirá tu consentimiento adicional antes de generar tu primer plan.
        </p>

        <h2>5. Otros encargados del tratamiento</h2>
        <ul>
          <li><strong>Supabase Inc.</strong> (USA, con SCC) — hosting de base de datos y autenticación</li>
          <li><strong>Replit Inc.</strong> (USA, con SCC) — hosting de la aplicación</li>
          <li><strong>Anthropic, PBC</strong> (USA, con SCC) — procesamiento de IA para planes personalizados</li>
        </ul>

        <h2>6. Tiempo de conservación</h2>
        <p>
          Conservamos tus datos mientras tengas una cuenta activa. Si solicitas el borrado de tu cuenta,
          eliminamos tus datos personales en un plazo máximo de 30 días, excepto los necesarios para
          cumplir obligaciones legales (registros de consentimiento durante 6 años).
        </p>

        <h2>7. Tus derechos RGPD</h2>
        <p>Tienes derecho a:</p>
        <ul>
          <li><strong>Acceso</strong> (Art. 15): saber qué datos tenemos sobre ti</li>
          <li><strong>Rectificación</strong> (Art. 16): corregir datos incorrectos</li>
          <li><strong>Supresión</strong> (Art. 17): borrar tu cuenta y datos ("derecho al olvido")</li>
          <li><strong>Portabilidad</strong> (Art. 20): descargar tus datos en formato JSON</li>
          <li><strong>Oposición</strong> (Art. 21): oponerte al procesamiento</li>
          <li><strong>Limitación</strong> (Art. 18): pedir que limitemos el uso de tus datos</li>
          <li><strong>Retirar consentimiento</strong> en cualquier momento</li>
        </ul>
        <p>
          Puedes ejercer estos derechos desde la sección <strong>"Privacidad y datos"</strong> en tu cuenta,
          o escribiendo a <a href="mailto:blckbtz96@gmail.com">blckbtz96@gmail.com</a>.
        </p>

        <h2>8. Decisiones automatizadas (Art. 22 RGPD)</h2>
        <p>
          Los planes de comidas y entrenamientos generados por IA son recomendaciones personalizadas.
          Tú mantienes el control total y puedes regenerar, modificar o ignorar cualquier sugerencia.
          No tomamos decisiones automatizadas con efectos legales sobre ti.
        </p>

        <h2>9. Cookies y almacenamiento</h2>
        <p>
          Utilizamos cookies técnicas necesarias para mantener tu sesión activa. No utilizamos cookies
          de seguimiento ni publicidad.
        </p>

        <h2>10. Seguridad</h2>
        <p>
          Aplicamos medidas técnicas y organizativas apropiadas: cifrado TLS, encriptación en reposo,
          autenticación segura, Row-Level Security en base de datos, rate limiting, auditoría de seguridad.
        </p>

        <h2>11. Reclamaciones</h2>
        <p>
          Si consideras que tratamos tus datos de forma incorrecta, puedes presentar una reclamación
          ante la Agencia Española de Protección de Datos (AEPD): <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>.
        </p>

        <h2>12. Cambios en esta política</h2>
        <p>
          Te notificaremos por email cualquier cambio sustancial a esta política. La versión actual
          siempre estará disponible en esta página.
        </p>

        <div className="mt-8 pt-4 border-t border-[#2A2A2A] text-sm text-[#A0A0A0]">
          <p>
            ¿Tienes preguntas? Contacta a <a href="mailto:blckbtz96@gmail.com">blckbtz96@gmail.com</a>.
          </p>
          <p>
            <Link href="/terms">Términos de Uso</Link> · <Link href="/">Volver al inicio</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
