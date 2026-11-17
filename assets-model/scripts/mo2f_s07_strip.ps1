$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$folder=(Resolve-Path 'test-results/MO-2f/frames').Path
$out=(Resolve-Path 'test-results/MO-2f').Path
$files=@(1..7 | ForEach-Object { Join-Path $folder ('s07_future_v2-frame_{0:D2}.png' -f $_) }) + @(Join-Path $folder 's07_future_v2-reference.png')
$w=1672; $h=941
$sheet=[Drawing.Bitmap]::new(4*$w,2*$h)
$g=[Drawing.Graphics]::FromImage($sheet)
try {
 $g.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceCopy
 for ($i=0;$i -lt 8;$i++) {
  $img=[Drawing.Image]::FromFile($files[$i])
  try {
   if ($img.Width -ne $w -or $img.Height -ne $h) { throw 'Unexpected frame dimensions' }
   $rect=[Drawing.Rectangle]::new(($i%4)*$w,[int][Math]::Floor($i/4)*$h,$w,$h)
   $g.DrawImage($img,$rect,0,0,$w,$h,[Drawing.GraphicsUnit]::Pixel)
  } finally { $img.Dispose() }
 }
 $g.Dispose();$g=$null
 $sheet.Save((Join-Path $out 's07-round9-strip.png'),[Drawing.Imaging.ImageFormat]::Png)
} finally { if($g){$g.Dispose()};$sheet.Dispose() }
$sheet=[Drawing.Bitmap]::new((Join-Path $out 's07-round9-strip.png'))
try {
 for ($i=0;$i -lt 8;$i++) {
  $img=[Drawing.Bitmap]::new($files[$i])
  try { foreach($p in @(@(0,0),@(($w-1),0),@(0,($h-1)),@(($w-1),($h-1)),@(836,470))) {
   if ($img.GetPixel($p[0],$p[1]).ToArgb() -ne $sheet.GetPixel(($i%4)*$w+$p[0],[int][Math]::Floor($i/4)*$h+$p[1]).ToArgb()) { throw "Tile $i failed at $p" }
  } } finally { $img.Dispose() }
 }
} finally { $sheet.Dispose() }
Write-Output 'Verified 8 full frames; pixel samples match source images.'
