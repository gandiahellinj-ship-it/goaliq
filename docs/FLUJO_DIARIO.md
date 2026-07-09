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
- Cuando TODAS las tareas del día tienen check, junto al estado del día
  aparece el botón "Registrar día".
- REGLA ESTRICTA (decisión de José): solo con el 100% de checks se puede
  registrar el día.
- A las 00:00 el HOME rota al día nuevo. Día no registrado = se pierde
  solo la aportación de ese día a las barras de progreso semanal y
  mensual (no hay más castigo).
- ⚠️ ADVERTENCIA DE DISEÑO (Claude, para decidir antes de implementar):
  el todo-o-nada tiene un riesgo de adherencia conocido — un día al 90%
  (p. ej. olvidó un suplemento) cuenta CERO, lo que frustra y rompe
  rachas por minucias. Alternativa compatible con lo ya decidido: el día
  registra siempre su % de Cumplimiento (fórmula ya fijada: proteína 40 /
  entreno 30 / comidas 20 / suplementos 10) y el 100% otorga bonus/racha.
  José decide: estricto puro vs estricto con crédito parcial.

## 5. Dependencias técnicas (todas ya decididas en DECISIONES.md)
- Estado compartido de tareas entre pestañas (HOME ↔ COMIDAS ↔ ENTRENOS).
- Endpoint de verificación por foto (spec Fase 3: Express + Supabase
  Storage + Claude Vision, JSON con match %, veredicto, feedback).
- Persistencia de registros en Supabase (fin de los checks efímeros).
- Corte diario a las 00:00 hora local del usuario (definir zona horaria).
