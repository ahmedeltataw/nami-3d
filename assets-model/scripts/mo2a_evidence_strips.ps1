$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$evidence = (Resolve-Path 'doc-annex/MO-2a-evidence').Path
$sets = @(
    @{ Folder='test-results/MO-2a/s07-round8'; Prefix='s07_future_v2-'; Names=@('flyin_00','flyin_01','flyin_02','flyin_03','flyin_04','reference'); Cols=3; Width=1672; Height=941; Output='s07-round8-final-strip.png' },
    @{ Folder='test-results/MO-2a/s04-safe-box'; Prefix='s04_idea_v2-'; Names=@('reference','yaw_min','yaw_max','pitch_min','pitch_max','dolly_min','dolly_max'); Cols=4; Width=480; Height=270; Output='s04-safe-limit-strip.png' },
    @{ Folder='test-results/MO-2a/s04-assembly-2p5'; Prefix='s04_idea_v2-'; Names=@('reference','frame_01','frame_02','frame_03','frame_04','frame_05','frame_06','frame_07','frame_08'); Cols=3; Width=480; Height=270; Output='s04-assembly-2p5-strip.png' }
)
foreach ($set in $sets) {
    $files = @($set.Names | ForEach-Object { Join-Path $set.Folder ($set.Prefix + $_ + '.png') })
    $rows = [int][Math]::Ceiling($files.Count / $set.Cols)
    $sheet = [Drawing.Bitmap]::new(($set.Width * $set.Cols), ($set.Height * $rows))
    $graphics = [Drawing.Graphics]::FromImage($sheet)
    try {
        $graphics.Clear([Drawing.Color]::Black)
        $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
        for ($i=0; $i -lt $files.Count; $i++) {
            $img = [Drawing.Image]::FromFile((Resolve-Path $files[$i]).Path)
            try {
                if ($img.Width -ne $set.Width -or $img.Height -ne $set.Height) { throw "Unexpected image size: $($files[$i])" }
                $x = ($i % $set.Cols) * $set.Width
                $y = [int][Math]::Floor($i / $set.Cols) * $set.Height
                $rect = [Drawing.Rectangle]::new($x, $y, $set.Width, $set.Height)
                $graphics.DrawImage($img, $rect, 0, 0, $img.Width, $img.Height, [Drawing.GraphicsUnit]::Pixel)
            } finally { $img.Dispose() }
        }
        $graphics.Dispose()
        $graphics = $null
        $sheet.Save((Join-Path $evidence $set.Output), [Drawing.Imaging.ImageFormat]::Png)
    } finally {
        if ($graphics) { $graphics.Dispose() }
        $sheet.Dispose()
    }
    $result = [Drawing.Bitmap]::new((Join-Path $evidence $set.Output))
    try {
        for ($i=0; $i -lt $files.Count; $i++) {
            $original = [Drawing.Bitmap]::new((Resolve-Path $files[$i]).Path)
            try {
                foreach ($point in @(@(0,0), @(($set.Width-1),0), @(0,($set.Height-1)), @(($set.Width-1),($set.Height-1)), @([int]($set.Width/2),[int]($set.Height/2)))) {
                    $x = ($i % $set.Cols) * $set.Width + $point[0]
                    $y = [int][Math]::Floor($i / $set.Cols) * $set.Height + $point[1]
                    if ($original.GetPixel($point[0],$point[1]).ToArgb() -ne $result.GetPixel($x,$y).ToArgb()) { throw "Pixel mismatch in $($set.Output), tile $i at $point" }
                }
            } finally { $original.Dispose() }
        }
    } finally { $result.Dispose() }
    Write-Output "Verified $($set.Output): $($files.Count) full frames, five pixel checks per frame"
}
