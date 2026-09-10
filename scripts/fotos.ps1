# Recorta la cara de cada cartel de piloto y la deja como avatar cuadrado, con
# el mismo encuadre para todos y el fondo del cartel fundido en un gris oscuro
# uniforme (Jorge, 10/09/2026: "que no parezca un corta y pega").
#
#   powershell -ExecutionPolicy Bypass -File scripts/fotos.ps1
#
# Los originales (los carteles que publica cada liga) viven en "FOTOS PILOTOS/"
# y no se tocan. De cada uno sale fotos/<id>.jpg de 320x320. El recorte se
# centra en la cara con las coordenadas de la tabla, en fracción del ancho y
# del alto del cartel, porque un recorte fijo cortaba cabezas. Después se
# aplica un fundido radial: la cara queda limpia y todo lo demás —bandera a
# cuadros, logos, luces— se apaga hacia el mismo gris en todas las fotos.
# Usa System.Drawing (viene con Windows), sin dependencias.

Add-Type -AssemblyName System.Drawing
$raiz = Split-Path -Parent $PSScriptRoot
$origen = Join-Path $raiz 'FOTOS PILOTOS'
$destino = Join-Path $raiz 'fotos'
New-Item -ItemType Directory -Force $destino | Out-Null

# fichero original -> id del piloto en datos/pilotos.json, centro de la cara
# (cx, cy en fracción) y lado del recorte (fracción del ancho). Un asterisco
# vale como comodín: los nombres con tilde no sobreviven a PowerShell 5.
$tabla = @(
  @{ f = 'RUBEN ESCRIBANO.jfif';    id = 'ruben8';       cx = 0.44; cy = 0.41; lado = 0.31 },
  @{ f = 'ROBERTO ESCRIBANO.jfif';  id = 'roberto79';    cx = 0.47; cy = 0.41; lado = 0.31 },
  @{ f = 'RAUL PAREDES.jfif';       id = 'raul-paredes'; cx = 0.48; cy = 0.39; lado = 0.31 },
  @{ f = 'JOS*FERNANDEZ.jfif';      id = 'josefh';       cx = 0.44; cy = 0.41; lado = 0.31 },
  @{ f = 'ENRIQUE PORRAS.jfif';     id = 'kike78';       cx = 0.44; cy = 0.42; lado = 0.31 },
  @{ f = 'RUBEN FERNANDEZ.jfif';    id = 'ruben-57';     cx = 0.47; cy = 0.39; lado = 0.31 }
)

$LADO = 320
$GRIS = [System.Drawing.ColorTranslator]::FromHtml('#1b1d22')  # el mismo fondo en todas
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]86)

# Un poco menos de saturación: los carteles vienen muy subidos y así casan
# entre sí y con la interfaz.
$sat = 0.82
$lumR = 0.3086; $lumG = 0.6094; $lumB = 0.0820
# PowerShell 5 no sabe pasar un float[][] al constructor: se parte de la
# identidad y se rellenan las celdas una a una.
$a = (1 - $sat)
$matriz = New-Object System.Drawing.Imaging.ColorMatrix
$matriz.Matrix00 = $a * $lumR + $sat; $matriz.Matrix01 = $a * $lumR;        $matriz.Matrix02 = $a * $lumR
$matriz.Matrix10 = $a * $lumG;        $matriz.Matrix11 = $a * $lumG + $sat; $matriz.Matrix12 = $a * $lumG
$matriz.Matrix20 = $a * $lumB;        $matriz.Matrix21 = $a * $lumB;        $matriz.Matrix22 = $a * $lumB + $sat
$atributos = New-Object System.Drawing.Imaging.ImageAttributes
$atributos.SetColorMatrix($matriz)

"`n  Avatares de piloto:"
foreach ($e in $tabla) {
  $fichero = Get-ChildItem -Path $origen -Filter $e.f | Select-Object -First 1
  if (-not $fichero) { "  {0,-28} FALTA" -f $e.f; continue }
  $img = [System.Drawing.Image]::FromFile($fichero.FullName)
  $lado = [int]($img.Width * $e.lado)
  $x0 = [int]($img.Width * $e.cx - $lado / 2)
  $y0 = [int]($img.Height * $e.cy - $lado / 2)
  $x0 = [math]::Max(0, [math]::Min($img.Width - $lado, $x0))
  $y0 = [math]::Max(0, [math]::Min($img.Height - $lado, $y0))

  $out = New-Object System.Drawing.Bitmap($LADO, $LADO)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $LADO, $LADO)),
    $x0, $y0, $lado, $lado, [System.Drawing.GraphicsUnit]::Pixel, $atributos)

  # Fundido radial hacia el gris: limpio hasta el 30 % del radio, casi sólido
  # en el borde del círculo del avatar (el 69 % del radio de esta elipse).
  $d = [int]($LADO * 1.45)
  $ruta = New-Object System.Drawing.Drawing2D.GraphicsPath
  $ruta.AddEllipse(($LADO - $d) / 2, ($LADO - $d) / 2, $d, $d)
  $brocha = New-Object System.Drawing.Drawing2D.PathGradientBrush($ruta)
  $brocha.CenterColor = [System.Drawing.Color]::FromArgb(0, $GRIS)
  $brocha.SurroundColors = @([System.Drawing.Color]::FromArgb(255, $GRIS))
  $mezcla = New-Object System.Drawing.Drawing2D.Blend(4)
  # Posiciones de borde (0) a centro (1); factor 1 = color del centro (transparente).
  $mezcla.Positions = [single[]](0, 0.30, 0.55, 1)
  $mezcla.Factors   = [single[]](0, 0.08, 1, 1)
  $brocha.Blend = $mezcla
  $g.FillRectangle($brocha, 0, 0, $LADO, $LADO)

  # Y la franja alta, donde los carteles llevan el logo: se apaga de arriba abajo.
  $lineal = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)), (New-Object System.Drawing.Point(0, [int]($LADO * 0.30))),
    [System.Drawing.Color]::FromArgb(230, $GRIS), [System.Drawing.Color]::FromArgb(0, $GRIS))
  $g.FillRectangle($lineal, 0, 0, $LADO, [int]($LADO * 0.30))
  $lineal.Dispose()

  $salida = Join-Path $destino ($e.id + '.jpg')
  $out.Save($salida, $codec, $params)
  "  {0,-28} -> fotos/{1}.jpg  ({2} KB)" -f $e.f, $e.id, [math]::Round((Get-Item $salida).Length / 1KB)
  $brocha.Dispose(); $ruta.Dispose(); $g.Dispose(); $out.Dispose(); $img.Dispose()
}
"`n  Listo. Si hay pilotos nuevos, pon la ruta en datos/pilotos.json (campo foto) y ejecuta node scripts/generar.mjs`n"
