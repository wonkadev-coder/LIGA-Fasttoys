# Programa la actualización diaria de la liga en el Programador de tareas.
#
#   powershell -ExecutionPolicy Bypass -File scripts/programar.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/programar.ps1 -Hora 07:30
#   powershell -ExecutionPolicy Bypass -File scripts/programar.ps1 -Quitar
#
# Se ejecuta a las 07:00, después del corte del día operativo de CronoLaps (06:00),
# así que la jornada anterior ya está cerrada cuando se descarga.
#
# El equipo tiene que estar encendido a esa hora. Si se queda apagado, la tarea
# se lanza en cuanto arranca (StartWhenAvailable). Y como cada ejecución repasa
# los últimos días, un día perdido se recupera solo al siguiente.

param(
  [string]$Hora = "07:00",
  [switch]$Quitar,
  [switch]$Publicar
)

$nombre = "Liga Fast Toys DR7 - actualizacion diaria"
$raiz = Split-Path -Parent $PSScriptRoot

if ($Quitar) {
  try {
    Unregister-ScheduledTask -TaskName $nombre -Confirm:$false -ErrorAction Stop
    "`n  Tarea eliminada.`n"
  } catch { "`n  No hay ninguna tarea programada con ese nombre.`n" }
  exit 0
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { "`n  No encuentro node en el PATH.`n"; exit 1 }

# --dias 3 se solapa a propósito: si un día falla, el siguiente lo recupera.
$argumentos = "`"$raiz\scripts\actualizar.mjs`" --dias 3"
if ($Publicar) { $argumentos += " --publicar" }

$accion = New-ScheduledTaskAction -Execute $node -Argument $argumentos -WorkingDirectory $raiz
$disparador = New-ScheduledTaskTrigger -Daily -At $Hora
$ajustes = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopOnIdleEnd `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $disparador `
  -Settings $ajustes -Description "Descarga las vueltas del circuito DR7 desde CronoLaps y actualiza la clasificacion." `
  -Force | Out-Null

"`n  Programada: todos los días a las $Hora"
if ($Publicar) { "  Publicará automáticamente (git commit + push)." }
else { "  Solo actualiza en local. Añade -Publicar para que además suba los cambios." }
"`n  Comprobar:  Get-ScheduledTask -TaskName '$nombre'"
"  Lanzar ya:  Start-ScheduledTask -TaskName '$nombre'"
"  Quitar:     powershell -File scripts/programar.ps1 -Quitar`n"
