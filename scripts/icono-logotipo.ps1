# Genera los iconos de la PWA a partir del logotipo de Pitbike World: la barra
# roja y PIT / BIKE apilados en Archivo Black, sobre el gris claro de la marca.
# WORLD y el rótulo se quedan fuera: en 48 px no se leerían.
#
#   powershell -ExecutionPolicy Bypass -File scripts/icono-logotipo.ps1
#
# Paso puntual, solo si cambia el logotipo. Usa System.Drawing (viene con
# Windows) y la fuente de marca/fuentes/, así que no añade dependencias.
# Sustituye a scripts/icono.mjs, que dibujaba la corona (10/09/2026).

Add-Type -AssemblyName System.Drawing
$raiz = Split-Path -Parent $PSScriptRoot
$fuente = Join-Path $raiz 'marca\fuentes\ArchivoBlack-Regular.ttf'
if (-not (Test-Path $fuente)) { throw "Falta la fuente: $fuente" }

$ROJO = [System.Drawing.ColorTranslator]::FromHtml('#E63A1E')
$TINTA = [System.Drawing.ColorTranslator]::FromHtml('#171A21')
$FONDO = [System.Drawing.ColorTranslator]::FromHtml('#F3F2F2')

$coleccion = New-Object System.Drawing.Text.PrivateFontCollection
$coleccion.AddFontFile($fuente)
$familia = $coleccion.Families[0]

# Contorno de un texto, para colocarlo por sus límites reales y no por la caja
# de la fuente (que lleva aire arriba y abajo).
function Contorno($texto, $tamano) {
  $ruta = New-Object System.Drawing.Drawing2D.GraphicsPath
  $ruta.AddString($texto, $familia, [int][System.Drawing.FontStyle]::Regular, [single]$tamano,
    (New-Object System.Drawing.PointF(0, 0)), [System.Drawing.StringFormat]::GenericTypographic)
  return $ruta
}

function DibujarIcono($lado) {
  $img = New-Object System.Drawing.Bitmap($lado, $lado)
  $g = [System.Drawing.Graphics]::FromImage($img)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear($FONDO)

  # Geometría en un lienzo de 512 y escalada al lado pedido. La barra y las
  # letras caben en la zona segura de un icono enmascarable (el 80 % central).
  $k = $lado / 512.0
  $g.ScaleTransform($k, $k)

  # BIKE es la palabra ancha: manda el tamaño. El bloque se centra en vertical
  # y la barra abarca de PIT a BIKE, como en el logotipo abarca las tres líneas.
  $izq = 70; $textoX = 110; $anchoMax = 300

  $tamano = 140
  do {
    $tamano -= 2
    $prueba = Contorno 'BIKE' $tamano
    $ancho = $prueba.GetBounds().Width
    $prueba.Dispose()
  } while ($ancho -gt $anchoMax -and $tamano -gt 40)

  $pit = Contorno 'PIT' $tamano
  $bike = Contorno 'BIKE' $tamano
  $bPit = $pit.GetBounds(); $bBike = $bike.GetBounds()

  $hueco = [math]::Round($tamano * 0.22)
  $total = $bPit.Height + $hueco + $bBike.Height
  $arriba = [math]::Round((512 - $total) / 2)
  $abajo = $arriba + $total

  $mPit = New-Object System.Drawing.Drawing2D.Matrix
  $mPit.Translate($textoX - $bPit.X, $arriba - $bPit.Y)
  $pit.Transform($mPit)
  $mBike = New-Object System.Drawing.Drawing2D.Matrix
  $mBike.Translate($textoX - $bBike.X, $abajo - ($bBike.Y + $bBike.Height))
  $bike.Transform($mBike)

  $brochaRoja = New-Object System.Drawing.SolidBrush($ROJO)
  $brochaTinta = New-Object System.Drawing.SolidBrush($TINTA)
  $g.FillRectangle($brochaRoja, $izq, $arriba, 24, $abajo - $arriba)
  $g.FillPath($brochaTinta, $pit)
  $g.FillPath($brochaTinta, $bike)

  $g.Dispose(); $pit.Dispose(); $bike.Dispose()
  return $img
}

"`n  Iconos de la PWA (logotipo):"
foreach ($lado in 512, 192, 180) {
  $destino = Join-Path $raiz "iconos\pitbike-world-$lado.png"
  $img = DibujarIcono $lado
  $img.Save($destino, [System.Drawing.Imaging.ImageFormat]::Png)
  $img.Dispose()
  "  {0,-26} {1}x{1}  {2} KB" -f (Split-Path $destino -Leaf), $lado, [math]::Round((Get-Item $destino).Length / 1KB)
}
"`n  Listo. Ejecuta ahora: node scripts/generar.mjs`n"
