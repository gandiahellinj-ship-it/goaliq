# GoalIQ — FLUJO DIARIO DEL USUARIO (especificación)
# Definido por José el 08/07/2026. Se implementa en la fase de registro real
# (tras la Fase 6 de la migración visual). Fuente de verdad de esta feature.

## Visión general
El usuario vive su día como un bucle: se levanta → ve su primera tarea en
HOME → las completa según le toquen por hora → cada tarea se REGISTRA con
evidencia (foto o datos) → al completar todas, cierra el día con "Registrar
día" → alimenta las barras de progreso semanal y mensual.

## 1. COMIDAS — Registro por foto (conecta con la spec de Fase 3 ya existente)
- El botón "Marcar como comida ✓" pasa a llamarse "REGISTRAR COMIDA" con
  icono de cámara al lado.
- Flujo: usuario fotografía su plato → Claude Vision analiza:
  (a) macros estimados de lo fotografiado,
  (b) % de correlación con el plato + ingredientes que el plan le asignó.
- Si el % supera el umbral (≥75%, ya decidido en la spec de Fase 3),
  aparece la opción "Registrar" y la comida queda completada.
- Si no lo supera: feedback de qué difiere (spec Fase 3: parcial / mismatch).

## 2. ENTRENOS — Registro por ejercicio
- Cada ejercicio permite registrar sus datos reales:
  · Fuerza: peso levantado + repeticiones por serie.
  · Cardio: minutos + kilómetros (entrada manual; el usuario puede copiar
    sus datos de Strava a mano en v1 — integración API Strava NO en v1).
- "Entreno completado" → activa AUTOMÁTICAMENTE el check de la tarea
  de entreno en HOME (misma fuente de estado, sincronía inmediata).

## 3. PENDIENTE DE INVESTIGACIÓN — Tipos de ejercicio y públicos
- Los ejercicios los genera el propio plan (Claude Haiku); hoy el prompt
  de generación produce ejercicios de gimnasio + cardio.
- Para abrir GoalIQ a otros públicos (running, calistenia, natación,
  deportes...) hay que: (a) auditar qué tipos de ejercicio produce hoy el
  prompt de generación del plan, (b) añadir pregunta de tipo de actividad
  en el onboarding, (c) extender el prompt de generación por modalidad,
  (d) variantes de UI de registro por modalidad (series/reps/peso vs
  min/km vs otras). DECISIÓN DE PRODUCTO ABIERTA — no bloquea v1.

## 4. HOME — "Registrar día" (cierre del bucle)
### DISEÑO DEFINITIVO — decidido por José el 24/07/2026
(Cierra la decisión que estaba abierta: "estricto puro vs. crédito parcial".
Resolución: CRÉDITO PARCIAL en el progreso, ESTRICTO en la racha.)

1. **Registro por niveles**: cada tarea se registra en SU pestaña (comida en
   COMIDAS, suplemento en su fila…). El entreno tiene botón "Registrar" al
   completarlo, que pone su tick en HOME. El usuario podrá configurar la
   HORA de su entreno para colocarlo en el itinerario.
2. **Progreso semanal/mensual AUTOMÁTICO con crédito parcial**: se calcula
   de lo efectivamente marcado, se selle o no el día. Un día al 90% puntúa
   90% — nunca cero por una minucia.
3. **"Registrar día" (HOME) = LA RACHA**: el botón se activa solo cuando
   TODO el día está registrado (el entreno o su descanso, obligatorio).
   Sellar el día es lo ÚNICO que mantiene la racha. Estricto a propósito:
   la racha premia el cierre consciente del día, el progreso no castiga.
4. **Ventana de gracia**: el día anterior puede sellarse hasta las 12:00
   del día siguiente.
5. **La racha se OCULTA de la interfaz** hasta que este sistema exista
   (nada de números inventados).

## 5. Dependencias técnicas (todas ya decididas en DECISIONES.md)
- Estado compartido de tareas entre pestañas (HOME ↔ COMIDAS ↔ ENTRENOS).
- Endpoint de verificación por foto (spec Fase 3: Express + Supabase
  Storage + Claude Vision, JSON con match %, veredicto, feedback).
- Persistencia de registros en Supabase (fin de los checks efímeros).
- Corte diario a las 00:00 hora local del usuario (definir zona horaria).
