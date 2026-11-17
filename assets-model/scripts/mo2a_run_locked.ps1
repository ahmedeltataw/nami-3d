param([Parameter(Mandatory=$true)][string]$Blend, [Parameter(Mandatory=$true)][string]$Script, [Parameter(Mandatory=$true)][string]$Log)
$lockPath = Join-Path $env:TEMP 'nami-blender.lock'
$deadline = (Get-Date).AddMinutes(30)
$handle = $null
while (-not $handle -and (Get-Date) -lt $deadline) {
    try { $handle = [IO.File]::Open($lockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None) }
    catch [IO.IOException] { Start-Sleep -Seconds 30 }
}
if (-not $handle) { throw 'Timed out waiting for Blender lock after 30 minutes' }
try {
    $arguments = @('-b', $Blend, '--python-exit-code', '1', '--python', $Script)
    $blender = if ($env:BLENDER_EXE) { $env:BLENDER_EXE } else { 'blender' }
    & $blender @arguments *> $Log
    $result = $LASTEXITCODE
} finally {
    $handle.Dispose()
    Remove-Item -LiteralPath $lockPath
}
exit $result
