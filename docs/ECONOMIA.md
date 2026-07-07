# GoalIQ — Economía

> Precios verificados el 2026-07-07. Revisar trimestralmente: los precios de las APIs cambian.

## Precio de venta
- 19,90 €/mes (mensual). Plan anual pendiente de fijar (~99-119 €/año). Precio fundador en beta.
- De cada 19,90 €: −3,45 € IVA (21%) → 16,45 € ingreso real → −~0,55 € Stripe → **~15,90 € netos**.
- El IVA NO es ingreso: se recauda y se entrega a Hacienda.

## Costes fijos mensuales (independientes de usuarios)
| Concepto | Coste | Nota |
|---|---:|---|
| Supabase Pro | ~23 € ($25) | Necesario en producción (backups, sin pausa) |
| Replit Core | ~23 € ($25; $20 anual) | Incluye $25 créditos que cubren hosting con poco tráfico. ⚠️ Menos predecible: configurar LÍMITE DE GASTO en el panel. |
| Dominio | ~1,5 € | |
| OneSignal | 0 € | Gratis hasta 10.000 suscriptores web push; luego Growth $19/mes + $0,004/suscriptor |
| **Total arranque** | **~50-60 €** | Se cubre con 4-5 suscriptores |

## Costes variables por usuario activo/mes
| Concepto | Mes 1 (caché fría) | Régimen estable |
|---|---:|---:|
| Stripe (cobro 19,90 €) | 0,55 € | 0,55 € |
| IA texto — 4 planes (Claude Haiku $1/$5 por MTok) | 0,22 € | 0,22 € |
| IA imágenes platos (Nano Banana $0,039/img) | ~1,50 € | ~0,30 € |
| IA visión — verificación fotos (Fase 3, estimado) | 0,25 € | 0,25 € |
| **Total variable** | **~2,50 €** | **~1,30 €** |

Clave del coste de imágenes: la CACHÉ. Cada foto se genera UNA vez y se reutiliza para
todos los usuarios (búsqueda por nombre de plato normalizado). Usuario 1 ≈ 1,10 € en
imágenes; usuario 500 ≈ 0,05 €. Si la normalización de nombres falla, el coste se queda
en el escenario "frío" para siempre → vigilar en la implementación.

## Escenarios de beneficio bruto mensual
| Suscrip. | Neto (IVA+Stripe) | Imágenes fría/madura | Resto IA | Fijos | Beneficio (fría) | Beneficio (estable) |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 159 € | 15 / 3 € | 5 € | 55 € | ~84 € | ~96 € |
| 100 | 1.590 € | 150 / 30 € | 47 € | 60 € | ~1.333 € | ~1.453 € |
| 200 | 3.180 € | 300 / 60 € | 94 € | 75 € | ~2.711 € | ~2.951 € |
| 300 | 4.770 € | 450 / 90 € | 141 € | 85 € | ~4.094 € | ~4.454 € |
| 500 | 7.950 € | 750 / 150 € | 235 € | 100 € | ~6.865 € | ~7.465 € |
| 1.000 | 15.900 € | 1.500 / 300 € | 470 € | 130 € | ~13.800 € | ~15.000 € |

"Fría" = todos los usuarios generan su primer plan ese mes (peor caso). El mes real
está siempre entre las dos columnas. Margen ~88-92% sobre neto a partir de 100 usuarios.

## Lo que estas tablas NO incluyen (deliberadamente)
1. Coste de adquisición de usuarios (publicidad, contenido, tiempo) — la variable que decide el negocio.
2. Tasa de cancelación (churn).
3. Impuestos personales (IRPF/autónomos) → gestoría.
4. Posibles sobrecostes de Replit con tráfico alto.

## Datos a medir en cuanto haya usuarios reales
- Tokens reales por plan (campo `usage` de la API de Anthropic) → sustituir estimaciones.
- Tasa de acierto de la caché de imágenes (% de platos reutilizados).
- Factura real de Replit los 3 primeros meses.
