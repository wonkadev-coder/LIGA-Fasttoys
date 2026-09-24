# Genera los iconos de la PWA con la insignia de Pitbike World: la rueda de
# tacos con el mundo dentro (logos/pitbike-world-simbolo.svg) y debajo PITBIKE,
# una regla y WORLD espaciado, en Archivo Black, sobre el gris claro de la
# marca. Elegida por Jorge el 24/09/2026 ("la 3") entre tres maneras de fundir
# símbolo y texto.
#
#   powershell -ExecutionPolicy Bypass -File scripts/icono-insignia.ps1
#
# Paso puntual, solo si cambia la insignia. Usa System.Drawing (viene con
# Windows) y la fuente de marca/fuentes/, así que no añade dependencias. Saca
# dos juegos: el normal y el enmascarable de Android, que recorta el icono en
# círculo y necesita el dibujo dentro del 80 % central.
# icono-logotipo.ps1 y icono.mjs son de iconos anteriores: no los ejecutes.

Add-Type -AssemblyName System.Drawing
$raiz = Split-Path -Parent $PSScriptRoot
$fuente = Join-Path $raiz 'marca\fuentes\ArchivoBlack-Regular.ttf'
if (-not (Test-Path $fuente)) { throw "Falta la fuente: $fuente" }

$ROJO = [System.Drawing.ColorTranslator]::FromHtml('#E63A1E')
$TINTA = [System.Drawing.ColorTranslator]::FromHtml('#171A21')
$FONDO = [System.Drawing.ColorTranslator]::FromHtml('#F3F2F2')
$DESPUES = [System.Drawing.Drawing2D.MatrixOrder]::Append

$coleccion = New-Object System.Drawing.Text.PrivateFontCollection
$coleccion.AddFontFile($fuente)
$familia = $coleccion.Families[0]

# Contorno de un texto, para colocarlo por sus límites reales y no por la caja
# de la fuente (que lleva aire arriba y abajo).
function Contorno([string]$texto) {
  $ruta = New-Object System.Drawing.Drawing2D.GraphicsPath
  $ruta.AddString($texto, $familia, [int][System.Drawing.FontStyle]::Regular, [single]100,
    (New-Object System.Drawing.PointF(0, 0)), [System.Drawing.StringFormat]::GenericTypographic)
  return $ruta
}

# Lleva un contorno a la escala pedida con su esquina superior izquierda en (x, y).
function Colocar($ruta, [single]$escala, [single]$x, [single]$y) {
  $b = $ruta.GetBounds()
  $m = New-Object System.Drawing.Drawing2D.Matrix
  $m.Translate(-$b.X, -$b.Y)
  $m.Scale($escala, $escala, $DESPUES)
  $m.Translate($x, $y, $DESPUES)
  $ruta.Transform($m)
  $m.Dispose()
}

function Redondeado([single]$x, [single]$y, [single]$ancho, [single]$alto, [single]$radio) {
  $ruta = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radio * 2
  $ruta.AddArc($x, $y, $d, $d, 180, 90)
  $ruta.AddArc($x + $ancho - $d, $y, $d, $d, 270, 90)
  $ruta.AddArc($x + $ancho - $d, $y + $alto - $d, $d, $d, 0, 90)
  $ruta.AddArc($x, $y + $alto - $d, $d, $d, 90, 90)
  $ruta.CloseFigure()
  return $ruta
}

# La rueda con la geometría del SVG (lienzo de 120, centro en 60), con su
# diámetro exterior (el de los tacos, 94) en $diam y centrada en (cx, cy).
function Rueda($g, [single]$cx, [single]$cy, [single]$diam) {
  $estado = $g.Save()
  $g.TranslateTransform($cx, $cy)
  $e = $diam / 94.0
  $g.ScaleTransform($e, $e)
  $brochaTinta = New-Object System.Drawing.SolidBrush($TINTA)
  $brochaRoja = New-Object System.Drawing.SolidBrush($ROJO)
  $aro = New-Object System.Drawing.Pen($TINTA, 12)
  $g.DrawEllipse($aro, -34, -34, 68, 68)
  $taco = Redondeado -5 -47 10 9 2
  for ($i = 0; $i -lt 18; $i++) {
    $giro = $g.Save()
    $g.RotateTransform($i * 20)
    $g.FillPath($brochaTinta, $taco)
    $g.Restore($giro)
  }
  $g.FillEllipse($brochaRoja, -24, -24, 48, 48)
  $trazo = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 3)
  $trazo.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $trazo.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawEllipse($trazo, -10, -24, 20, 48)
  $g.DrawLine($trazo, -22.5, 0, 22.5, 0)
  $g.DrawLine($trazo, -19.3, -12, 19.3, -12)
  $g.DrawLine($trazo, -19.3, 12, 19.3, 12)
  $g.Restore($estado)
  $taco.Dispose(); $aro.Dispose(); $trazo.Dispose(); $brochaTinta.Dispose(); $brochaRoja.Dispose()
}

# $factor 1.1 para el icono normal (llena más el cuadro del iPhone); 0.8 para el
# enmascarable, que así cabe entero en el círculo del 80 %.
function DibujarIcono([int]$lado, [single]$factor) {
  $img = New-Object System.Drawing.Bitmap($lado, $lado)
  $g = [System.Drawing.Graphics]::FromImage($img)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear($FONDO)

  # Todo se mide en un lienzo de 512 y se escala al lado pedido.
  $k = $lado / 512.0
  $g.ScaleTransform($k, $k)
  $g.TranslateTransform(256, 256)
  $g.ScaleTransform($factor, $factor)
  $g.TranslateTransform(-256, -256)

  # Medidas de la insignia: el bloque de texto tiene el ancho de PITBIKE, y
  # la regla y WORLD se estiran a ese mismo ancho.
  $anchoBloque = 300
  $diam = 204
  $huecoRueda = 26; $huecoRegla = 16; $grosorRegla = 7; $huecoWorld = 14

  $pit = Contorno 'PITBIKE'
  $bP = $pit.GetBounds()
  $escalaP = $anchoBloque / $bP.Width
  $altoP = $bP.Height * $escalaP

  # WORLD letra a letra, repartidas a lo ancho del bloque
  $letras = @('W', 'O', 'R', 'L', 'D') | ForEach-Object { Contorno $_ }
  $altoW = $altoP * 0.44
  $alturaRef = ($letras | ForEach-Object { $_.GetBounds().Height } | Measure-Object -Maximum).Maximum
  $escalaW = $altoW / $alturaRef
  $anchos = $letras | ForEach-Object { $_.GetBounds().Width * $escalaW }
  $suma = ($anchos | Measure-Object -Sum).Sum
  $separa = ($anchoBloque - $suma) / ($letras.Count - 1)

  $total = $diam + $huecoRueda + $altoP + $huecoRegla + $grosorRegla + $huecoWorld + $altoW
  $y = (512 - $total) / 2
  $x0 = (512 - $anchoBloque) / 2

  Rueda $g 256 ($y + $diam / 2) $diam
  $y += $diam + $huecoRueda

  $brocha = New-Object System.Drawing.SolidBrush($TINTA)
  Colocar $pit $escalaP $x0 $y
  $g.FillPath($brocha, $pit)
  $y += $altoP + $huecoRegla

  $g.FillRectangle($brocha, [single]$x0, [single]$y, [single]$anchoBloque, [single]$grosorRegla)
  $y += $grosorRegla + $huecoWorld

  $x = $x0
  for ($i = 0; $i -lt $letras.Count; $i++) {
    $l = $letras[$i]
    # Cada letra apoyada en la misma línea de base: se alinea por abajo.
    $alto = $l.GetBounds().Height * $escalaW
    Colocar $l $escalaW $x ($y + $altoW - $alto)
    $g.FillPath($brocha, $l)
    $x += $anchos[$i] + $separa
    $l.Dispose()
  }

  $g.Dispose(); $pit.Dispose(); $brocha.Dispose()
  return $img
}

"`n  Iconos de la PWA (insignia):"
$juegos = @(
  @{ nombre = 'pitbike-world-{0}.png'; factor = 1.1; lados = 512, 192, 180 },
  @{ nombre = 'pitbike-world-enmascarable-{0}.png'; factor = 0.8; lados = @(512) }
)
foreach ($juego in $juegos) {
  foreach ($lado in $juego.lados) {
    $destino = Join-Path $raiz ("iconos\" + ($juego.nombre -f $lado))
    $img = DibujarIcono $lado $juego.factor
    $img.Save($destino, [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()
    "  {0,-36} {1}x{1}  {2} KB" -f (Split-Path $destino -Leaf), $lado, [math]::Round((Get-Item $destino).Length / 1KB)
  }
}
"`n  Listo. Ejecuta ahora: node scripts/generar.mjs`n"
