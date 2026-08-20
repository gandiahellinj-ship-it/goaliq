# GoalIQ — Estado real del proyecto

> Diagnóstico de **solo lectura** hecho el **20/08/2026** sobre `D:\goaliq`, rama `staging`.
> Todo lo que dice este documento está **verificado ejecutando comandos sobre el código**.
> Donde no he podido verificar algo, lo digo. Sin adornos.

---

## 0. Veredicto en seis frases

1. **El producto existe y funciona.** No es una maqueta: 57 endpoints reales, autenticación real, pagos reales, RGPD implementado y una app publicada.
2. **La seguridad de datos está bien hecha.** No hay ni una sola clave de API escrita dentro del código, ni en los 983 commits de la historia. La autorización por usuario es correcta en todas las rutas. Es lo mejor del proyecto.
3. **Hay una función que está rota al 100 % en producción y nadie lo sabía**: sustituir un ingrediente de una comida falla SIEMPRE, en todas las peticiones.
4. **Hay dos caminos por los que se gasta dinero en IA sin que el usuario lo pida**, uno de ellos con un límite 10 veces más flojo del que debería.
5. **La calidad interna está peor de lo que dicen los documentos**: 95 errores de tipos (el informe de julio decía 17), cero pruebas automáticas ejecutándose jamás, y 46 avisos de seguridad en dependencias (26 altos).
6. **Un tercio del repositorio es peso muerto medible**, y ese peso muerto genera la mayoría de esos avisos de seguridad.

---

## 1. Qué existe y qué hace cada parte

Monorepo pnpm. Tamaño sin `node_modules` ni `.git`: **101 MB**.

### Paquetes de aplicación (`artifacts/`)

| Carpeta | Líneas | Ficheros | Qué es | Estado |
|---|---:|---:|---|---|
| `artifacts/nutricoach` | 30.105 | 126 | El frontend: la PWA en React + Vite. Contiene **las dos apps a la vez**: la antigua (`/dashboard`, `/meals`, `/workouts`…) y la nueva (`/vision`). | **Vivo.** Último cambio 27/07/2026 |
| `artifacts/api-server` | 8.674 | 41 | El backend: Express 5. Sirve la API, habla con Supabase, Claude, Gemini y Stripe. | **Vivo.** |
| `artifacts/mockup-sandbox` | 6.357 | 63 | Copia antigua del frontend. **52 de sus 61 ficheros son byte a byte idénticos** a los de `nutricoach`. | **Muerto.** Sin tocar desde el 12/04/2026 |

Dentro de `nutricoach`: **22 páginas**, de las cuales solo `pages/` ya suma 11.503 líneas. Las tres más grandes son `Onboarding.tsx` (2.315), `Progress.tsx` (1.360) y `Dashboard.tsx` (1.137).

### Librerías compartidas (`lib/`) — 5.704 líneas

| Paquete | Líneas | Importaciones reales en código |
|---|---:|---|
| `api-zod` | 1.444 | **10** — esquemas de validación. Vivo y útil |
| `api-client-react` | 1.873 | **1** — solo se usa `setAuthTokenGetter` en `main.tsx`. 1.873 líneas para una función |
| `db` | 144 | **1** — y quien lo importa (`api-server/src/lib/auth.ts`) está muerto |
| `integrations-openai-ai-server` | 493 | **0** — declarado como dependencia de `api-server`, nunca importado |
| `integrations-openai-ai-react` | 658 | **0** |
| `replit-auth-web` | 62 | **0** |
| `api-spec` | 0 | **0** — paquete vacío que arrastra `orval` y con él **6 avisos de seguridad altos** |

### El resto

- **`docs/`** (7 ficheros): `PENDIENTES.md`, `DECISIONES.md`, `AUDITORIA.md`, `FLUJO_DIARIO.md`, `ECONOMIA.md`, `PROMPT_PLATOS.md`, `ARCHIVO_IDEAS.md`. **Es el mejor activo del proyecto.** Vivos, fechados y precisos: casi todo lo que dicen se confirma en el código.
- **`e2e/`** (172 líneas): 5 pruebas de Playwright. **Nunca se han ejecutado** — no hay navegadores instalados y los propios ficheros dicen "selectores por confirmar".
- **`scripts/`** (546 líneas): utilidades de QA y siembra de datos.
- **Ficheros SQL de la raíz** + `supabase/`: el esquema. 13 tablas con seguridad a nivel de fila (RLS) activada y sus políticas.
- **`attached_assets/`** (28 ficheros, 1 MB): los prompts originales que se le dieron a Replit en abril. Valor histórico.
- **`design/`** (6 ficheros, **21 MB**): **sin versionar en git**. 4 fotos de plato y un mockup. Si se borra la carpeta, se pierde.

---

## 2. Qué funciona de verdad

Verificado en el código, no en los documentos:

- **Autenticación**: Supabase con token JWT verificado en el servidor (`middlewares/authMiddleware.ts`). El identificador de usuario nunca viaja desde el navegador: sale del token verificado.
- **Aislamiento por usuario**: revisé las 27 consultas SQL directas del backend. **Todas** filtran por `WHERE user_id = $1`, salvo las de la caché compartida de ejercicios (que no es dato de nadie). Correcto.
- **Sin inyección SQL**: cero consultas construidas pegando texto. Todo parametrizado.
- **RLS en Supabase**: 13 tablas con `enable row level security` y políticas por usuario.
- **Stripe**: el webhook verifica la firma y está colocado **antes** del parseo de JSON, que es como debe ser (es un error clásico que aquí no está).
- **RGPD**: consentimiento, exportación (art. 20) y borrado de cuenta (art. 17) implementados y, según `PENDIENTES.md`, verificados contra staging.
- **`/vision` está cableada a datos reales.** El fichero de datos de muestra (`src/data.ts`) ya **no lo importa nadie**.
  → *Esto contradice a `CLAUDE.md`, que sigue diciendo "con datos de muestra salvo suplementos/ajustes". Manda el código: hay que corregir el documento.*
- **Construye en verde**: `pnpm --filter @workspace/nutricoach build` termina bien, y el CI de GitHub Actions verifica instalación y construcción en Linux en todas las ramas.
- **Los modelos de IA que usa el código son válidos y vigentes**: `claude-opus-4-8` (5 $/25 $ por millón), `claude-sonnet-4-6`, `claude-haiku-4-5` y `gemini-2.5-flash-image`. Único detalle menor: en `aiGenerators.ts` el identificador de Haiku lleva fecha pegada (`claude-haiku-4-5-20251001`); el identificador vigente es sin fecha. Funciona, pero conviene limpiarlo.

---

## 3. Qué está roto o a medias

### 3.1 🔴 «Sustituir ingrediente» falla SIEMPRE — verificado

`POST /api/meals/replace-ingredient` **no puede funcionar nunca**. Tres hechos encadenados:

1. `api-server/src/routes/meals.ts:250` hace `ReplaceIngredientBody.parse(req.body)`.
2. Ese esquema (`lib/api-zod/src/generated/api.ts:294`) **exige un campo `mealId`** y declara `mealPlanId` como número.
3. El frontend (`supabase-queries.ts:1062` y `pages/Meals.tsx:571`) **nunca envía `mealId`**: envía `mealType`, `lang` y `chosenReplacement`, que el esquema ni siquiera conoce.

Resultado: el `parse` lanza un error de validación **en cada llamada**. Además está **fuera de cualquier `try/catch`** y **no hay manejador de errores global en Express** — así que la respuesta es un 500 seco.

El usuario ve "Swap failed. Please try again." y vuelve a intentarlo. Nunca va a funcionar.

*Detalle revelador: los errores de tipos de TypeScript en `meals.ts:267,279,280` señalaban exactamente esto. Como el chequeo de tipos está apagado (ver 3.3), nadie los vio.*

### 3.2 🔴 Dos caminos que gastan dinero en IA sin pedirlo

**a) Regeneración automática del plan de entrenos** — `pages/Workouts.tsx:205`

```
useEffect(() => { ... generateMutation.mutate({ lang }); }, [workoutPlan, isLoading]);
```

Al abrir `/workouts`, si falta el plan o algún ejercicio no tiene `exercise_id`, se dispara una generación con Claude. El usuario no la pide. Ya estaba anotado como riesgo en `PENDIENTES.md`; sigue ahí.

**b) Generación de fotos de plato con el límite equivocado** — `routes/dish-images.ts:54`

`POST /api/dish-image` llama a **Gemini** (cuesta dinero, ~20 s por imagen) pero usa `normalLimiter`: **100 peticiones por minuto**. Los demás endpoints de IA usan `aiLimiter`: 10 por hora. Es un límite **600 veces más flojo** para una ruta que sí gasta.

Y se dispara **solo al pintar**: `useDishImage` (`supabase-queries.ts:1537`) hace la petición al montar cada tarjeta de plato. Abrir el carrusel de comidas con un plan sin caché genera varias imágenes sin que el usuario toque nada.

*Atenuantes reales que sí tiene: exige sesión, la caché es compartida entre usuarios, y `retry: false` evita reintentos. Pero el límite está mal puesto.*

**c) Coste por petición mayor de lo que parece** — `lib/aiGenerators.ts:486`

Una sola generación de menú lanza **3 llamadas a Claude en paralelo**, cada una con reintentos, y si la moderación rechaza el resultado se regeneran las tres. Techo teórico: **12 llamadas a Claude por una sola petición del usuario**. El límite de 10/hora cuenta *peticiones HTTP*, no llamadas ni tokens.

### 3.3 El chequeo de tipos no se ejecuta en ningún sitio, y hay 95 errores

| Zona | Errores |
|---|---:|
| `artifacts/nutricoach` | **73** (60 de ellos en un solo fichero: `src/components/ExerciseAnimation.tsx`) |
| `artifacts/api-server` | **17** |
| `lib/*` | **5** |

Dos motivos por los que nadie se entera:

1. **En local está roto.** `corepack pnpm run typecheck` falla con `"pnpm" no se reconoce como un comando`: el script llama a `pnpm` a secas y corepack no lo deja en el PATH de los subprocesos. Como `pnpm run build` empieza por el typecheck, **el comando de construcción del monorepo tampoco funciona en esta máquina**.
2. **En el CI está apagado a propósito.** `.github/workflows/linux-check.yml` dice literalmente: *"no ejecuta el typecheck del workspace porque tiene 17 errores preexistentes documentados"*. Hoy son 95.

No es cosmética: los errores de `meals.ts` eran la función rota del punto 3.1, y `aiGenerators.ts:266` (`visual_ref` en un tipo que no lo admite) es justo el campo que causó el bug de las fotos de plato.

### 3.4 Cero pruebas automáticas

- **0 pruebas unitarias** en todo el repositorio.
- **5 pruebas E2E que nunca se han ejecutado**: no hay navegadores de Playwright instalados y los ficheros avisan de que los selectores están sin confirmar.
- El CI solo comprueba que **instala y construye**. No comprueba que funcione.

Traducción: hoy la única forma de saber si algo se ha roto es que José lo vea con sus ojos en producción. Y ya hemos visto que hay una función rota que así no se detectó.

### 3.5 Todo el JavaScript en un solo fichero de 2,7 MB

Construcción real medida:

- `dist/public/assets/index-*.js` → **2.714.988 bytes crudos / 769.814 bytes comprimidos**. Un único fichero, sin división de código.
- Dentro van **three.js y GSAP**, que solo usan las rutas de experimento `/test-cinematic`, `/test-mesa` y `/test-home`.
- `App.tsx` no usa `lazy()` ni `Suspense` en ninguna ruta.

Cada usuario de móvil se descarga el motor 3D de unos experimentos que nunca va a ver.

### 3.6 Endpoints y contratos que no cuadran

| Endpoint | Llamadas desde el frontend |
|---|---:|
| `POST /api/diets/generate` | **0** |
| `GET /api/recipes/random` | **0** (y consume cuota de Spoonacular) |
| `POST /api/diets/visualize` | 1 |
| `POST /api/meals/validate` | 1 |

Además, en `meals.ts:46` el propio servidor **se salta la validación de su respuesta** con este comentario: *"Skip GetMealPlanResponse.parse() — el esquema declara `id: number` pero en Supabase es un UUID"*. El contrato generado está desincronizado con la realidad; es la misma raíz del fallo 3.1.

Y hay **dos implementaciones distintas de "llamar a Claude"**: `app.ts:178` y otra dentro de `lib/aiGenerators.ts`.

### 3.7 46 avisos de seguridad en dependencias

`pnpm audit`: **3 bajos, 17 medios, 26 altos**. Lo importante es de dónde salen:

| Origen | ¿Está vivo? |
|---|---|
| `artifacts/mockup-sandbox` (picomatch, lodash, vite, postcss, nanoid, yaml, @babel/core) | **No.** Paquete muerto |
| `lib/api-spec` (linkify-it, brace-expansion, js-yaml, fast-uri, markdown-it) | **No.** Paquete vacío |
| `artifacts/api-server` (path-to-regexp, drizzle-orm, ip-address, qs, @anthropic-ai/sdk, esbuild, body-parser) | **Sí.** Estos son los que importan |
| raíz (`ws`) | Sí |

**Borrar dos paquetes muertos elimina la mayoría de los avisos altos de un plumazo.**

### 3.8 Peso muerto medido

- **49 de los 57 componentes de interfaz** (`src/components/ui/`) no se importan desde ningún sitio fuera de esa carpeta.
- `api-server/src/lib/auth.ts` (~90 líneas de autenticación OIDC de Replit): **nadie lo importa**. Es el único que usa `@workspace/db`.
- `api-server/dish-doctor.mjs`: script de diagnóstico de las fotos de plato; `PENDIENTES.md` ya dice "borrar tras implementar".
- 4 paquetes de `lib/` con **cero importaciones reales**.

---

## 4. Secretos: qué hay y qué no

### En el código y en la historia de Git: **limpio**

Busqué en el árbol de trabajo y en los **983 commits** de la historia los patrones `sk-ant-api03`, `AIzaSy`, `whsec_`, `sk_live_`, `sk_test_` y la contraseña de la base de datos de staging.

**Resultado: 0 coincidencias en la historia. 0 claves privadas escritas dentro del código.** Todo el código lee de `process.env`. Está bien hecho y hay que decirlo. (Codex, en su lectura independiente, llegó a la misma conclusión.)

### Lo que sí está commiteado (y es correcto que lo esté)

`.replit` en la rama `main` contiene:

- `SUPABASE_URL` y `SUPABASE_ANON_KEY` (`sb_publishable_…`) — la clave *anon* de Supabase es **pública por diseño**; su protección es el RLS, que está activado. **No es una filtración.**
- `STRIPE_PUBLIC_KEY = pk_test_51TFPcu…` — clave **publicable** (no secreta), pero de **entorno de PRUEBAS**. Merece una comprobación: si `main` es producción, ahí debería ir la `pk_live_`.
  → *No verificado qué clave usa realmente el Repl de producción, porque los Secrets de Replit pueden sobreescribirla y no son legibles desde aquí.*

### Lo que hay en tu disco, fuera de Git — atención aquí

| Fichero | Contiene | ¿Protegido? |
|---|---|---|
| `artifacts/api-server/.env.staging` | **La contraseña real de la base de datos de staging**, en claro, dentro de una cadena `postgresql://…` | Sí, está en `.gitignore` |
| `artifacts/api-server/.env` | `SPOONACULAR_API_KEY`, `GOOGLE_GEMINI_API_KEY` | Sí, en `.gitignore` |
| `artifacts/nutricoach/.env.local` | Solo valores de relleno | Sí |
| **`D:\GoalIQ-Production\.env`** | `SPOONACULAR_API_KEY` y `TRIPO_API_KEY` reales, en claro | **NO. Esa carpeta no es un repositorio git — no hay `.gitignore` que la proteja** |

**Riesgo real**: ninguno de estos ficheros se ha subido nunca. Pero la contraseña de la base de datos de staging y dos claves de API viven en texto plano en tu disco. Si algún día comprimes y compartes esas carpetas, van dentro.

---

## 5. Las tres copias: qué guardar y qué archivar

### `C:\Users\Usuario\goaliq` (junio, 44 MB) — clon obsoleto, **pero con trabajo sin guardar**

- Repositorio git con **224 commits**. Los comprobé uno a uno: **los 224 están ya dentro de `D:\goaliq`**. Nada que rescatar de la historia.
- **Pero tiene 16 cambios sin commitear**, y 5 de ellos **no existen en `D:\goaliq` ni siquiera en su historia**:
  - `artifacts/nutricoach/src/components/mesa/ComidasScene.tsx`
  - `artifacts/nutricoach/src/components/mesa/comidas/` (carpeta)
  - `artifacts/nutricoach/src/components/spec/` (carpeta)
  - `artifacts/nutricoach/src/pages/TestComidas.tsx`
  - `artifacts/nutricoach/src/pages/spec/` (carpeta)

  Es trabajo de la línea "mesa viva" (los experimentos 3D), aparcada en `ARCHIVO_IDEAS.md`. No es urgente, pero **es código escrito que solo existe ahí**. Guardarlo en un ZIP y luego archivar la carpeta. Borrarla sin más pierde ese código.

### `C:\Users\Usuario\GoalIQ-Production` (155 MB) — **contiene material original que NO está en el proyecto**

`01-ASSETS` tiene **35 ficheros y 72 MB** que no están en `D:\goaliq`:

- `_SELECTED/01-world-map/clipA_aterrizaje_v1_1080p.mp4` (23,8 MB) y `clipA_caida_v1_1080p.mp4` (14,1 MB) — **los vídeos originales**. En el proyecto solo están los 76 fotogramas `.webp` extraídos de ellos.
- `_OPTIMIZED/` y `_SELECTED/`: los originales a alta resolución de la mesa, las figuras anatómicas y el logo. En `artifacts/nutricoach/public/mesa/` solo están las versiones reducidas y renombradas.
- `_RAW/01-cinematics/`: 21 fotogramas PNG de la cinemática, ~1 MB cada uno.

**Veredicto: NO archivar sin copiar antes.** Son los másteres de los que salieron los assets del proyecto. Si se pierden, no se pueden regenerar.

### `D:\GoalIQ-Production` (84 MB) — casi todo duplicado, tres cosas propias

- `specs/` (3 documentos: `goaliq_compiled_spec.md`, `goaliq_decisions.md`, `goaliq_storyboard.md`) — **no están en `D:\goaliq`**. Merecen una lectura antes de archivar.
- `server.js` — prototipo de 60 líneas que llama a Spoonacular y Tripo. **Superado por completo** por `artifacts/api-server`. A la basura.
- `.env` con dos claves reales (ver sección 4).
- Su `01-ASSETS` solo tiene **2 ficheros**; la versión buena es la de `C:`.
- `GoalIQ_keyframes` (73 MB) y `ezgif-…` (32 MB) están **duplicados en las dos carpetas Production**: 105 MB de duplicado puro.
- `03-DOCS`: los 5 ficheros `.md` están **vacíos (0 bytes)** en ambas copias.

**Resumen:** ~240 MB en tres sitios. Lo verdaderamente irremplazable son los **72 MB de `C:\Users\Usuario\GoalIQ-Production\01-ASSETS`**, los 3 documentos de `specs/` y los 5 ficheros de código sin commitear de la copia de junio. Todo lo demás es duplicado u obsoleto.

---

## 6. Estado de las ramas

- `staging` tiene **19 commits que `main` no tiene**; `main` tiene 4 que `staging` no tiene (son los mismos arreglos, promocionados por cherry-pick, más la configuración de producción).
- Lo único funcional pendiente de promocionar a producción es **"Fotos de plato: emplatado coherente"**. `PENDIENTES.md` avisa: al desplegarlo hay que **vaciar la tabla `dish_images`**, o las fotos viejas se quedan cacheadas.
- Hay **7 ramas `feature/…`** ya fusionadas, vivas todavía en local y en GitHub. Ruido.
- La carpeta `design/` (21 MB) está sin versionar.

---

## 7. Qué tiraría a la basura

Por orden de "cuánto quitas / cuánto duele":

| Qué | Cuánto quita | Riesgo de tirarlo |
|---|---|---|
| `artifacts/mockup-sandbox` | 6.357 líneas + ~10 avisos altos | **Ninguno.** 52 de 61 ficheros son copia exacta; sin tocar desde abril. Ojo: está listado en `.replit` como artefacto, quitarlo también de ahí |
| `lib/api-spec` | Paquete vacío + 6 avisos altos | **Ninguno.** 0 líneas, 0 usos |
| `lib/integrations-openai-ai-react` | 658 líneas | Ninguno |
| `lib/integrations-openai-ai-server` | 493 líneas | Ninguno (quitarlo también de las dependencias de `api-server`) |
| `lib/replit-auth-web` | 62 líneas | Ninguno |
| `api-server/src/lib/auth.ts` + `lib/db` | ~234 líneas | Ninguno. Es autenticación de Replit, ya sustituida por Supabase |
| 49 componentes `ui/` sin usar | ~2.000 líneas estimadas | Bajo — verificar uno a uno antes |
| Rutas `/test-cinematic`, `/test-mesa`, `/test-home` | Saca three.js + GSAP del paquete principal | Bajo. Es la línea "mesa viva", aparcada. **Guardar el código antes** |
| `api-server/dish-doctor.mjs` | Script de diagnóstico ya cumplido | Ninguno |
| `D:\GoalIQ-Production\server.js` + su `node_modules` | Prototipo superado | Ninguno |
| 105 MB duplicados entre las dos carpetas `GoalIQ-Production` | 105 MB | Ninguno si se conserva una copia |
| Las 7 ramas `feature/…` ya fusionadas | Ruido | Ninguno |

**Lo que NO hay que tirar:** `docs/` (el activo más valioso), los assets originales de `C:\…\GoalIQ-Production\01-ASSETS`, y `attached_assets/` (histórico, 1 MB).

---

## 8. Plan priorizado — 5 pasos

Ordenado por *daño evitado por hora invertida*. Una tarea por sesión, como marca `CLAUDE.md`.

### Paso 1 — Cerrar las fugas de gasto en IA *(1 sesión)*

- Quitar la auto-regeneración de `Workouts.tsx:205`: que el plan se genere solo si el usuario pulsa un botón.
- Cambiar `normalLimiter` por un limitador de IA en `routes/dish-images.ts:54` (hoy permite 100 imágenes de Gemini por minuto y usuario).
- Decidir si las fotos de plato deben generarse al pintar la tarjeta o solo al abrir el plato.

**Por qué primero:** es lo único de esta lista que cuesta dinero real cada día que pasa, y son tres cambios pequeños y acotados.

### Paso 2 — Arreglar «sustituir ingrediente» y poner una red bajo Express *(1 sesión)*

- Alinear el contrato: o el frontend envía `mealId`, o el esquema `ReplaceIngredientBody` pasa a aceptar `mealType` / `chosenReplacement` / `lang` y `mealPlanId` como texto (UUID). Elegir uno y hacerlo de punta a punta.
- Envolver el `parse` en `try/catch` y **añadir un manejador de errores global** a Express, para que un fallo de validación devuelva un 400 con mensaje y no un 500 seco.
- Aprovechar y quitar el `Skip GetMealPlanResponse.parse()` de `meals.ts:46`, que es el mismo problema.

**Por qué segundo:** es una función que hoy falla el 100 % de las veces en producción. Y el manejador de errores global evita que el próximo desajuste vuelva a esconderse detrás de un 500.

### Paso 3 — Rescatar lo irreemplazable y archivar las copias *(1 sesión)*

Copiar a un sitio seguro (disco externo o nube):
- los **72 MB de `C:\Users\Usuario\GoalIQ-Production\01-ASSETS`** (vídeos y originales a alta resolución);
- los 3 documentos de `D:\GoalIQ-Production\specs\`;
- los 5 ficheros sin commitear de `C:\Users\Usuario\goaliq`.

Después: archivar o borrar las tres carpetas, y versionar (o respaldar) `design/`, que hoy son 21 MB sin git.

**Por qué tercero:** es barato, se hace una vez, y evita el único riesgo de esta lista que es *irreversible*.

### Paso 4 — Borrar el peso muerto *(1 sesión)*

Eliminar `artifacts/mockup-sandbox`, `lib/api-spec`, `lib/integrations-openai-ai-react`, `lib/integrations-openai-ai-server`, `lib/replit-auth-web`, `api-server/src/lib/auth.ts` + `lib/db`, y `dish-doctor.mjs`. Quitar `mockup-sandbox` de `.replit`. Borrar las 7 ramas `feature/…` ya fusionadas.

**Por qué cuarto:** quita ~7.900 líneas y **la mayoría de los 26 avisos de seguridad altos** sin tocar una sola línea de código vivo. Es el mejor cambio por esfuerzo de toda la lista, y deja el terreno limpio para el paso 5.

### Paso 5 — Montar la red de seguridad *(2 sesiones)*

- Arreglar el script `typecheck` de la raíz para que funcione con corepack (hoy `pnpm run build` está roto en local por esto).
- Bajar los 95 errores a cero, en dos tandas: primero `ExerciseAnimation.tsx` (60 errores, un solo fichero — probablemente se arregla o se borra de una vez), después el resto.
- **Encender el typecheck en el CI** y quitar el comentario que lo excusa.
- Instalar los navegadores de Playwright, corregir los selectores contra staging y dejar los 5 recorridos E2E **pasando en verde**. Añadirlos al CI.

**Por qué quinto y no antes:** automatizar antes de limpiar es automatizar sobre arena. Pero **antes de abrir la beta a usuarios reales esto es obligatorio**: hoy no hay ninguna prueba, de ningún tipo, que se ejecute jamás — y por eso una función lleva rota quién sabe cuánto.

### Después de estos cinco

**Partir el paquete de JavaScript.** Cargar con `lazy()` las rutas `/test-*` y las páginas pesadas de la app antigua, para bajar de los 2,7 MB actuales (750 KB comprimidos) en la primera carga. Es una PWA móvil: hoy el primer arranque arrastra un motor 3D que nadie usa. No es un fallo, es la peor experiencia que tiene el producto — y lo primero que notará un usuario de la beta.

---

## 9. Nota sobre el método

Este diagnóstico lo he hecho **leyendo y ejecutando sobre el código**: conteo de líneas, compilador de TypeScript, `pnpm audit`, construcción real del frontend y medición del paquete resultante, recorrido de los 983 commits buscando secretos, y comparación fichero a fichero de las tres copias.

**Se pidió contrastarlo con Gemini y no fue posible**: la cuenta tiene la **cuota diaria del plan gratuito agotada** (error 429: primero `limit: 0`, luego `daily quota exhausted`). Lo intenté dos veces.

**En su lugar lancé una segunda lectura independiente con Codex.** Aportó dos hallazgos que yo no había visto, y **los he verificado uno a uno en el código antes de incluirlos**:
- el fallo de contrato de «sustituir ingrediente» (punto 3.1) — confirmado y ampliado: no solo falla la validación, es que además no hay `try/catch` ni manejador de errores global;
- el limitador equivocado en el endpoint de fotos de plato (punto 3.2b) — confirmado.

Coincidimos en lo demás: sin secretos en el código, paquetes OpenAI sin usar, endpoints de IA que el frontend nunca llama.

**Cosas que este documento NO ha verificado** (por honestidad):

- Qué claves usa realmente el Repl de **producción** (los Secrets de Replit no son legibles desde aquí).
- Si la app publicada funciona hoy de punta a punta con un usuario real — no he ejecutado la aplicación contra producción.
- Si los 49 componentes `ui/` sin importar están de verdad muertos, o alguno entra por una ruta indirecta.
- Si algún consumidor **externo** al repositorio llama a los endpoints que el frontend no usa.
