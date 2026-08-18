# Prepara los logos para la web y genera los iconos de la PWA.
#
#   powershell -ExecutionPolicy Bypass -File scripts/preparar-logos.ps1
#
# Paso puntual: solo hay que ejecutarlo cuando cambie algún logo original.
# Usa System.Drawing (viene con Windows), no añade dependencias al proyecto.
# Los resultados se guardan en logos/ e iconos/ y van al repositorio.

Add-Type -AssemblyName System.Drawing
$raiz = Split-Path -Parent $PSScriptRoot

function Redimensionar($origen, $destino, $anchoObjetivo) {
  $img = [System.Drawing.Image]::FromFile($origen)
  $escala = $anchoObjetivo / $img.Width
  $w = [int]$anchoObjetivo
  $h = [int][math]::Round($img.Height * $escala)

  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'HighQuality'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($img, 0, 0, $w, $h)
  $bmp.Save($destino, [System.Drawing.Imaging.ImageFormat]::Png)

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

"`n  Logos para la web:"
Redimensionar "$raiz\logos\fasttoys-original.png"  "$raiz\logos\fasttoys.png"  420
Redimensionar "$raiz\logos\dr7-original.png"       "$raiz\logos\dr7.png"       420
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
