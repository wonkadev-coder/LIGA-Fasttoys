# Prepara los logos para la web y genera los iconos de la PWA.
#
#   powershell -ExecutionPolicy Bypass -File scripts/preparar-logos.ps1
#
# Paso puntual: solo hay que ejecutarlo cuando cambie algún logo original.
# Usa System.Drawing (viene con Windows), no añade dependencias al proyecto.
# Los resultados se guardan en logos/ e iconos/ y van al repositorio.

Add-Type -AssemblyName System.Drawing
$raiz = Split-Path -Parent $PSScriptRoot

# Varios logos vienen con el dibujo metido en un lienzo blanco enorme (el de LM
# ocupa un tercio de su imagen). Si no se recorta, en la tarjeta sale diminuto y
# descentrado. Esto busca el rectángulo que de verdad tiene tinta.
function RecortarBlanco($origen, $destino, $umbral = 243) {
  $img = New-Object System.Drawing.Bitmap($origen)
  $datos = $img.LockBits(
    (New-Object System.Drawing.Rectangle(0, 0, $img.Width, $img.Height)),
    [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

  $bytes = New-Object byte[] ($datos.Stride * $img.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($datos.Scan0, $bytes, 0, $bytes.Length)
  $img.UnlockBits($datos)

  $minX = $img.Width; $minY = $img.Height; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $img.Height; $y++) {
    $fila = $y * $datos.Stride
    for ($x = 0; $x -lt $img.Width; $x++) {
      $p = $fila + $x * 4
      # BGRA. Un píxel transparente tampoco es tinta.
      if ($bytes[$p + 3] -lt 16) { continue }
      if ($bytes[$p] -ge $umbral -and $bytes[$p + 1] -ge $umbral -and $bytes[$p + 2] -ge $umbral) { continue }
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }

  if ($maxX -lt 0) { $img.Dispose(); throw "$origen parece estar en blanco" }

  # Un respiro alrededor para que no quede el dibujo pegado al borde.
  $aire = [int]([math]::Max($maxX - $minX, $maxY - $minY) * 0.04)
  $x0 = [math]::Max(0, $minX - $aire); $y0 = [math]::Max(0, $minY - $aire)
  $x1 = [math]::Min($img.Width - 1, $maxX + $aire); $y1 = [math]::Min($img.Height - 1, $maxY + $aire)
  $w = $x1 - $x0 + 1; $h = $y1 - $y0 + 1

  $rec = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($rec)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $w, $h)),
    (New-Object System.Drawing.Rectangle($x0, $y0, $w, $h)), [System.Drawing.GraphicsUnit]::Pixel)
  $rec.Save($destino, [System.Drawing.Imaging.ImageFormat]::Png)

  "  {0,-24} {1}x{2} -> {3}x{4}" -f (Split-Path $destino -Leaf), $img.Width, $img.Height, $w, $h
  $g.Dispose(); $rec.Dispose(); $img.Dispose()
}

function Redimensionar($origen, $destino, $anchoObjetivo) {
  $img = [System.Drawing.Image]::FromFile($origen)
  $escala = $anchoObjetivo / $img.Width
  $w = [int]$anchoObjetivo
  $h = [int][math]::Round($img.Height * $escala)

  # Los logos que vienen de foto (fondo blanco liso) pesan un tercio en JPEG.
  # Solo se guardan en PNG los que necesitan transparencia.
  $esJpg = $destino -match '\.jpe?g$'

  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'HighQuality'
  $g.PixelOffsetMode = 'HighQuality'
  if ($esJpg) { $g.Clear([System.Drawing.Color]::White) }
  else { $g.Clear([System.Drawing.Color]::Transparent) }
  $g.DrawImage($img, 0, 0, $w, $h)

  if ($esJpg) {
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
      Where-Object { $_.MimeType -eq 'image/jpeg' }
    $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
      [System.Drawing.Imaging.Encoder]::Quality, 88)
    $bmp.Save($destino, $codec, $params)
    $params.Dispose()
  } else {
    $bmp.Save($destino, [System.Drawing.Imaging.ImageFormat]::Png)
  }

  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  $kb = [math]::Round((Get-Item $destino).Length / 1KB)
  "  {0,-24} {1}x{2}  {3} KB" -f (Split-Path $destino -Leaf), $w, $h, $kb
}

# Icono cuadrado de la PWA: el logo de Fast Toys sobre fondo blanco, con margen.
function CrearIcono($origen, $destino, $lado) {
  $img = [System.Drawing.Image]::FromFile($origen)
  $bmp = New-Object System.Drawing.Bitmap($lado, $lado)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::White)

  # El logo ocupa el 78% del lado: deja aire para el recorte circular de Android.
  $util = $lado * 0.78
  $escala = [math]::Min($util / $img.Width, $util / $img.Height)
  $w = [int][math]::Round($img.Width * $escala)
  $h = [int][math]::Round($img.Height * $escala)
  $g.DrawImage($img, [int](($lado - $w) / 2), [int](($lado - $h) / 2), $w, $h)
  $bmp.Save($destino, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  $kb = [math]::Round((Get-Item $destino).Length / 1KB)
  "  {0,-24} {1}x{1}  {2} KB" -f (Split-Path $destino -Leaf), $lado, $kb
}

$tmp = Join-Path $env:TEMP "liga-logos"
New-Item -ItemType Directory -Force $tmp | Out-Null

"`n  Recorte del blanco sobrante:"
RecortarBlanco "$raiz\logos\pmt-original.jpg" "$tmp\pmt.png"
RecortarBlanco "$raiz\logos\lm-original.jpg"  "$tmp\lm.png"

"`n  Logos para la web:"
Redimensionar "$raiz\logos\fasttoys-original.png"  "$raiz\logos\fasttoys.png"  420
Redimensionar "$raiz\logos\dr7-original.png"       "$raiz\logos\dr7.png"       420
Redimensionar "$tmp\pmt.png"                       "$raiz\logos\pmt.jpg"       420
Redimensionar "$tmp\lm.png"                        "$raiz\logos\lm.jpg"        420
# CronoLaps es un JPG pequeño con fondo negro sólido: convertirlo a PNG lo
# engordaba de 3 KB a 40 KB sin ganar nada. Se copia tal cual.
Copy-Item "$raiz\logos\cronolaps-original.jpg" "$raiz\logos\cronolaps.jpg" -Force
Remove-Item "$raiz\logos\cronolaps.png" -ErrorAction SilentlyContinue
"  {0,-24} 92x35  {1} KB" -f "cronolaps.jpg", [math]::Round((Get-Item "$raiz\logos\cronolaps.jpg").Length / 1KB)

"`n  Iconos de la PWA:"
CrearIcono "$raiz\logos\fasttoys-original.png" "$raiz\iconos\icono-512.png" 512
CrearIcono "$raiz\logos\fasttoys-original.png" "$raiz\iconos\icono-192.png" 192
CrearIcono "$raiz\logos\fasttoys-original.png" "$raiz\iconos\icono-180.png" 180
"`n  Listo. Ejecuta ahora: node scripts/generar.mjs`n"
