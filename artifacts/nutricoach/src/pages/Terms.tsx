import { Link } from "wouter";

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 prose prose-sm prose-invert max-w-none">
        <h1 className="text-3xl font-bold mb-2">Términos de Uso</h1>
        <p className="text-sm text-[#A0A0A0] mb-6">
          GoalIQ Beta · Última actualización: 30 de mayo de 2026 · Versión 1.0
        </p>

        <div className="bg-amber-950/30 border-l-4 border-amber-500 p-4 mb-6 rounded not-prose">
          <p className="text-sm m-0">
            <strong>GoalIQ está en fase BETA PRIVADA.</strong> Estos términos describen tu participación
            en el programa beta. La versión comercial tendrá términos más completos.
          </p>
        </div>

        <h2>1. Quiénes somos</h2>
        <p>
          GoalIQ es un proyecto en fase BETA gestionado por <strong>Jose Antonio Gandia Hellin</strong>
          (Palma de Mallorca, España), como persona física.
        </p>

        <h2>2. Naturaleza de la beta</h2>
        <ul>
          <li>Acceso por invitación con código personal</li>
          <li><strong>Gratuita</strong> durante toda la fase beta</li>
          <li>Funcionalidades pueden cambiar o estar incompletas</li>
          <li>Sin compromiso de disponibilidad continua</li>
        </ul>

        <h2>3. Tu cuenta</h2>
        <ul>
          <li>Debes tener al menos <strong>18 años</strong> para registrarte</li>
          <li>Información proporcionada debe ser veraz</li>
          <li>Eres responsable de mantener la confidencialidad de tu contraseña</li>
          <li>Una sola cuenta por persona</li>
        </ul>

        <h2>4. Aviso médico CRÍTICO</h2>
        <div className="bg-red-950/30 border-l-4 border-red-500 p-4 rounded not-prose">
          <p className="text-sm m-0">
            <strong>⚠️ GoalIQ NO es un servicio médico.</strong> Los planes generados son recomendaciones
            generales basadas en información que proporcionas. <strong>NO sustituyen el consejo de un
            profesional sanitario.</strong> Consulta siempre a tu médico antes de iniciar planes de dieta
            o ejercicio, especialmente si tienes condiciones médicas, estás embarazada, en lactancia,
            o tomas medicación.
          </p>
        </div>

        <h2>5. Uso aceptable</h2>
        <p>Te comprometes a NO:</p>
        <ul>
          <li>Compartir tu código de invitación con terceros</li>
          <li>Usar la app para fines ilegales o dañinos</li>
          <li>Intentar acceder a datos de otros usuarios</li>
          <li>Hacer ingeniería inversa o intentar burlar la seguridad</li>
          <li>Usar bots, scrapers o automatización no autorizada</li>
          <li>Generar spam o abuso de los endpoints</li>
        </ul>

        <h2>6. Propiedad intelectual</h2>
        <p>
          El código, diseño y contenido de GoalIQ son propiedad de su autor. Tu uso de la plataforma
          no te otorga derechos de propiedad sobre el servicio. Los datos que tú generas (planes,
          registros) te pertenecen y puedes exportarlos en cualquier momento.
        </p>

        <h2>7. Limitación de responsabilidad</h2>
        <p>
          GoalIQ se ofrece "tal cual" durante la beta. No garantizamos:
        </p>
        <ul>
          <li>Disponibilidad ininterrumpida del servicio</li>
          <li>Que los planes sean adecuados para tu situación médica específica</li>
          <li>Resultados específicos de pérdida de peso, ganancia muscular o salud</li>
        </ul>
        <p>
          En la máxima medida permitida por ley, no somos responsables de daños indirectos,
          consecuenciales o lucro cesante.
        </p>

        <h2>8. Modificación y terminación</h2>
        <p>
          Podemos:
        </p>
        <ul>
          <li>Modificar funcionalidades, planes o estos términos en cualquier momento</li>
          <li>Terminar la beta con aviso previo de 30 días</li>
          <li>Suspender tu cuenta por incumplimiento grave</li>
        </ul>
        <p>
          Tú puedes terminar tu cuenta cuando quieras desde Settings → Privacidad.
        </p>

        <h2>9. Ley aplicable y jurisdicción</h2>
        <p>
          Estos términos se rigen por la legislación española. Cualquier disputa se someterá a los
          tribunales de Palma de Mallorca, España.
        </p>

        <h2>10. Contacto</h2>
        <p>
          Para cualquier consulta sobre estos términos: <a href="mailto:blckbtz96@gmail.com">blckbtz96@gmail.com</a>.
        </p>

        <div className="mt-8 pt-4 border-t border-[#2A2A2A] text-sm text-[#A0A0A0]">
          <p>
            <Link href="/privacy">Política de Privacidad</Link> · <Link href="/">Volver al inicio</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
