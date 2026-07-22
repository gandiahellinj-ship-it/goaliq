Ejecuta una auditoría profunda del código de GoalIQ. Es un análisis de SOLO LECTURA: no modifiques nada sin mi aprobación.

1. Recorre todo el proyecto: estructura de carpetas, componentes, rutas, backend (Express), conexión con Supabase, y configuración (Vite, Tailwind, pnpm).
2. Contrasta lo que existe en el código con lo que dicen `docs/PENDIENTES.md` y `docs/DECISIONES.md`. Señala discrepancias: cosas hechas que no están documentadas, cosas documentadas que no existen.
3. Evalúa la salud del código y explícamelo en español llano, sin jerga (define cualquier término técnico):
   - Código duplicado, archivos muertos o componentes sin usar.
   - Riesgos: cosas frágiles que pueden romperse al crecer, datos sensibles expuestos, dependencias desactualizadas o con avisos de seguridad.
   - Deuda técnica: atajos tomados que habrá que pagar después, ordenados por urgencia.
4. Entrégame un informe con exactamente estas secciones:
   - **ESTADO GENERAL** (1 frase honesta: bien / regular / preocupante, y por qué).
   - **LO QUE ESTÁ SÓLIDO** (para no tocarlo sin motivo).
   - **LO QUE HAY QUE ARREGLAR** (máx. 5 puntos, ordenados por importancia, con estimación de esfuerzo en llano: rápido / medio día / varios días).
   - **RECOMENDACIÓN** (qué arreglar antes de seguir añadiendo funciones, si es que hay algo).
5. Pregúntame si quiero que arregles algo de la lista, y guarda el informe en `docs/AUDITORIA.md` con la fecha.
