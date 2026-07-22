# ============================================
# GoalIQ - Arranque del dia (doble clic)
# ============================================
# Que hace: abre PENDIENTES.md, arranca el servidor
# de desarrollo y abre la app en el navegador.

$repo = "D:\goaliq"

# 1. Abrir el archivo de pendientes para leerlo mientras arranca todo
Start-Process notepad "$repo\docs\PENDIENTES.md"

# 2. Arrancar el servidor de desarrollo en una ventana propia
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$repo'; `$env:PORT='5173'; `$env:BASE_PATH='/'; corepack pnpm --filter @workspace/nutricoach dev"

# 3. Esperar unos segundos y abrir la app en el navegador
Start-Sleep -Seconds 8
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "Listo. Siguiente paso: abre Claude Code y escribe /dia" -ForegroundColor Cyan
Write-Host "(Puedes cerrar esta ventana)" -ForegroundColor Gray
Start-Sleep -Seconds 10
