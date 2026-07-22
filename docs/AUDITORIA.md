# GoalIQ — Auditoría de código

> Fecha: 2026-07-22. Análisis de solo lectura sobre la rama `main`, contrastado con `feature/layout-3-zonas`.
> Realizada por Claude Code (3 exploradores paralelos: interfaz, servidor, configuración + revisión de seguridad de dependencias).

---

## ESTADO GENERAL

**Regular, pero con base sana**: el producto funciona y la lógica de datos por usuario está bien hecha, pero hay 3 endpoints de IA abiertos a cualquiera (riesgo de gasto descontrolado), el proyecto vive partido en dos ramas que se contradicen con su propia documentación, y se acumula bastante peso muerto.

---

## DISCREPANCIAS DOCUMENTACIÓN ↔ CÓDIGO

1. **La carpeta `docs/` no existe en `main`** — solo existe en la rama `feature/layout-3-zonas` (PENDIENTES.md, DECISIONES.md, FLUJO_DIARIO.md, ECONOMIA.md, PROMPT_PLATOS.md, todos al día hasta el 09/07/2026). Consecuencia: el CLAUDE.md de `main`, los comandos `/dia`, `/cierre` y el script `inicio-goaliq.ps1` apuntan a archivos que no están en la rama activa. **Acción acordada: traer `docs/` a `main` sin tocar el resto de la rama.**
2. **Dos aplicaciones divergentes.** `feature/layout-3-zonas` va 16 commits por delante de `main`: contiene toda la migración visual `/vision` (layout 3 zonas, 5 pestañas migradas, Fase 6 de limpieza hecha, ~2.250 líneas), pendiente solo de fusionar según PENDIENTES. Mientras tanto, `main` siguió avanzando por otro camino (registro de comidas por foto "BALANZ", endpoints Gemini, escenas 3D "mesa viva").
3. **CLAUDE.md describe una interfaz que no coincide con ninguna de las dos ramas**: dice "navegación vertical por pisos, paleta beige/dorado" y "verde ELIMINADO" — pero en `main` la app real usa acento verde lima (#AAFF45) con barra lateral clásica, sin pisos; la paleta beige/dorado y el layout de 3 zonas (65/5/~26, lo que CLAUDE.md llama "BALANZ 65/5/30") existen solo en la rama. Además "BALANZ" en el código de `main` es otra cosa: la función de validar comidas por foto (paleta cian #50F0E4). El naranja #FF7A2F no aparece en ningún sitio.
4. **`replit.md` está desfasado**: documenta login vía Replit Auth cuando la app usa Supabase (email/contraseña), y menciona integraciones OpenAI que ya no se usan (todo es Claude + Gemini).
5. **Cosas hechas y no documentadas en `main`**: los 5 commits recientes (registro de comidas, endpoints IA, límite 15mb) no están reflejados en ningún documento de `main` (el CHANGELOG llega hasta el 09/06).

---

## LO QUE ESTÁ SÓLIDO (no tocar sin motivo)

- **Aislamiento de datos por usuario**: todas las rutas protegidas del servidor verifican la sesión y usan el ID del usuario verificado (nunca el que envía el navegador). No se encontró ninguna vía de inyección SQL (todas las consultas usan parámetros seguros).
- **Sin secretos filtrados**: no hay claves privadas (Stripe secreta, Anthropic, service_role) en el código. Las claves de las APIs externas (WorkoutX, Spoonacular) se quedan en el servidor y nunca llegan al navegador.
- **El flujo de Stripe**: webhook con verificación de firma bien ordenado, suscripciones con prueba de 3 días, sincronización a base de datos.
- **Validación de onboarding y perfil**: esquemas estrictos (zod), validaciones cruzadas, período de enfriamiento de 24h para cambios, bloqueo por IMC.
- **RGPD**: consentimiento, exportación de datos (Art. 20), borrado de cuenta (Art. 17), códigos beta — implementado y funcional.
- **La documentación de la rama** (DECISIONES/PENDIENTES/ECONOMIA/FLUJO_DIARIO): viva, precisa y con fechas. Es el mejor activo de gestión del proyecto.
- **Registro y logs del servidor**: pino con datos sensibles tapados (tokens, cookies).

---

## LO QUE HAY QUE ARREGLAR (por importancia)

1. **Cerrar los 3 endpoints de IA abiertos** — `POST /api/diets/generate`, `/api/diets/visualize` y `/api/meals/validate` no piden sesión ni tienen límite de peticiones. Cualquiera que descubra la URL puede gastar crédito de Claude Opus y Gemini sin límite, y subir fotos de 15 MB anónimamente. Es el riesgo nº 1 (es dinero directo). También: `GET /api/recipes/random` sin límite (cuota Spoonacular). **Esfuerzo: rápido** (añadir el mismo control de sesión + limitador que ya usan las demás rutas).
2. **Traer `docs/` a `main` y corregir CLAUDE.md** — sin esto, cada sesión de trabajo arranca con instrucciones falsas (paleta, layout, archivos inexistentes). Incluye actualizar la descripción de "UI actual" para reflejar las dos ramas. **Esfuerzo: rápido**.
3. **El repositorio está "clavado" a Windows** — la configuración de pnpm anula los binarios de Linux/Mac de varias herramientas (esbuild, rollup, tailwind...). Riesgo real: al fusionar y publicar en Replit (que es Linux), la instalación puede fallar. Hay que verificarlo antes de la próxima fusión a `main`. **Esfuerzo: medio día** (probar y, si falla, quitar esos anclajes).
4. **8 avisos de seguridad en dependencias (3 altos)** — versiones antiguas de librerías con fallos conocidos: path-to-regexp y ws (pueden tumbar el servidor con peticiones malformadas), drizzle-orm (fallo de inyección en una función que apenas se usa aquí), qs, body-parser, SDK de Anthropic. Ninguno está siendo explotado, pero conviene actualizar. **Esfuerzo: rápido** (subir versiones y probar).
5. **Peso muerto y cabos sueltos** — 4 paquetes del monorepo declarados pero nunca usados (replit-auth-web, integraciones OpenAI ×2, carpeta `lib/integrations` huérfana), ~40 de 57 componentes de interfaz sin usar, logos que dan error 404 (`GOALIQ.png`, `GUIA.png` no existen en `public/images/`), rutas de prueba `/test-*` con todo el motor 3D (three.js + GSAP) cargando en el paquete principal de la app, y una contraseña de usuario de prueba escrita en `scripts/e2e-test.js`. **Esfuerzo: medio día**.

### Deuda técnica mayor (para después, no urgente)

- **Duplicación sistemática en el servidor**: la conexión a base de datos copiada en 10+ archivos, el diccionario de ejercicios ES→EN copiado 3 veces, el cálculo de "inicio de semana" 5 veces (con diferencias sutiles entre sí — fuente de errores futuros), dos implementaciones distintas de llamada a Claude. **Esfuerzo: varios días**, se puede hacer gradualmente.
- **Arquitectura de acceso a datos con dos caminos**: parte de las tablas se leen con las protecciones de Supabase (RLS) y parte con conexión directa de superusuario que se las salta; varias tablas nuevas (meal_logs, strength_logs, calendar_events...) no tienen RLS. Hoy es correcto, pero es frágil al crecer. **Esfuerzo: varios días**.
- Sin gestor central de errores en Express (algunos fallos de validación devuelven error 500 genérico); el límite de 15 MB aplica a TODAS las rutas en vez de solo a la de fotos; migraciones de tablas ejecutándose en cada arranque.

---

## RECOMENDACIÓN

Antes de añadir ninguna función nueva: **(1)** cerrar los endpoints de IA abiertos (es la única fuga de dinero potencial y se arregla en poco tiempo), **(2)** traer `docs/` a `main` y corregir CLAUDE.md para que las sesiones de trabajo arranquen con información veraz, y **(3)** decidir el destino de la rama `feature/layout-3-zonas` — cuanto más tiempo convivan las dos apps divergentes, más doloroso será fusionarlas (y hay que verificar antes el punto 3 de la lista, la instalación en Replit). Los avisos de dependencias y la limpieza pueden esperar a una sesión tranquila; la deuda de duplicación, a después de la beta.
