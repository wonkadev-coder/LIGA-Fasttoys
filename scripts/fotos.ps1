# Recorta la cara de cada cartel de piloto y la deja como avatar cuadrado.
#
#   powershell -ExecutionPolicy Bypass -File scripts/fotos.ps1
#
# Los originales (los carteles que publica cada liga) viven en "FOTOS PILOTOS/"
# y no se tocan. De cada uno sale fotos/<id>.jpg de 320x320. El recorte se
# centra en la cara con las coordenadas de la tabla de abajo, en fracción del
# ancho y del alto del cartel: los carteles de Fast Toys llevan al piloto en
# el mismo sitio, pero no exactamente, y un recorte fijo cortaba cabezas.
# Usa System.Drawing (viene con Windows), sin dependencias.

Add-Type -AssemblyName System.Drawing
$raiz = Split-Path -Parent $PSScriptRoot
$origen = Join-Path $raiz 'FOTOS PILOTOS'
$destino = Join-Path $raiz 'fotos'
New-Item -ItemType Directory -Force $destino | Out-Null

# fichero original -> id del piloto en datos/pilotos.json, centro de la cara
# (cx, cy en fracción) y lado del recorte (fracción del ancho).
$tabla = @(
  @{ f = 'RUBEN ESCRIBANO.jfif';    id = 'ruben8';       cx = 0.44; cy = 0.43; lado = 0.40 },
  @{ f = 'ROBERTO ESCRIBANO.jfif';  id = 'roberto79';    cx = 0.47; cy = 0.43; lado = 0.40 },
  @{ f = 'RAUL PAREDES.jfif';       id = 'raul-paredes'; cx = 0.50; cy = 0.41; lado = 0.40 },
  @{ f = 'JOS*FERNANDEZ.jfif';      id = 'josefh';       cx = 0.46; cy = 0.43; lado = 0.40 },
  @{ f = 'ENRIQUE PORRAS.jfif';     id = 'kike78';       cx = 0.44; cy = 0.44; lado = 0.40 },
  @{ f = 'RUBEN FERNANDEZ.jfif';    id = 'ruben-57';     cx = 0.47; cy = 0.43; lado = 0.40 }
)

$LADO = 320
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]84)

"`n  Avatares de piloto:"
foreach ($e in $tabla) {
  # Los nombres con tilde no sobreviven a la codificación de PowerShell 5:
  # se buscan con comodín (JOS* encuentra "JOSÉ MA. FERNANDEZ").
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
    (New-Object System.Drawing.Rectangle($x0, $y0, $lado, $lado)), [System.Drawing.GraphicsUnit]::Pixel)
  $salida = Join-Path $destino ($e.id + '.jpg')
  $out.Save($salida, $codec, $params)
  "  {0,-28} -> fotos/{1}.jpg  ({2} KB)" -f $e.f, $e.id, [math]::Round((Get-Item $salida).Length / 1KB)
  $g.Dispose(); $out.Dispose(); $img.Dispose()
}
"`n  Listo. Pon la ruta en datos/pilotos.json (campo foto) y ejecuta node scripts/generar.mjs`n"
