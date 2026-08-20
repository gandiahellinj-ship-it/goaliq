# GoalIQ — Inventario funcional completo

> **Para qué sirve este documento:** permitir que alguien que NUNCA ha visto la app reconstruya su
> interfaz desde cero, pantalla a pantalla, sin mirar el código.
> **Fecha:** 20/08/2026 · **Rama:** `staging` · **Método:** recorrido completo del código por Claude +
> lectura independiente de Codex, contrastadas. Cada hallazgo que solo vio uno de los dos va marcado.
> No se documenta implementación interna: solo lo que un usuario **ve, hace, paga y firma**.

**Leyenda de marcas:**
`[C]` lo encontró Claude · `[X]` lo encontró Codex · `[C+X]` ambos · `[X→verificado]` lo apuntó Codex y
Claude lo confirmó en el código · `[X→descartado]` lo apuntó Codex y **no es cierto** (se explica por qué).

---

## 1. PANTALLAS Y RUTAS

Router: `wouter`. Definición completa en `src/App.tsx`. Hay **22 rutas**.

### 1.1 Envoltorios globales (están en TODAS las pantallas)

| Elemento | Qué es |
|---|---|
| `AuthModal` | Modal de acceso, invocable desde cualquier ruta |
| `GenerationOverlay` | Capa a pantalla completa mientras la IA genera un plan. Bloquea la interacción |
| `Toaster` + `SonnerToaster` | Avisos emergentes. Sonner abajo-centro, tema oscuro |
| `LanguageProvider` | Idioma ES/EN global |
| `AppLayout` | Solo en rutas protegidas: barra lateral (escritorio) / navegación inferior (móvil) |

**Menú de navegación de la app antigua (7 entradas + ajustes), en orden:**

| Icono | Etiqueta | Ruta | ¿De pago? |
|---|---|---|---|
| Panel | Inicio | `/dashboard` | No |
| Cubiertos | Comidas | `/meals` | Sí |
| **Cámara** | **Mi comida** | `/comidas` | Sí |
| Carro | Compra | `/shopping` | Sí |
| Mancuerna | Entrenos | `/workouts` | Sí |
| Calendario | Calendario | `/calendar` | Sí |
| Gráfica | Progreso | `/progress` | Sí |
| Engranaje | Ajustes | `/settings` | No |

El elemento activo se marca con el color de acento, fondo tenue y **una barra vertical de 2 px a la izquierda**.

### 1.2 Rutas públicas (sin sesión)

#### `/` — Landing
- **Muestra:** portada de marca, propuesta de valor, enlaces legales y a precios.
- **Acciones:** abrir el modal de acceso (registro/login).
- **Estados:** único (no carga datos).

#### `/pricing` — Precios
- **Muestra:** un solo plan. Precio literal **€19.99** + `per_month`. Nota bajo el precio que cambia si el
  usuario ya gastó su prueba (`priceAfterTrial` vs `resubscribePriceNote`).
- **Acciones:** iniciar prueba / suscribirse (lleva a Stripe Checkout), abrir portal de Stripe si ya está suscrito.
- **Estados:** con sesión / sin sesión / ya suscrito / re-suscripción.

#### `/privacy` — Política de privacidad
- Documento estático, 9 apartados. Incluye derechos RGPD (acceso, rectificación, **supresión art. 17**,
  portabilidad) y **§9 Cookies y almacenamiento** (declara solo cookies técnicas de sesión).

#### `/terms` — Términos
- Documento estático. Encabezado: *"GoalIQ Beta · Última actualización: 30 de mayo de 2026 · Versión 1.0"*.
- Declara la app **en BETA PRIVADA** y **"Gratuita durante toda la fase beta"**.
- Responsable nombrado: *Jose Antonio Gandia Hellin*.
- Reserva el derecho a *"terminar la beta con aviso previo de 30 días"*.
- ⚠️ **Contradice a `/pricing`** — ver §13.

#### `/checkout/success` — Vuelta del pago
- **Muestra:** confirmación de la suscripción o de la prueba.
- **Acciones:** continuar a la app.
- **Estados:** verificando (llama a `/api/checkout/verify`), éxito, error.

#### `/onboarding` — Cuestionario inicial
Ver §9 (exhaustivo). 7 pasos, barra de progreso segmentada, "Paso N de 7".

#### `/vision` — La app nueva (dirección visual definitiva)
- **Puerta de sesión propia:** sin sesión muestra el logo GoalIQ y un botón *"Iniciar sesión"*, no las tripas.
- **Marco:** columna de máx. 430 px. En escritorio (≥640 px) se centra con esquinas redondeadas y sombra
  sobre un lienzo `#E4DFD6`. Alto fijo, **sin scroll vertical**.
- **Estructura de 3 zonas:** contenido (~65%) · barra de pestañas circular · panel contextual (~26%).
- **5 pestañas:** `home` · `meals` · `workout` · `progress` · `settings`.
  - `[X→descartado]` Codex afirmó que `/vision` tiene pestañas de *Calendar* y *Profile*. **No es cierto**:
    `src/pages/VisionApp.tsx:27` declara exactamente esas cinco.
- **Estados por pestaña:** cargando (spinner), error de red con botón de reintento, vacío.
- Además: insignia de suplementos y modal de suplementos accesibles desde la cabecera.

#### `/test-cinematic`, `/test-mesa`, `/test-home` — Experimentos
Rutas de laboratorio 3D/cinemática, accesibles escribiendo la URL. **No forman parte del producto.**
Ver §4.

### 1.3 Rutas protegidas (dentro de `AppLayout`)

#### `/dashboard` — Panel (app antigua)
- **Muestra:** saludo, resumen del día, calorías y macros, comidas y entreno de hoy, adherencia,
  accesos rápidos.
- **Datos:** perfil, plan de comidas, plan de entrenos, estadísticas de progreso, días flex, suscripción,
  lista de la compra.
- **Estados:** cargando, sin plan, con plan.

#### `/meals` — Plan de comidas semanal
- **Muestra:** selector de día, tarjetas por comida con nombre, calorías, ingredientes con cantidades,
  preparación y notas.
- **Acciones:** generar/regenerar plan (`handleRetry`), **cambiar un ingrediente** por una alternativa
  (`useSwapIngredient` → selector de opciones).
- **Estados:** cargando, generando sin plan previo (pantalla dedicada), perfil incompleto
  (`please_complete_profile`), error con reintento, éxito por ingrediente (marca verde temporal 2,5 s),
  error por ingrediente (mensaje 3 s).
- ⚠️ **El cambio de ingrediente NO funciona.** Ver §4.

#### `/comidas` — «Mi comida» (validación por foto)
Ver §8 completo.

#### `/shopping` — Lista de la compra
- **Muestra:** ingredientes agregados del plan semanal, agrupados por **categoría de supermercado**
  (`toSupermarketOrder`), con cantidades optimizadas (`optimizeItems` consolida duplicados).
- **Acciones:** marcar/desmarcar comprado, **añadir artículos propios**, eliminar propios, limpiar marcados.
- **Persistencia:** lo marcado y los artículos propios se guardan **solo en el navegador**
  (`localStorage`, por semana y usuario). No viajan al servidor. `[C]`
- **Estados:** sin plan → invita a generar uno; cargando; lista vacía.

#### `/workouts` — Plan de entrenos
- **Muestra:** pestañas de los 7 días en rejilla, tipo de sesión, duración estimada, calentamiento,
  lista de ejercicios (series × reps, descanso, notas), enfriamiento.
- **Ejercicio:** abre detalle con GIF animado servido por el propio servidor (`/api/workoutx/gif/:id`);
  si no hay `exercise_id`, cae a búsqueda por nombre y a imágenes estáticas.
- **Registro de fuerza:** formulario para guardar peso y repeticiones por ejercicio y grupo muscular.
- **Compartir:** botón para generar una tarjeta de entreno compartible (imagen).
- **Días de descanso:** vista propia (`rest_recover`) con su propio botón de compartir.
- **Estados:** cargando, **sin plan → botón "Generar plan"**, generando, error, plan con ejercicios
  incompletos → aviso + botón "Nuevo plan". `[C]`

#### `/calendar` — Calendario
Ver §7 completo.

#### `/progress` — Progreso
- **Muestra:** gráfica de evolución del peso, distancia a la meta, estadísticas, y el **«paisaje muscular»**
  (montañas superpuestas por grupo muscular, selector de chips, análisis por subgrupos con consejo).
- **Acciones:** registrar peso de hoy (con campo opcional de anotaciones), seleccionar grupo muscular.
- **Estados:** sin registros → invita al primero; datos insuficientes para tendencia.

#### `/billing` — Facturación
- **Muestra:** estado de la suscripción, fin de la prueba.
- **Acciones:** iniciar prueba, suscribirse, **abrir el portal de Stripe** (tarjeta, facturas, cancelación).

#### `/profile` — Perfil
- **Muestra:** resumen de datos personales, objetivo, nutrición, entreno, historial de entrenos, progreso.
- **Acciones:** ir a editar, a facturación, a ajustes, cerrar sesión.

#### `/profile/edit` — Editar perfil
- Mismos campos del onboarding (datos, dieta, alergias, entreno). Sujeto al **enfriamiento de 24 h** (§3).

#### `/settings` — Ajustes
- **Apariencia:** selector de tema — **oscuro / claro / "melatonina"** (tres temas, `[C]`).
- **Idioma:** ES (España) / EN (United Kingdom).
- **Privacidad:** enlaces a la política y a los términos.
- **Exportar mis datos:** descarga un fichero (RGPD art. 20). Avisos de carga/éxito/error.
- **Eliminar cuenta:** diálogo destructivo que exige **escribir la palabra `ELIMINAR`** (o `DELETE` en
  inglés) antes de habilitar el botón.

#### Ruta no encontrada → `not-found`

### 1.4 Componentes con pantalla propia que aparecen por condición `[C]`

| Componente | Cuándo aparece |
|---|---|
| `TrialGate` | Envuelve `/workouts` y `/calendar`. Sin acceso, sustituye la pantalla por el muro de pago. **Inactivo en modo beta** (§3.1) |
| `UpgradeBanner` | Franja de aviso cuando la prueba se acerca al final |
| `HealthAlertBanner` | Aviso **no descartable** de salud (§3) |
| `WeeklyCheckin` | Modal semanal: pregunta por comidas, entrenos y energía. Se recuerda en `localStorage` |
| `ShareWorkoutCard` / `ShareProgressCard` | Generadores de tarjeta compartible (imagen) |
| `GenerationOverlay` | Mientras hay una mutación de generación en curso |

### 1.5 Compartir — es una función real y visible `[C]`

Tres botones de compartir repartidos por la app (entreno, día de descanso, progreso). Al pulsarlos:

1. Se **rasteriza la tarjeta a PNG** en el navegador.
2. Se intenta el **compartir nativo del sistema** (`navigator.share` con el fichero adjunto) — en móvil abre
   la hoja de compartir de iOS/Android.
3. Si el navegador no lo admite, **descarga el PNG**: `goaliq-entreno.png`, `goaliq-descanso.png`,
   `goaliq-progreso.png`.

Es la única vía de crecimiento orgánico del producto. Merece diseño propio en el rediseño.

### 1.6 Animaciones de ejercicio dibujadas a mano `[C]`

Cuando no hay GIF, la app **no muestra un hueco**: dibuja una **animación SVG propia** (`ExerciseAnimation`),
sin librerías externas, en verde lima. Hay **7 tipos de movimiento**: `squat`, `push`, `pull`, `hinge`,
`core`, `cardio` y `default`. Es un respaldo con carácter, no un marcador de posición.

---

## 2. FLUJOS COMPLETOS

### 2.1 Registro y acceso
1. Usuario pulsa acceder → se abre `AuthModal` en modo *login*.
2. Cambia a *registro*: pide **nombre, email, contraseña (mín. 6), código beta y consentimiento RGPD**.
3. El **código beta se valida en vivo** mientras se escribe (con retardo), contra `POST /api/beta/validate-code`
   (endpoint público). Se muestra válido/ inválido antes de enviar.
4. Al enviar: `supabase.auth.signUp` → si va bien, se reclama el código (`POST /api/beta/claim-code`) y se
   registra el consentimiento (`POST /api/consent`).
5. Login: `supabase.auth.signInWithPassword`.

### 2.2 Onboarding
7 pasos (§9). Al terminar: guarda el perfil y **lanza a la vez** la generación del plan de comidas y del de
entrenos; navega a `/` para que el usuario vea el `GenerationOverlay` sobre la app.

### 2.3 Generación del plan de comidas
- Se pide explícitamente. El servidor llama a Claude troceando la semana en **3 peticiones paralelas**.
- Estructura devuelta por comida: `meal_type`, `meal_name`, `ingredients[{name, amount, visual_ref, category}]`,
  `plate_distribution{protein,carbs,fat}` (suman 100), `calories_approx`, `notes`.
- Categorías válidas de ingrediente: `protein | carbs | vegetables | fats | dairy | fruit | other`.
- **5 comidas/día** (`breakfast, snack_morning, lunch, snack_afternoon, dinner`) o **3** según configuración.
  Los tentempiés son de 150–200 kcal y 2–4 ingredientes, y sus notas llevan consejo de horario.
- Idioma del contenido: español de España o inglés británico según el idioma activo.

### 2.4 Lista de la compra
**No se genera con IA.** Se calcula en el navegador a partir del plan de comidas: agrupa ingredientes,
consolida duplicados y los ordena por categoría de supermercado. `[C]`

### 2.5 Generación del plan de entrenos
- Se pide explícitamente. El servidor pasa a Claude un **pool cerrado de ejercicios reales** (§10) y le obliga
  a copiar `name` y `exercise_id` literalmente del pool, sin traducir.
- Estructura por día: `day_name`, `workout_type`, `duration_minutes`, `exercises[]`, `warmup`, `cooldown`, `notes`.
- Cada ejercicio: `name`, `exercise_id`, `muscles`, `sets`, `reps` (texto: `"10-12"` o `"45 seconds"`),
  `rest_seconds`, `notes` (consejo de técnica), `exercise_type` (`strength | bodyweight | timed | cardio`).

### 2.6 Registro de comida consumida
Ver §8.

### 2.7 Registro de fuerza (series, repeticiones y máximos)
Desde `/workouts`: se elige ejercicio y grupo muscular, se introduce peso y repeticiones, se guarda.
El sistema conserva el **máximo por ejercicio**. `/progress` lo agrega en el «paisaje muscular».

### 2.8 Cambio de preferencias y regeneración
Desde `/profile/edit`. Cambiar peso u objetivo cuenta para el enfriamiento (§3). Existen textos que anuncian
regeneración automática al guardar, pero **están huérfanos** (§14) — no hay pantalla que los use.

### 2.9 Fotos de plato generadas
- Al pintar cada tarjeta de plato, la app pide su foto. Si está en la caché compartida, aparece al instante
  con un fundido; si no, se genera con Gemini (~20 s) y se guarda para todos los usuarios.
- **Respaldo permanente:** círculo con las iniciales del plato. Nunca se ve un hueco roto.
- Tope diario de generaciones por usuario (§3).

### 2.10 Suscripción y pago
Ver §12.

### 2.11 Idiomas ES/EN
Selector en `/settings` y en la pestaña de ajustes de `/vision`. Cambia toda la interfaz (574 textos) y
**también el idioma en que la IA redacta los planes**.

### 2.12 Instalación como PWA
Ver §11.

---

## 3. REGLAS DE NEGOCIO VISIBLES

| Regla | Valor | Dónde se ve |
|---|---|---|
| **Prueba gratuita** | **3 días**, exige tarjeta | Muro de pago, precios, facturación |
| **Segunda prueba** | Prohibida. Quien ya la gastó, se resuscribe sin prueba | Textos de re-suscripción |
| **Peticiones a la IA** | 3 por minuto y **10 por hora** por usuario | Error `rate_limit_exceeded` |
| **Fotos de plato** | 60 peticiones/min y **40 generaciones/día** por usuario | Sin foto → iniciales |
| **Enfriamiento de perfil** | **2 cambios** de peso u objetivo en **24 h**; el 3.º se bloquea | Al guardar el perfil |
| **Flex Days** | **1 por semana**. Aviso al superar **4 al mes** | Avisos en el calendario |
| **Cribado de salud** | 8 condiciones **bloquean** el registro | Paso 0 del onboarding |
| **Alergias graves** | No bloquean: exigen marcar una casilla de conocimiento | Paso 0 |
| **Aviso IMC × objetivo** | Matriz que da tono normal / **precaución (ámbar)** / **peligro (rojo)** | Paso 2 y banner |
| **Aviso de deriva de peso** | Si el peso registrado se aleja del perfil, banner **no descartable** | Cualquier pantalla |
| **Umbrales de la foto de comida** | coincide ≥80 · parcial 40–79 · no coincide <40 | Resultado del análisis |
| **Anti-bucle de fotos** | Tras 3 fallos con un plato, no se reintenta ni se gasta | Interno |

### 3.1 🔴 MODO BETA — la regla que lo cambia todo (y que casi se nos escapa)

`src/lib/beta.ts:13` define `isBetaMode()`, que lee la variable `VITE_BETA_MODE`.
**Si la variable no existe, devuelve `true`** («por seguridad», dice el propio comentario).
**Esa variable no está definida en ninguna parte del repositorio** — ni en `.replit`, ni en los `.env`.

**Conclusión: la app está HOY en modo beta, también en producción.** Y en modo beta:

- **El muro de pago no bloquea nada.** `AppLayout.tsx:382` calcula
  `isLocked = gated && !hasAccess && !isBetaMode()` → siempre falso.
- **Toda la interfaz de prueba y facturación se oculta**: los avisos de días restantes, la insignia de
  suscripción y los enlaces de pago del menú están envueltos en `!isBetaMode()`.
- Las pantallas `/pricing` y `/billing` **siguen siendo alcanzables escribiendo la URL**, pero nada de la
  navegación lleva a ellas.

**Para quien rediseñe:** hay que decidir de forma explícita si el prototipo se dibuja en **modo beta**
(todo abierto, sin precios) o en **modo comercial** (con muro de pago). Son dos productos distintos.

### 3.2 Qué bloquea el muro cuando el modo beta se apaga

`GATED_ROUTES` = `/meals`, `/comidas`, `/shopping`, `/workouts`, `/calendar`, `/progress`.
Es decir, **6 de las 7 secciones**. Solo `/dashboard` queda libre. Los enlaces bloqueados se muestran en el
menú con aspecto de bloqueado, no desaparecen.

**Qué pasa al fallar un día:** no hay penalización. El día queda sin marcar, baja el porcentaje de
adherencia del mes y se rompe la racha. El usuario puede marcarlo como **Flex Day** (una vez por semana)
para señalar que fue una licencia deliberada.

---

## 4. ROTO O A MEDIAS HOY

Cruzado con `ESTADO.md`.

| Qué | Estado real | Veredicto |
|---|---|---|
| **Cambiar ingrediente** (`/meals`) | **Falla el 100 % de las veces.** El servidor exige un campo `mealId` que el navegador nunca envía; responde 500. El usuario ve *"Swap failed"* y reintenta en vano | **ARREGLAR ANTES** — la función es buena, el contrato está roto |
| **Regeneración automática de entrenos** | Abrir `/workouts` disparaba una generación de IA sin pedirla | **NO HEREDAR.** Ya corregido en `feature/cerrar-fugas-ia` |
| **Tope de fotos de plato** | El endpoint permitía 100 imágenes de Gemini por minuto | Ya corregido en la misma rama |
| **Rutas `/test-*`** | Experimentos 3D. Meten three.js y GSAP en el paquete principal (2,7 MB) | **NO HEREDAR** |
| **App antigua vs `/vision`** | Dos interfaces completas conviviendo. La hoja de ruta prevé retirar la antigua | **NO HEREDAR la antigua.** Reconstruir sobre el lenguaje de `/vision` |
| **`src/data.ts`** | Datos de muestra que ya **no importa nadie** | No heredar como código; **sí usarlo como mock** (§5) |
| **Recuperación de contraseña** | **NO EXISTE.** Ni "olvidé mi contraseña", ni enlace mágico, ni OTP | **ARREGLAR ANTES** — un usuario que pierda la contraseña pierde la cuenta `[X→verificado]` |
| **Términos vs precio** | Los términos dicen que la beta es **gratuita**; la app cobra 19,99 €/mes | **ARREGLAR ANTES** (§13) `[X→verificado]` |
| **Sin conexión** | Hay manifest de PWA pero **ningún service worker propio**: la app **no funciona sin conexión** | Decidir en el rediseño (§11) |
| **Recordatorios de suplementos** | El interruptor se guarda **solo en el navegador**. El código dice `TODO (Phase 2): real call` | **NO HEREDAR como si funcionara** |
| **155 textos huérfanos** | Funciones redactadas y nunca conectadas | Ver §14 — mina de funciones olvidadas |
| **Consentimiento de cookies** | La política las menciona, pero **no hay banner ni control** | **ARREGLAR ANTES** (§13) |

---

## 5. DATOS DE EJEMPLO REALES (mock fiel)

Extraídos de `src/data.ts` (huérfano en el código, perfectos como maqueta).

### Un día de comidas

| Comida | Hora | kcal | Ingredientes | Preparación |
|---|---|---|---|---|
| **Yogur griego con frutos rojos** (Desayuno) | 08:30 | 320 | 200 g yogur griego natural · 60 g frambuesas · 50 g arándanos · 20 g nueces · 15 g miel · 10 g copos de avena | Pon el yogur en un bol · Reparte los frutos rojos y las nueces · Riega con miel y espolvorea la avena |
| **Bowl de pollo y arroz** (Comida) | 13:00 | 640 | 150 g pechuga de pollo · 120 g arroz cocido · 80 g brócoli · 10 ml aceite de oliva · 1 diente de ajo · sal y pimienta | Cocina el arroz · Saltea el pollo con ajo, sal y pimienta · Cuece el brócoli al vapor · Monta el bol y aliña |
| **Batido de proteína** (Snack) | 16:30 | 220 | 250 ml leche desnatada · 30 g proteína de suero (cacao) · 1 plátano · 5 g cacao puro · hielo | Añade todo a la batidora · Bate 30 s hasta que espume |
| **Salmón con verduras** (Cena) | 20:00 | 520 | 160 g salmón fresco · 100 g espárragos verdes · 80 g coles de Bruselas · 60 g brócoli · 10 ml aceite de oliva · ½ limón · eneldo fresco · sal | Precalienta el horno a 200 °C · Coloca salmón y verduras en la bandeja · Aliña con aceite, limón y eneldo · Hornea 15–18 min |

**Totales del día:** 1.480 / 2.200 kcal · Proteína 112/165 g · Carbos 148/240 g · Grasas 44/70 g.

### Un día de entreno completo

**Tren Superior · Fuerza** — Pecho · Hombros · Tríceps — 52 min — 410 kcal

| # | Ejercicio | Series | Reps | Músculo | Consejo |
|---|---|---|---|---|---|
| 1 | Press banca con barra | 4 | 8–10 | Pecho | Baja controlado hasta rozar el pecho, codos a ~45° del torso; empuja sin rebotar |
| 2 | Press militar | 3 | 10 | Hombros | Core y glúteos firmes; sube la barra sin arquear la zona lumbar |
| 3 | Press inclinado mancuernas | 3 | 12 | Pecho | Banco a 30°; baja hasta notar estiramiento y sube sin chocar las mancuernas |
| 4 | Elevaciones laterales | 3 | 15 | Hombros | Sube hasta la altura del hombro, codos algo flexionados; sin impulso ni balanceo |
| 5 | Extensión de tríceps en polea | 3 | 12–15 | Tríceps | Codos pegados al cuerpo; extiende del todo y controla la vuelta |

### Progreso (paisaje muscular) — Semana 4, 81 series totales

| Grupo | Series | Subgrupos |
|---|---:|---|
| Pecho | 22 | Medio 9 (41%) · Superior 9 (41%) · Inferior 4 (18%) |
| Piernas | 18 | Cuádriceps 5 (28%) · Pantorrillas 5 (28%) · Femorales 4 (22%) · Glúteos 4 (22%) |
| Espalda | 14 | Dorsal ancho 7 (50%) · Trapecio 4 (29%) · Lumbar 3 (21%) |
| Hombros | 12 | Anterior / Lateral / Posterior 4 cada uno (33%) |
| Brazos | 9 | Tríceps 6 (67%) · Bíceps 3 (33%) |
| Core | 6 | Abdominales 3 (50%) · Oblicuos 3 (50%) |

**Estadísticas:** Peso 82.1 kg (−0.3) · Grasa corporal 16.8% (−0.6) · Masa magra 68.5 kg (+0.4) ·
Entrenos 12/mes (+3). Meta: 78 kg.
**Serie de peso:** 10/06 → 83.6 · 17/06 → 83.2 · 24/06 → 82.8 · 01/07 → 82.4 · 08/07 → 82.1.

---

## 6. AUTENTICACIÓN Y CUENTA

| Función | Estado |
|---|---|
| **Registro** | Email + contraseña (mín. 6) + nombre + **código beta** + consentimiento RGPD |
| **Login** | Email + contraseña |
| **Google / Apple / OAuth** | **NO EXISTE.** `[X→descartado]` Codex sugirió que "puede haber Google según Supabase"; en el código solo hay `signUp` y `signInWithPassword` |
| **Enlace mágico / OTP** | NO EXISTE |
| **Recuperar contraseña** | **NO EXISTE** — sin recuperación, la cuenta se pierde |
| **Cerrar sesión** | Sí, desde ajustes y perfil. También desconecta al usuario de OneSignal |
| **Exportar mis datos** | Sí (RGPD art. 20). Descarga un fichero |
| **Borrar cuenta** | Sí (RGPD art. 17). Doble confirmación: escribir `ELIMINAR`/`DELETE` **y** enviar la palabra clave `DELETE_MY_ACCOUNT` |

**Consecuencias del borrado:** la cuenta y sus datos se borran en cascada, y queda un **registro de auditoría
inmutable** en `deletion_logs` (tabla sin política de borrado: ni el usuario ni la app pueden eliminarlo).
⚠️ `[X→verificado]` **No hay nada visible en la interfaz que diga si se cancela la suscripción de Stripe al
borrar la cuenta.** Va a Dudas (§17).

**Sin sesión se puede:** ver `/`, `/pricing`, `/privacy`, `/terms`, las rutas `/test-*`, y la **puerta** de
`/vision` (que pide iniciar sesión). Todo lo demás exige cuenta.

---

## 7. CALENDARIO (`/calendar`)

Protegido por el muro de pago (`TrialGate`).

- **Vista:** rejilla mensual, con navegación mes anterior / mes siguiente.
- **Cuatro contadores arriba:** Entrenos del mes · **Adherencia %** (verde ≥80, naranja ≥50, rojo por debajo) ·
  **Racha 🔥** · **Flex Days** (gris 0, ámbar 1–4, rojo >4).
- **Frase motivadora según adherencia:** 100% 🏆 · ≥80% 🔥 · ≥60% 💪 · ≥40% 🎯 · algo 🌱 · nada 🌅.
- **Leyenda de colores:** Completado · Flex Day · Flex (+límite) · Historial (+30 días) · Racha activa.
- **Acciones:** pulsar un día de entreno para marcarlo completado; pulsar 😋 para marcar **Flex Day**;
  abrir el detalle de un entreno del historial en un modal (tipo, ejercicios, series×reps, descansos,
  duración y **botón de compartir**).
- **De dónde salen los eventos:** plan de entrenos, historial de entrenos registrados, registros de progreso
  y días flex.
- **Avisos:** *"Ya tienes un Flex Day esta semana"* / *"Solo puedes marcar un Flex Day por semana"* /
  *"Ya tienes {n} Flex Days este mes — ¡cuidado con excederte!"*.

---

## 8. «MI COMIDA» (`/comidas`) — validación por foto

Es la función diferencial del producto y **es distinta del plan de comidas**:

| | `/meals` — Plan | `/comidas` — Mi comida |
|---|---|---|
| Qué es | Lo que **deberías** comer | Lo que **has** comido de verdad |
| Origen | Generado por Claude | Foto que hace el usuario |
| Persistencia | `meal_plans` | `meal_logs` |

**Flujo completo:**
1. **Fase inicial:** invita a fotografiar la comida. Botón que abre el selector de archivo con
   `accept="image/*"` y `capture="environment"` → en móvil **abre la cámara trasera directamente**.
2. **Fase «capturando»:** vista previa de la foto, con opción de **repetir la foto** o **analizar**.
3. **Análisis:** envía la imagen a `POST /api/meals/validate`, que la pasa a **Claude con visión** junto con
   la comida esperada y sus ingredientes.
4. **Resultado:** porcentaje de coincidencia en grande, con un color según el estado:
   - **coincide** (≥80): validación limpia.
   - **parcial** (40–79) / **no coincide** (<40): muestra los **ingredientes detectados** y un
     **comentario entrecomillado** de la IA.
5. **Acciones finales:** **registrar** la comida (guarda en `meal_logs` con porcentaje, estado,
   ingredientes detectados y comentario, y refresca el aro de consumo real) o **reintentar**.

**Nota:** el plan actual no trae macros por comida, así que al registrar se guardan **calorías pero
proteína, carbohidratos y grasas van vacíos**. `[C]`

`[X→descartado]` Codex afirmó que esta pantalla tiene una **cuota diaria de fotos** y un **historial**.
Ninguna de las dos existe: la cuota de 40/día es de **generación de imágenes de plato** (otra cosa), y aquí
no hay listado de comidas pasadas.

---

## 9. ONBOARDING EXHAUSTIVO

**7 pasos:** `salud` → `sobre-ti` → `objetivo` → `dieta` → `entrenamiento` → `suplementos` → `resumen`.
Barra de progreso segmentada + etiqueta "Paso N de 7". Botón atrás desde el paso 3 en adelante.

### Paso 0 — Cribado de salud
Nueve casillas. Las **ocho primeras bloquean** el registro:

| Clave | Texto en español | ¿Bloquea? |
|---|---|---|
| `pregnancy_lactation` | Estoy embarazada o en periodo de lactancia | **Sí** |
| `eating_disorder` | Tengo o he tenido un trastorno alimentario | **Sí** |
| `diabetes` | Tengo diabetes (tipo 1 o 2) | **Sí** |
| `cardiovascular` | Tengo una condición cardiovascular diagnosticada | **Sí** |
| `kidney_liver` | Tengo problemas renales o hepáticos | **Sí** |
| `on_medication` | Estoy bajo medicación que afecta a alimentación o ejercicio | **Sí** |
| `physical_limitations` | Tengo lesiones o limitaciones físicas significativas | **Sí** |
| `minor_age` | Soy menor de 18 años | **Sí** |
| `severe_allergies` | Tengo alergias o intolerancias graves | No — exige marcar conocimiento |

Al bloquear, se deriva al usuario a un profesional, con enlace real al
**Consejo General de Dietistas-Nutricionistas de España**
(`consejodietistasnutricionistas.com/encuentra-tu-dietista-nutricionista/`).

### Paso 1 — Sobre ti

| Campo | Tipo | Por defecto | Validación |
|---|---|---|---|
| `displayName` | texto | vacío | 1–100 caracteres |
| `age` | número | 30 | **18–80** |
| `sex` | opción | `male` | `male` · `female` · `other` |
| `heightCm` | número | 170 | **120–220** |
| `weightKg` | número | 70 | **35–250** |

### Paso 2 — Objetivo

| Campo | Opciones |
|---|---|
| `goalType` | `lose_fat` (Perder grasa) · `maintain` (Mantener) · `gain_muscle` (Ganar músculo) · `recomposition` (Recomposición) |
| `targetWeightKg` | 35–250, opcional |
| `goalPace` | `gentle` · `moderate` (recomendado) · `aggressive` — **las etiquetas cambian según el objetivo** |

**Etiquetas del ritmo, literales:**

- **Perder grasa:** Suave (−0,25 kg/sem · déficit 250 kcal · «Preserva más músculo, ideal para atletas») ·
  Moderado (−0,5 kg/sem · déficit 500 kcal · «El ritmo más sostenible a largo plazo») ·
  Agresivo (−1 kg/sem · déficit 1000 kcal · «Pérdida rápida, requiere mayor disciplina»).
- **Ganar músculo:** Volumen limpio (+0,25 kg/sem) · Volumen moderado (+0,5 kg/sem) · Volumen agresivo (+1 kg/sem).
- **Recomposición:** Conservador · Estándar (ciclado de calorías, alta proteína) · Intensivo (ciclado agresivo, proteína ≥2 g/kg).
- **Mantener:** no tiene ritmos.

Aquí se calcula el **IMC** y se cruza con el objetivo en una matriz que decide el tono del aviso
(normal / precaución ámbar / peligro rojo). Con tono de precaución o peligro, hay que marcar **dos casillas**
para poder continuar. Si el usuario es de edad avanzada, otras dos casillas adicionales.

### Paso 3 — Tu dieta

| Campo | Opciones exactas |
|---|---|
| `dietType` | `balanced` · `mediterranean` · `keto` · `vegan` · `vegetarian` · `high_protein` · `gluten_free` |
| `allergies` | lista libre de textos |
| `likedFoods` | lista libre de textos |
| `dislikedFoods` | lista libre de textos |
| `fastingProtocol` | opcional, se activa con un interruptor: `12:12` · `16:8` · `18:6` · `20:4` · `5:2` |

El ayuno muestra **consejos cruzados con el tipo de dieta** (p. ej. *"Keto + 16:8 es la combinación más
potente para cetosis"*, *"Mediterránea + 16:8: comida principal al mediodía rica en legumbres y pescado"*).

### Paso 4 — Entrenamiento

| Campo | Opciones |
|---|---|
| `trainingLevel` | `beginner` · `intermediate` · `advanced` |
| `trainingLocation` | `gym` · `home` · `outdoor` |
| `trainingDaysPerWeek` | **1–7** |

⚠️ `[X→descartado]` Codex incluyó campos de *duración/hora de entreno, material, lesiones, presupuesto,
tiempo de cocina, equipamiento de cocina y comidas por día*. **Ninguno existe** — el formulario real
(`EMPTY_FORM` en `Onboarding.tsx:29` y el esquema del servidor) tiene exactamente los campos de esta tabla.
La hoja de ruta sí prevé añadir modalidad y equipamiento, pero **hoy no está**.

### Paso 5 — Suplementos
Catálogo de **14 suplementos**, cada uno con emoji, nombre y descripción corta:

Proteína en polvo 🥛 · Creatina ⚡ · Vitamina D ☀️ · Magnesio 🌙 · Omega 3 🐟 · Vitamina C 🍊 ·
Zinc 🔩 · Hierro 🩸 · Colágeno 💪 · Vitamina B complejo ⚗️ · Calcio 🦴 · Vitamina A 👁️ ·
Vitamina E 🛡️ · Cafeína ☕

Por cada suplemento elegido: **variante** (p. ej. creatina → Monohidrato / HCl / Kre-Alkalyn / Etil éster;
proteína → Whey concentrada / Whey isolada / Vegana / Caseína), **momento de toma** y **hora de aviso**
(formato `HH:MM`).

### Paso 6 — Resumen
"Esto es lo que crearemos". Botón final que guarda y lanza ambas generaciones.

---

## 10. FUENTES DE DATOS EXTERNAS

| Fuente | Para qué | Visible para el usuario |
|---|---|---|
| **WorkoutX** (`api.workoutxapp.com/v1`) | Base de ejercicios y **GIFs animados**. Se cachea en la base de datos y se sirve desde el propio servidor (`/api/workoutx/gif/:id`), nunca directamente | Sí — los GIFs de cada ejercicio |
| **wger** (`wger.de/api/v2`) | Búsqueda de ejercicios por músculo e idioma | Sí — buscador de ejercicios |
| **free-exercise-db** (GitHub `yuhonas/free-exercise-db`) | Imágenes estáticas de ejercicio como respaldo | Sí — cuando no hay GIF |
| **Anthropic Claude** | Genera planes de comidas y entrenos; **analiza la foto de la comida** | Sí, indirectamente |
| **Google Gemini** (`gemini-2.5-flash-image`) | Genera las fotos de los platos | Sí — las fotos |
| **Spoonacular** | Receta aleatoria | **No** — el endpoint existe pero ninguna pantalla lo llama |
| **OneSignal** | SDK de notificaciones push, cargado desde su CDN | Ver §11 |
| **Google Fonts** | Barlow Condensed + Plus Jakarta Sans | Sí — tipografías |

⚠️ **Licencias — no verificado.** No hay ningún fichero de licencias ni atribución en el repositorio.
`free-exercise-db` es público en GitHub; **WorkoutX es una API de pago con clave** y no consta en el código
qué permite su licencia respecto a mostrar y cachear sus GIFs. **Hay que aclararlo antes de publicar.** →Dudas.

---

## 11. PWA Y OFFLINE

**Lo que sí hay:**
- `public/manifest.json`: nombre *GoalIQ*, `display: standalone`, `orientation: portrait`, `lang: es`,
  categorías `health, fitness, food`, `start_url: /`, colores `#F4F4F4`.
- Metaetiquetas de iOS: `apple-mobile-web-app-capable`, barra de estado `black-translucent`, título *GoalIQ*.
- Icono e icono de pantalla de inicio.
- **Tema aplicado antes de pintar:** un script en el `<head>` lee `goaliq-theme` de `localStorage` y aplica
  `theme-dark` / `theme-light` / `theme-melatonina` para evitar el parpadeo blanco. `[C]`

**Lo que NO hay:**
- ❌ **Ningún service worker propio.** No hay `registerServiceWorker` en ninguna parte.
  → **La app NO funciona sin conexión.** Es "instalable", no "offline".
- ❌ **Ningún aviso de instalación propio.** No se usa `beforeinstallprompt`. La instalación depende
  enteramente del menú del navegador. `[X→verificado]`
- ⚠️ **Incoherencia de color:** `index.html` declara `theme-color: #0A0A0A` (negro, de la app antigua)
  y el manifest `#F4F4F4` (beige, de `/vision`). `[C]`
- ⚠️ Los dos iconos del manifest (192 y 512) **apuntan al mismo fichero**. `[C]`

**Notificaciones push:**
- OneSignal se carga desde CDN y se inicializa con `appId 529e4cd6-308d-4161-98be-22faea476b79`.
  El botón nativo está desactivado (`notifyButton.enable: false`).
- Al iniciar sesión se identifica al usuario en OneSignal; al cerrarla se le desconecta.
- **Pero los recordatorios de suplementos son solo locales**: el interruptor se guarda en `localStorage` y
  el código deja escrito el hueco pendiente — *"Phase 2 seam: push the schedule to the backend / OneSignal"*.
  **Ningún aviso llega realmente.** `[C+X]`

---

## 12. STRIPE AL DETALLE

| Concepto | Valor |
|---|---|
| **Producto** | Suscripción única, mensual |
| **Precio mostrado** | **€19.99 / mes** |
| **Identificador de precio** | `price_1TFYJVAC9aQrlGDtdvlFPtjX` (el mismo en frontend y backend) |
| **Prueba gratuita** | **3 días** |
| **Tarjeta** | **Siempre obligatoria**, también durante la prueba, para poder cobrar al terminar |
| **Segunda prueba** | Bloqueada. A quien ya la gastó no se le ofrece, y Stripe deja de mostrar el texto de prueba |
| **Estados** | `trialing` · `active` · `past_due` · `canceled` · `inactive` |
| **Cancelación** | A través del **portal de Stripe** (`POST /api/portal`), no desde la app |

**Pantallas donde aparece:**
- `/pricing`: precio y llamada a la acción.
- `/billing`: estado, fin de la prueba, botón al portal.
- `/checkout/success`: confirmación tras el pago.
- `TrialGate`: sustituye `/workouts` y `/calendar` por el muro de pago, con **5 ventajas** listadas
  (`trial_feat_1`…`trial_feat_5`) y contador de días restantes.
- `UpgradeBanner`: franja de aviso.

**Textos clave (todos existen y se usan vía `useTrialCopy`):**
*"PRUEBA GRATIS 3 DÍAS"* · *"0€ durante tu prueba de 3 días · Cancela cuando quieras"* ·
*"Gratis 3 días, luego 19,99€/mes · Cancela cuando quieras"* · *"Tu prueba gratuita termina hoy"* ·
*"Gestionado por Stripe · Sin cargo durante la prueba"* · *"Tu pago está pendiente. Actualiza tu método de pago"*.

**Qué pasa al expirar:** se pierde el acceso a las pantallas protegidas por el muro; los textos hablan de
*"conservar tu plan orientativo y progreso"*, lo que sugiere que los datos se guardan pero no se ven.

---

## 13. LEGAL

### Lo que existe

| Documento | Dónde | Contenido |
|---|---|---|
| **Política de privacidad** | `/privacy` | 9 apartados. Derechos RGPD (acceso, rectificación, **supresión art. 17**, portabilidad). **§9 Cookies**: declara solo cookies técnicas de sesión |
| **Términos** | `/terms` | Beta privada, versión 1.0 de 30/05/2026. Responsable nombrado. Servicio "tal cual". Derecho a terminar la beta con 30 días de aviso |
| **Consentimiento de registro** | Modal de acceso | Casilla obligatoria antes de crear la cuenta; se registra en `POST /api/consent` |
| **Consulta del consentimiento** | `GET /api/consent` | El usuario puede saber qué firmó |
| **Exportación (art. 20)** | `/settings` | Descarga de datos |
| **Borrado (art. 17)** | `/settings` | Con doble confirmación y registro de auditoría |
| **Aviso de no ser consejo médico** | Onboarding | Derivación a profesional colegiado al bloquear |

### Lo que FALTA — importante, se tratan datos de salud

| Falta | Gravedad | Por qué importa |
|---|---|---|
| **Banner de cookies / control granular** | 🔴 Alta | La política las menciona pero el usuario nunca puede aceptarlas ni rechazarlas |
| **Contradicción términos ↔ precio** | 🟡 Media *(rebajada tras verificar)* | Los términos dicen **"Gratuita durante toda la fase beta"** y la app tiene montado un cobro de **19,99 €/mes**. **Pero el modo beta está activo (§3.1), así que hoy el usuario no ve precios ni se le cobra** — la navegación no lleva a `/pricing` ni a `/billing`. La contradicción es real pero **latente**: estalla el día que se apague el modo beta sin actualizar los términos. `[X→verificado y matizado]` |
| **Recuperación de contraseña** | 🔴 Alta | Sin ella, perder la contraseña equivale a perder el acceso a los propios datos de salud — choca con el derecho de acceso |
| **Consentimiento explícito y separado para datos de SALUD** | 🔴 Alta | El RGPD trata la salud como **categoría especial (art. 9)**: exige consentimiento explícito y diferenciado, no una casilla general de términos |
| **Aviso legal / identificación del responsable en su propia página** | 🟡 Media | Solo aparece dentro de los términos |
| **Política de conservación de datos** | 🟡 Media | No se dice cuánto tiempo se guarda nada |
| **Encargados del tratamiento y transferencias internacionales** | 🟡 Media | Los datos de salud pasan por Anthropic, Google, Supabase, Stripe y OneSignal (varios fuera de la UE). No se declara |
| **Registro de versión de los términos aceptados** | 🟡 Media | Los términos dicen "Versión 1.0", pero no consta que se guarde qué versión firmó cada usuario |

---

## 14. APÉNDICE DE TEXTOS — el censo real de lo que la app puede decir

`src/lib/language.tsx` contiene **574 claves en español** (y sus equivalentes en inglés).

### 14.1 Agrupación por pantalla (prefijos)

| Prefijo | Nº | Pantalla / uso |
|---|---:|---|
| `tc_` | 43 | Prueba y suscripción (vía `useTrialCopy`) |
| `fb_` | 29 | Mensajes de feedback / motivación |
| `no_` | 21 | Estados vacíos ("sin plan", "sin comidas"…) |
| `delete_` | 17 | Borrado de cuenta y su diálogo |
| `pricing_` | 15 | Precios |
| `view_` | 13 | Enlaces "ver…" |
| `trial_` | 13 | Muro de pago |
| `wt_` | 11 | Tipos de entreno (push, pull, legs, core, cardio…) |
| `flex_` | 10 | Flex Days |
| `adherence_` | 10 | Adherencia del calendario |
| `log_` | 9 | Registro de peso |
| `rest_` | 8 | Descansos y días de descanso |
| `nav_` | 8 | Navegación |
| `eq_` | 8 | Equipamiento |
| `day_` | 8 | Días de la semana |
| `pg_` | 7 | **Guía del plato** (½ plato verduras, ¼ proteína, ¼ carbos…) |
| `muscle_` | 7 | Grupos musculares |
| `diet_` | 7 | Tipos de dieta |
| `onboarding_` | 6 | Onboarding |
| `goal_` | 6 | Objetivos |
| `export_` | 6 | Exportación de datos |

### 14.2 ⚠️ 155 claves HUÉRFANAS — funciones escritas y nunca conectadas

De las 574, **155 no las usa ninguna pantalla**. No son basura: son **funciones pensadas, redactadas y
abandonadas**. Para el rediseño son una mina de intenciones. Las agrupo por lo que revelan:

**Una «Guía del plato» completa que nadie muestra** (7 claves)
`plate_guide` "Guía del plato" · `pg_vegetables` "½ plato" · `pg_protein` "¼ plato" · `pg_carbs` "¼ plato" ·
`pg_fats` "pequeña cantidad" · `pg_dairy` "porción pequeña" · `pg_fruit` "porción pequeña" · `pg_other` "al gusto".
→ Había una función educativa de proporciones visuales del plato. **No existe en ninguna pantalla.**

**Un panel de Flex Days que no se construyó**
`flex_day_tracker` "Registro Flex Day" · `flex_month_count` "{{n}} / 4 este mes" ·
`flex_none_msg` "Sin flex days este mes — ¡gran disciplina!" · `flex_used_msg` · `flex_days_across` ·
`flex_limit_exceeded` "Has superado el límite recomendado".
→ El calendario solo enseña un contador; esto era una pantalla propia.

**Mensajes de progreso y peso muy trabajados** (~25 claves)
`goal_reached` "🎉 ¡Objetivo alcanzado!" · `goal_hit_congrats` · `kg_to_go` · `kg_to_goal_almost` ·
`kg_to_goal_over` · `trending_right` · `down_kg_progress` · `up_kg_from_start` · `weight_stable` ·
`normal_muscle_gain` "Esto es normal — el aumento de músculo puede verse como aumento de peso…" ·
`clean_weeks` · `keep_logging` · `consistency_logging` · `not_enough_data` · `press_plus` "Pulsa + para guardar tu peso".
→ Todo un sistema de acompañamiento emocional, redactado y sin usar.

**Regeneración automática al guardar preferencias**
`saving_regenerating` "Guardando y regenerando…" · `updating_preferences_msg` "…tu plan de comidas se
regenerará automáticamente al guardar" · `new_plan_30s` · `new_workout_plan_30s` · `new_both_plans_30s` ·
`workout_plan_updated`.
→ Anuncian un comportamiento que hoy **no ocurre**.

**Cambio de ingrediente** (la función rota del §4)
`replace_ingredient` "Cambiar ingrediente" · `swap_failed` · `could_not_load_swaps` · `no_suitable_alts`.

**Enlaces de navegación que no están**
`view_all_meals` "Ver todas las comidas →" · `view_full_list` · `view_full_plan` · `view_workout` ·
`view_my_workouts` · `view_plan` · `view_example` "Ver ejemplo".

**Vocabulario básico duplicado o sin conectar**
`greeting_morning/afternoon/evening` · `diet_*` (los 5 tipos de dieta) · `fitness_beginner/intermediate/advanced` ·
`goal_lose_fat/build_muscle/stay_fit` · `muscle_group_*` (6) · `lang_spanish/english` · `save_btn` ·
`cancel_btn` · `continue_btn` · `generate_btn` · `start_workout` "Empezar entreno" ·
`mark_as_done` "Marcar como hecho" · `select_muscle` · `strength_progress` · `recent_entries` ·
`weekly_menu` · `weekly_training` · `todays_meals` · `rest_day` · `planned_workout` ·
`tap_workout_hint` (la ayuda que explica cómo usar el calendario).

> **Conclusión para el rediseño:** hay al menos **cuatro funciones completas** especificadas solo en el
> fichero de textos (guía del plato, panel de Flex Days, acompañamiento de progreso y regeneración
> automática). Decide si las quieres antes de dibujar nada.

---

## 15. MAPA PANTALLA → ENDPOINTS

| Pantalla | Endpoints del API | Acceso directo a Supabase |
|---|---|---|
| `/` Landing | — | sesión |
| `/pricing` | `GET /api/subscription`, `POST /api/checkout`, `POST /api/portal` | — |
| `/checkout/success` | `GET /api/checkout/verify` | — |
| `/onboarding` | `POST /api/consent`, `POST /api/onboarding`, `POST /api/meals`, `POST /api/workouts` | `profiles`, `food_preferences` |
| `AuthModal` | `POST /api/beta/validate-code`, `POST /api/beta/claim-code` | `auth.signUp`, `auth.signInWithPassword` |
| `/dashboard` | `GET /api/meals`, `GET /api/workouts`, `GET /api/flex-days`, `GET /api/subscription` | `profiles`, `progress_logs`, `workout_plans` |
| `/meals` | `GET /api/meals`, `POST /api/meals`, `POST /api/meals/replace-ingredient` ⚠️roto | `profiles`, `food_preferences`, `ingredient_swaps` |
| `/comidas` | `POST /api/meals/validate`, `POST /api/meals/log` | — |
| `/shopping` | `GET /api/meals` (indirecto) | — (marcados y extras en `localStorage`) |
| `/workouts` | `GET /api/workouts`, `POST /api/workouts`, `GET /api/strength`, `POST /api/strength`, `GET /api/workoutx/exercise`, `GET /api/workoutx/gif/:id` | — |
| `/calendar` | `GET/POST /api/flex-days`, `GET/POST /api/workout-history`, `GET /api/workouts` | `progress_logs` |
| `/progress` | `GET /api/strength/group`, `GET /api/strength/groups`, `GET /api/strength/muscles` | `progress_logs`, `profiles`, `workout_plans` |
| `/billing` | `GET /api/subscription`, `POST /api/checkout`, `POST /api/portal` | — |
| `/profile` | `GET /api/subscription`, `GET /api/workout-history` | `profiles`, `progress_logs` |
| `/profile/edit` | `PATCH /api/profile` | `profiles`, `food_preferences` |
| `/settings` | `GET /api/export-data`, `DELETE /api/account` | sesión |
| `/vision` (todas) | `GET /api/meals`, `GET /api/workouts`, `GET /api/meals/log`, `POST /api/dish-image`, `GET /api/strength/*`, `GET /api/progress` | `profiles`, `food_preferences` (suplementos) |
| `HealthAlertBanner` | — | `profiles`, `progress_logs` |
| `ExerciseAnimation` | `GET /api/exercises/gif`, `GET /api/exercises/search` | — |

**Endpoints del servidor que NINGUNA pantalla llama:** `POST /api/diets/generate` ·
`GET /api/recipes/random` · `POST /api/diets/visualize` · `GET /api/exercises/wger` ·
`GET /api/workoutx/by-location` · `GET /api/workoutx/equipment` · `GET /api/workoutx/muscle`.

---

## 16. INTERNO — no reconstruir en el prototipo

| Endpoint | Para qué |
|---|---|
| `GET /api/healthz` y `GET /api/` | Comprobación de vida del servidor |
| `GET /api/dish-image/diagnose` | Diagnóstico: qué variables ve el servidor (sí/no, nunca el valor), esquema real de la tabla y conteo por estado |
| `GET /api/dish-image/inspect-plan` | Inspecciona cada plato del plan del usuario: descripción, prompt, clave de caché y colisiones |
| `POST /api/dish-image/reset` | Levanta el veto anti-bucle de un plato |
| `GET /api/stripe/debug` | Depuración de Stripe (limitado a 5/min) |
| `GET /api/workoutx/sync-status` | Estado de la caché de ejercicios |
| `POST /api/workoutx/force-sync` | Fuerza la resincronización (limitado a 2/min) |
| `GET /api/qa` y `GET /api/qa/e2e` | Baterías de QA. **Solo existen fuera de producción** |

⚠️ **Panel de QA dentro de la propia app** `[C]` — `AppLayout.tsx` incluye **dos modales completos de
diagnóstico** (informe de QA e informe E2E) que se pintan dentro de la interfaz de usuario: filas con
✅ pass / ❌ fail / ⚠️ warn, resumen de aprobados y fallos, y duración. Se abren llamando a `/api/qa` y
`/api/qa/e2e`. Ocupan una parte notable del código del armazón. **No reconstruir**: es una herramienta
interna que se coló en la capa de usuario.
| `GET /api/plans` | Lista de planes de Stripe (público, pero ninguna pantalla lo usa) |

Rutas de laboratorio del frontend: `/test-cinematic`, `/test-mesa`, `/test-home`.

---

## 17. DUDAS (sin resolver — no omitidas)

1. **¿Se cancela la suscripción de Stripe al borrar la cuenta?** No hay nada en la interfaz que lo diga y no
   lo hemos verificado en el código de borrado. Si no se cancela, un usuario borrado **seguiría pagando**.
   Es lo más urgente de esta lista. `[X→pendiente]`
2. **Licencia de los GIFs de WorkoutX.** Es una API de pago con clave, y la app los cachea y los sirve desde
   su propio dominio. No consta autorización. **Aclarar antes de publicar.**
3. **Cuántos ejercicios hay realmente cacheados.** El pedido menciona 1.324; el código tiene la tabla y el
   contador, pero **no lo hemos comprobado contra la base de datos**, así que no afirmamos la cifra.
4. **`/vision` frente a la app antigua.** La hoja de ruta dice que `/vision` sustituirá a la antigua
   ("cambio de puerta"), pero hoy conviven. **¿Cuál es la referencia del rediseño?** Recomendación: `/vision`.
5. **Tema "melatonina".** Existe como tercer tema, pero no hemos verificado qué aspecto tiene ni para qué
   se pensó.
6. **`GET /api/progress`** existe en el servidor y `/vision` lo consume a través de sus hooks, pero la app
   antigua calcula el progreso leyendo Supabase directamente. **Dos caminos para el mismo dato.**
7. **Qué se ve exactamente al expirar la prueba.** Los textos hablan de conservar el plan y el progreso, pero
   no hemos comprobado si los datos siguen visibles en modo lectura o desaparecen de la vista.
8. **Notificaciones.** OneSignal está inicializado y el usuario se identifica al entrar, pero no hemos
   encontrado ningún punto donde se pida permiso ni donde se programe un aviso. **¿Llega alguna notificación
   hoy?** Nuestra lectura dice que no.

---

## Anexo — Método y contraste

- **Claude** recorrió: `App.tsx`, las 22 páginas, los 8 componentes de `/vision`, los componentes de la app
  antigua, los ficheros de datos y textos, el esquema de validación del servidor, los 57 endpoints, el
  manifest, el HTML y la configuración de pago. Ejecutó además un censo automático de las 574 claves de
  texto contra todo el código para encontrar las huérfanas.
- **Codex** hizo una lectura independiente con el mismo encargo.
- **Contraste:** Codex aportó cuatro cosas que Claude no había marcado y que se han verificado y añadido:
  la **ausencia de recuperación de contraseña**, la **contradicción entre los términos beta y el precio**,
  la **duda sobre la cancelación de Stripe al borrar la cuenta** y la **ausencia de aviso de instalación PWA**.
- Codex también afirmó cuatro cosas **que no son ciertas** y se han descartado citando el código: pestañas de
  calendario y perfil en `/vision`, campos de onboarding inexistentes (presupuesto, cocina, lesiones,
  duración de entreno), una cuota de fotos y un historial en `/comidas`, y la posible existencia de
  acceso con Google.
### Verificación final — qué pasó realmente

La verificación estaba planeada como una única pregunta a Codex contra este documento: *"¿qué puede hacer un
usuario en esta app que NO esté aquí?"*.

**No se pudo hacer.** Codex agotó su cuota de uso (responde que vuelve a estar disponible el 18/09/2026) y
Gemini había agotado antes su cuota diaria del plan gratuito. **Este documento no tiene, por tanto, una
verificación final externa.**

La pasada de verificación la hizo Claude sobre sí mismo, con la misma pregunta, y **encontró seis omisiones
que se han incorporado**. Merece la pena listarlas, porque indican dónde suelen quedar los puntos ciegos:

1. **El modo beta** (§3.1) — la regla más importante del producto, y la que más cerca estuvo de perderse.
2. **Que el muro de pago cubre 6 de 7 secciones**, no solo dos (§3.2).
3. **La navegación real** con sus 8 entradas y sus iconos (§1.4).
4. **Compartir como función real**: PNG + hoja de compartir del sistema (§1.5).
5. **Las animaciones SVG de ejercicio** dibujadas a mano, con 7 tipos de movimiento (§1.6).
6. **El panel de QA incrustado en la interfaz de usuario** (§16).

**Recomendación:** cuando Codex vuelva a estar disponible, repetir esa única pregunta contra este documento.
Hasta entonces, trátese como un inventario muy completo pero **no confirmado por un segundo lector**.
